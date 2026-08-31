import {AnimationTypes, getAnimationSourceKey, isParallelAnimationType} from "./types/AnimationTypes";
import {AnimationFileInfo} from "../resource_manager/AnimationManager";
import {AnimationProcessor} from "./processor/AnimationProcessor";
import {animationHasEyeBones} from "./processor/APPreParallelEyeGuard";
import {
  buildSkinPackAnimationName,
  DEFAULT_ANIMATION_TYPES,
  DEFAULT_MAID_ANIMATION_SOURCE,
} from "./default/DefaultGeckoAnimation";
import {
  DEFAULT_ANIMATION_ID,
  WALK_PROCESS_MOVING_MIN,
  PRE_ANIMATION_MOLANG_MAX_LENGTH,
  PROFILE,
} from "../config";
import {getDynamicMolangKeepFields, getDynamicMolangVariableDefaults} from "../molang/v/VariableResolvers";
import {
  chunkGatedMolangStatements,
  chunkMolangStatements,
  parseVariableAssignLhs,
  toVariableAssignKey,
} from "../molang/MolangAssign";
import { AnimationDefinition180 } from "./types/AnimationSchema180";
import { isAnimationEmpty } from "../ysm/YsmLocomotionResolver";
import { appendForcedYsmAccessoryDefaultsToPreAnimation } from "../ysm/accessory/appendForcedAccessoryDefaults";

/** 自带眨眼关键帧时，播放期间需抑制 pre_parallel molang 眨眼的主状态 */
const MAIN_ANIM_EYE_GUARD_TYPES: readonly AnimationTypes[] = [
  AnimationTypes.sit,
  AnimationTypes.idle,
];

/** 收集模板中已注册的变量（规范化小写键；含 initialize / pre_animation） */
const collectRegisteredScriptVars = (lines: string[]): Set<string> => {
  const registered = new Set<string>();
  for (const line of lines) {
    const varName = parseVariableAssignLhs(line);
    if (varName) {
      // `variable.xxx` 与 `v.xxx` 视为同一变量
      registered.add(toVariableAssignKey(varName));
    }
  }
  return registered;
};

/** 门控脚本排序：pre_parallel 目标赋值优先于 parallel 弹簧积分 */
const gatedScriptOrder = (script: string): number =>
  script.includes('animate_pre_parallel') ? 0 : 1;

/**
 * 各动画类型在 scripts.animate 中的额外触发条件
 *  （主条件 `v.animate_xxx == n` 之外）
 */
const ANIMATE_EXTRA_CONDITION: Record<AnimationTypes, string> = {
  [AnimationTypes.hug]: " && !q.is_in_ui && v.tlm_is_hug",
  [AnimationTypes.walk]: ` && !v.tlm_is_sitting && v.walk_process>${WALK_PROCESS_MOVING_MIN}`,
  [AnimationTypes.beg]: " && query.is_interested",
  [AnimationTypes.sit]: " && !q.is_in_ui && v.tlm_is_sitting && !v.tlm_is_hug", // 被抱起时不可播放坐下动画
  // 睡眠：睡觉是最优先姿态（可与躺下共存），被抱起时不可睡
  [AnimationTypes.sleep]: " && !q.is_in_ui && v.tlm_is_sleep && !v.tlm_is_hug",
  [AnimationTypes.parallel0]: "",
  [AnimationTypes.parallel1]: "",
  [AnimationTypes.parallel2]: "",
  [AnimationTypes.parallel3]: "",
  [AnimationTypes.parallel4]: "",
  [AnimationTypes.parallel5]: "",
  [AnimationTypes.parallel6]: "",
  [AnimationTypes.parallel7]: "",
  [AnimationTypes.pre_parallel0]: "",
  [AnimationTypes.pre_parallel1]: "",
  [AnimationTypes.pre_parallel2]: "",
  [AnimationTypes.pre_parallel3]: "",
  [AnimationTypes.pre_parallel4]: "",
  [AnimationTypes.pre_parallel5]: "",
  [AnimationTypes.pre_parallel6]: "",
  [AnimationTypes.pre_parallel7]: "",
  // 对齐 Java Priority.LOWEST 兜底：更高优先级主状态（sit/hug/walk）都不匹配时播放。
  // walk_process 阈值对齐 YSM MIN_SPEED，停步后微小速度仍回 idle。
  [AnimationTypes.idle]: ` && !v.tlm_is_sitting && !v.tlm_is_hug && v.walk_process<=${WALK_PROCESS_MOVING_MIN}`,
  // [AnimationTypes.swing_hand]: "",
  // [AnimationTypes.run]: "",
  // [AnimationTypes.jump]: "",
  // [AnimationTypes.death]: "",
  // [AnimationTypes.chair]: "",
  // [AnimationTypes.swim_stand]: "",
  // [AnimationTypes.use_offhand]: "",
  // [AnimationTypes.use_mainhand]: "",
  // [AnimationTypes.gomoku]: "",
  // [AnimationTypes.computer]: "",
  // [AnimationTypes.keyboard]: "",
  // [AnimationTypes.bookshelf]: "",
  // [AnimationTypes.sleep]: "",
  // [AnimationTypes.game_win]: "",
  // [AnimationTypes.game_lost]: "",
};

/**
 * 女仆的动画转换器
 *  此转换器专注于处理动画导出，通过统一的入参接入不同的动画管理器，用于适配多种场景
 *  尽量不使用额外实体属性实现模型动画状态变化，因为实体属性只能设32个
 */
export class MaidAnimationConvertor {
  modelAnimation: Map<number, Map<number, AnimationFileInfo[]>>;
  modelScale: Map<number, Map<number, number>>;
  modelIsGecko: Map<number, Map<number, boolean>>;

  constructor(
    modelAnimation: Map<number, Map<number, AnimationFileInfo[]>>,
    modelScale: Map<number, Map<number, number>>,
    modelIsGecko: Map<number, Map<number, boolean>>,
  ) {
    this.modelAnimation = modelAnimation;
    this.modelScale = modelScale;
    this.modelIsGecko = modelIsGecko;
  }

  /**
   * 导出实体定义的动画信息
   *   - 先将内置兜底源动画单独转换并写入 animationList（id = DEFAULT_ANIMATION_ID）；
   *   - 将原 json 动画文件的固定动画名（即 AnimationTypes）转换为基岩版的唯一动画名；<namespace>.<文件名（去掉.json）>.<type>
   *   - 将动画添加到 AnimationDefinition.animations，生成唯一编号;
   *   - 将动画注册到 scripts - animate，使用动画变量 `v.animate_xxx = n` 控制展示;
   *   - 汇总所有的动画展示条件，输出到 scripts - pre_animation;
   *   - 将 molang 伪骨骼提取的变量赋值并入 scripts - pre_animation（按动画开关门控）；
   *   - 变量默认 0 写入 scripts.initialize（只跑一次，避免每帧清零弹簧状态）
   */
  async exportDefinition(): Promise<AnimationDefinition> {
    // 从模板创建基础动画定义
    let res: AnimationDefinition = JSON.parse(JSON.stringify(PROFILE.ANIMATION_DEF_TEMPLATE));

    // 记录已注册到 animations / animate 的 shortKey，避免重复
    const registered = new Set<string>();
    // 已写入 initialize / 模板 scripts 的变量键（小写），用于去重
    const registeredScriptVars = collectRegisteredScriptVars([
      ...res.scripts.initialize,
      ...res.scripts.pre_animation,
    ]);
    // packId -> modelId -> 动画类型 -> 导出编号（后解析的文件覆盖先解析的）
    const showConditions = new Map<number, Map<number, Partial<Record<AnimationTypes, number>>>>();
    // 动画列表
    let animationList: Record<string, object> = {};
    // sit/idle 导出 id → 是否含眼皮关键帧（用于抑制 molang 眨眼）
    const mainAnimHasEyeBones = new Map<AnimationTypes, Set<number>>();
    for (const type of MAIN_ANIM_EYE_GUARD_TYPES) {
      mainAnimHasEyeBones.set(type, new Set());
    }
    // 门控赋值须在 showCondition（写入 v.animate_*）之后执行，先暂存
    const deferredGatedScripts: string[] = [];

    // 先单独转换内置兜底源动画（DEFAULT_ANIMATION_ID），再处理皮肤包动画
    await this.convertDefaultAnimations(
      res,
      animationList,
      registeredScriptVars,
      mainAnimHasEyeBones,
      deferredGatedScripts,
    );

    for (const [packId, models] of this.modelAnimation) {
      for (const [modelId, fileInfos] of models) {
        for (const fileInfo of fileInfos) {
          const animList = fileInfo.animation?.animations;
          if (!animList) {
            continue;
          }
          // 导出编号与动画 id 一致（从 CONVERTED_ANIMATION_ID_START 起，默认动画占用更小 id）
          const exportId = fileInfo.id;

          for (const type of Object.values(AnimationTypes) as AnimationTypes[]) {
            const sourceKey = getAnimationSourceKey(type);
            const sourceAnim = animList[sourceKey];
            // 空桩（YSM 常见 walk/idle 占位）视为缺失，避免覆盖默认动画
            if (!sourceAnim || isAnimationEmpty(sourceAnim)) {
              continue;
            }
            // 记录会与 pre_parallel molang 眨眼抢眼皮通道的主动画
            const eyeGuardIds = mainAnimHasEyeBones.get(type);
            if (eyeGuardIds && animationHasEyeBones(sourceAnim)) {
              eyeGuardIds.add(exportId);
            }
            const shortKey = `${type}_${exportId}`;
            // 注册唯一动画名与 animate 条件（同一动画文件只注册一次）
            if (!registered.has(shortKey)) {
              registered.add(shortKey);
              let animationName = this.buildAnimationName(fileInfo, type);
              res.animations[shortKey] = animationName;
              res.scripts.animate.push({
                [shortKey]: `v.animate_${type}==${exportId}${ANIMATE_EXTRA_CONDITION[type]}`,
              });
              if (!animationList[animationName]) {
                // 若动画还未注册，则执行转换并注册（传入该模型的缩放）
                const scale = this.modelScale.get(packId)?.get(modelId) ?? 1;
                const processed = await AnimationProcessor.getInstance()
                  .process(type, sourceAnim, scale);
                this.applyProcessedAnimation(
                  type,
                  exportId,
                  animationName,
                  processed,
                  res,
                  animationList,
                  registeredScriptVars,
                  deferredGatedScripts,
                );
              }
            }
            // 记录该模型应播放的动画编号（同类型后文件覆盖）
            let packMap = showConditions.get(packId);
            if (!packMap) {
              packMap = new Map();
              showConditions.set(packId, packMap);
            }
            let modelMap = packMap.get(modelId);
            if (!modelMap) {
              modelMap = {};
              packMap.set(modelId, modelMap);
            }
            modelMap[type] = exportId;
          }
        }
      }
    }

    // 变量默认值：必须写入 initialize（只跑一次）。
    this.appendMissingKeepVarsToInitialize(
      res.scripts.initialize,
      registeredScriptVars,
    );
    // 配饰隐藏值每帧再写一次，避免基岩嵌套/状态重置后重新露出来（实现见 ysm/accessory）
    appendForcedYsmAccessoryDefaultsToPreAnimation(res.scripts.pre_animation);
    // 汇总展示条件：写入 v.animate_*（门控脚本依赖这些值）
    // 按模型拆成多条，避免单条 molang 过长被基岩截断
    const conditionMolangs = this.buildShowConditionMolang(
      showConditions,
      this.modelScale,
      this.modelIsGecko,
    );
    if (conditionMolangs.length > 0) {
      res.scripts.pre_animation.push(...conditionMolangs);
    }
    // pre_parallel 目标赋值优先于 parallel 弹簧积分（同帧内先更新 tail* 再积 L13）
    deferredGatedScripts.sort((a, b) => gatedScriptOrder(a) - gatedScriptOrder(b));
    res.scripts.pre_animation.push(...deferredGatedScripts);
    // 须在 animate_* 赋值之后：sit/idle 自带眨眼时抑制 molang 眨眼
    const suppressMolangs = this.buildSuppressMolangBlinkMolang(mainAnimHasEyeBones);
    if (suppressMolangs.length > 0) {
      res.scripts.pre_animation.push(...suppressMolangs);
    }
    // 汇总动画到 animationList
    res.animationList = animationList;

    return res;
  }

  /**
   * 将内置兜底源动画（maid.animation.json）按 AnimationTypes 单独转换，
   * 写入 animationList；模板中已预置 *_1 的 animations / animate 引用。
   */
  private async convertDefaultAnimations(
    res: AnimationDefinition,
    animationList: Record<string, object>,
    registeredScriptVars: Set<string>,
    mainAnimHasEyeBones: Map<AnimationTypes, Set<number>>,
    deferredGatedScripts: string[],
  ): Promise<void> {
    const sourceAnims = DEFAULT_MAID_ANIMATION_SOURCE.animations;
    const exportId = DEFAULT_ANIMATION_ID;

    for (const type of DEFAULT_ANIMATION_TYPES) {
      const sourceKey = getAnimationSourceKey(type);
      const sourceAnim = sourceAnims[sourceKey];
      if (!sourceAnim) {
        continue;
      }
      // 深拷贝，避免处理器原地修改污染内置源模块
      const cloned: AnimationDefinition180 = JSON.parse(JSON.stringify(sourceAnim));
      const eyeGuardIds = mainAnimHasEyeBones.get(type);
      if (eyeGuardIds && animationHasEyeBones(cloned)) {
        eyeGuardIds.add(exportId);
      }
      const animationName = buildSkinPackAnimationName(exportId, type);
      if (animationList[animationName]) {
        continue;
      }
      const processed = await AnimationProcessor.getInstance().process(type, cloned);
      this.applyProcessedAnimation(
        type,
        exportId,
        animationName,
        processed,
        res,
        animationList,
        registeredScriptVars,
        deferredGatedScripts,
      );
    }
  }

  /**
   * 将已处理动画写入列表，并处理 molang 伪骨骼 / 拆分出的眼部动画。
   */
  private applyProcessedAnimation(
    type: AnimationTypes,
    exportId: number,
    animationName: string,
    processed: AnimationDefinition180,
    res: AnimationDefinition,
    animationList: Record<string, object>,
    registeredScriptVars: Set<string>,
    deferredGatedScripts: string[],
  ): void {
    // molang 伪骨骼 / timeline 赋值：变量先 initialize，门控体延后到 showCondition 之后
    if (processed.extractedScripts?.length) {
      for (const script of processed.extractedScripts) {
        this.registerInitVariable(script, res.scripts.initialize, registeredScriptVars);
      }
      // math.random 在 Java timeline 通常只在进入关键时掷一次；抽到 pre_animation 后若每帧执行会高频抖
      const onceScripts: string[] = [];
      const everyFrameScripts: string[] = [];
      for (const script of processed.extractedScripts) {
        if (/math\.random/i.test(script)) {
          onceScripts.push(script);
        } else {
          everyFrameScripts.push(script);
        }
      }
      if (everyFrameScripts.length > 0) {
        deferredGatedScripts.push(
          ...chunkGatedMolangStatements(
            `(v.animate_${type}==${exportId}) ? { `,
            ` };`,
            everyFrameScripts,
            PRE_ANIMATION_MOLANG_MAX_LENGTH,
          ),
        );
      }
      if (onceScripts.length > 0) {
        const flagVar = `v.tlm_anim_once_${type}_${exportId}`;
        const flagKey = toVariableAssignKey(flagVar);
        if (!registeredScriptVars.has(flagKey)) {
          registeredScriptVars.add(flagKey);
          res.scripts.initialize.push(`${flagVar}=0;`);
        }
        const extra = ANIMATE_EXTRA_CONDITION[type] ?? '';
        const active = `v.animate_${type}==${exportId}${extra}`;
        const open = `(${active}) ? { (${flagVar}==0) ? { `;
        // 末段需写入 flag=1，并带上未激活时的复位；按末段额外开销收紧 body 预算
        const lastClose = `${flagVar}=1; }; } : { ${flagVar}=0; };`;
        const midClose = ` }; };`;
        const bodies = chunkMolangStatements(
          onceScripts,
          PRE_ANIMATION_MOLANG_MAX_LENGTH - open.length - Math.max(midClose.length, lastClose.length),
        );
        for (let i = 0; i < bodies.length; i++) {
          const isLast = i === bodies.length - 1;
          deferredGatedScripts.push(
            isLast
              ? `${open}${bodies[i]}${lastClose}`
              : `${open}${bodies[i]}${midClose}`,
          );
        }
      }
      delete processed.extractedScripts;
    }
    // pre_parallel 眼部骨骼：独立动画，sit/idle 自带眨眼时不播
    if (processed.extractedEyeAnimation) {
      const eyeShortKey = `${type}_eye_${exportId}`;
      const eyeAnimName = buildSkinPackAnimationName(exportId, `${type}_eye`);
      res.animations[eyeShortKey] = eyeAnimName;
      res.scripts.animate.push({
        [eyeShortKey]:
          `v.animate_${type}==${exportId} && !v.tlm_suppress_molang_blink`,
      });
      animationList[eyeAnimName] = processed.extractedEyeAnimation;
      delete processed.extractedEyeAnimation;
    }
    animationList[animationName] = processed;
  }

  /**
   * 生成基岩版唯一动画名：animation.tlm.skin_pack.<animationId>.<type>
   */
  private buildAnimationName(fileInfo: AnimationFileInfo, type: AnimationTypes): string {
    return buildSkinPackAnimationName(fileInfo.id, type);
  }

  /**
   * 在 scripts.initialize 中注册 `v.xxx=0;`（实体加载时执行一次；已注册则跳过）。
   * keep 登记由 APMolang 在转换期完成；此处只负责一次性默认值，切勿写入 pre_animation。
   */
  private registerInitVariable(
    script: string,
    initialize: string[],
    registeredVars: Set<string>,
  ): void {
    const varName = parseVariableAssignLhs(script);
    if (!varName) {
      return;
    }
    const key = toVariableAssignKey(varName);
    if (registeredVars.has(key)) {
      return;
    }
    registeredVars.add(key);
    initialize.push(`${varName}=0;`);
  }

  /**
   * 将转换期 keep 白名单中尚未初始化的变量写入 scripts.initialize。
   * 覆盖只在骨骼通道引用、未出现在 extractedScripts 左值的变量（如 v.tail5z / v.ysm_roaming_fumo）。
   * 默认值优先取 {@link registerMolangVariableDefault}，否则为 0。
   */
  private appendMissingKeepVarsToInitialize(
    initialize: string[],
    registeredVars: Set<string>,
  ): void {
    const defaults = getDynamicMolangVariableDefaults();
    for (const field of getDynamicMolangKeepFields().sort()) {
      const key = `v.${field}`;
      if (registeredVars.has(key)) {
        continue;
      }
      registeredVars.add(key);
      const value = defaults.get(field) ?? 0;
      initialize.push(`${key}=${value};`);
    }
  }

  /**
   * 当 sit/idle 导出动画含眼皮关键帧且实际在播时，置 v.tlm_suppress_molang_blink=1。
   * 须接在 showCondition（赋值 v.animate_*）之后。
   * 条件与 scripts.animate 额外条件对齐：v.animate_* 会被模型常驻赋值，不能只判断 id。
   */
  private buildSuppressMolangBlinkMolang(
    mainAnimHasEyeBones: Map<AnimationTypes, Set<number>>,
  ): string[] {
    const lines: string[] = [];
    for (const type of MAIN_ANIM_EYE_GUARD_TYPES) {
      const ids = mainAnimHasEyeBones.get(type);
      if (!ids || ids.size === 0) {
        continue;
      }
      const extra = ANIMATE_EXTRA_CONDITION[type] ?? '';
      // id 列表过长时拆成多条，避免单条条件超限
      const idTerms = [...ids]
        .sort((a, b) => a - b)
        .map((id) => `(v.animate_${type}==${id}${extra})`);
      const open = `(`;
      const close = `) ? { v.tlm_suppress_molang_blink=1; };`;
      const budget = PRE_ANIMATION_MOLANG_MAX_LENGTH - open.length - close.length;
      let batch = '';
      for (const term of idTerms) {
        const next = batch ? `${batch}||${term}` : term;
        if (batch && next.length > budget) {
          lines.push(`${open}${batch}${close}`);
          batch = term;
        } else {
          batch = next;
        }
      }
      if (batch) {
        lines.push(`${open}${batch}${close}`);
      }
    }
    return lines;
  }

  /**
   * 汇总 pack/model 到动画变量的切换条件（按模型拆成多条，避免单条过长）
   *  形如：
   *    v.pack=...;v.model=...;
   *    (v.pack == 1001) ? { (v.model==0) ? { v.animate_sit=1; }; };
   */
  private buildShowConditionMolang(
    showConditions: Map<number, Map<number, Partial<Record<AnimationTypes, number>>>>,
    modelScale: Map<number, Map<number, number>>,
    modelIsGecko: Map<number, Map<number, boolean>>,
  ): string[] {
    if (showConditions.size === 0 && modelScale.size === 0 && modelIsGecko.size === 0) {
      return [];
    }
    const lines: string[] = [
      "v.pack=q.property('thlm:skin_pack');",
      "v.model=q.variant;",
    ];

    const allPackIds = new Set<number>([
      ...showConditions.keys(),
      ...modelScale.keys(),
      ...modelIsGecko.keys(),
    ]);

    for (const packId of allPackIds) {
      const skinPack = packId + PROFILE.BASE_PACK_INDEX;
      const models = showConditions.get(packId);
      const scales = modelScale.get(packId);
      const geckoFlags = modelIsGecko.get(packId);
      const allModelIds = new Set<number>([
        ...(models?.keys() ?? []),
        ...(scales?.keys() ?? []),
        ...(geckoFlags?.keys() ?? []),
      ]);

      for (const modelId of allModelIds) {
        const types = models?.get(modelId);
        const isGecko = geckoFlags?.get(modelId) ?? false;
        // 未定义主动画时，gecko 用默认动画1，非 gecko 用 0。
        // 已有自定义动画的 gecko：缺省的 parallel/pre_parallel 不要套默认1，
        // 否则会把默认 LongHair/眼睛叠到模型自己的头发物理上。
        const defaultAnimId = isGecko ? DEFAULT_ANIMATION_ID : 0;
        const hasCustomAnims = types !== undefined;
        const needAnimateAssigns = hasCustomAnims || isGecko;
        const fallbackAnimId = (type: AnimationTypes): number => {
          // sleep 无原包基础动画（sit/idle 有），无论模型是否定义，缺省时一律回退到内置转换动画
          if (type === AnimationTypes.sleep) {
            return DEFAULT_ANIMATION_ID;
          }
          if (hasCustomAnims && isGecko && isParallelAnimationType(type)) {
            return 0;
          }
          return defaultAnimId;
        };
        const assignStmts: string[] = [];
        const scale = scales?.get(modelId);
        if (scale !== undefined) {
          assignStmts.push(`v.scale=${scale};`);
        }
        if (needAnimateAssigns) {
          for (const type of Object.values(AnimationTypes) as AnimationTypes[]) {
            assignStmts.push(
              `v.animate_${type}=${types?.[type] ?? fallbackAnimId(type)};`,
            );
          }
        }
        // gecko：animate_blink 置 0，并标记 tlm_is_gecko
        if (isGecko) {
          assignStmts.push("v.animate_blink=0;");
          assignStmts.push("v.tlm_is_gecko=1;");
        }
        if (assignStmts.length === 0) {
          continue;
        }
        lines.push(
          ...chunkGatedMolangStatements(
            `(v.pack == ${skinPack}) ? { (v.model==${modelId}) ? { `,
            ` }; };`,
            assignStmts,
            PRE_ANIMATION_MOLANG_MAX_LENGTH,
          ),
        );
      }
    }
    // 仅有赋值头、没有任何模型条件时视为空
    return lines.length > 2 ? lines : [];
  }
}


/**
 * 实体动画定义
 */
export interface AnimationDefinition {
  scripts: AnimationScriptsDefinition;
  animations: Record<string, string>;
  animationList: Record<string, object>; // 用到的所有动画
}

/**
 * 实体动画 scripts 定义
 */
export interface AnimationScriptsDefinition {
  scale: string;
  /** 实体加载时执行一次；弹簧状态等默认值必须放这里，不能放 pre_animation（否则每帧清零） */
  initialize: string[];
  pre_animation: string[];
  should_update_bones_and_effects_offscreen: true;
  animate: (string | Record<string,string>)[];
}

