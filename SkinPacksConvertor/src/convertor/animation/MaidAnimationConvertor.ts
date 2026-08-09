import {AnimationTypes, getAnimationSourceKey} from "./types/AnimationTypes";
import {AnimationFileInfo} from "../resource_manager/AnimationManager";
import {AnimationProcessor} from "./processor/AnimationProcessor";
import {
  buildSkinPackAnimationName,
} from "./default/DefaultGeckoAnimation";
import {
  DEFAULT_ANIMATION_ID,
  ANIMATION_DEF_TEMPLATE,
} from "../config";
import {registerMolangVariableKeep} from "../molang/v/VariableResolvers";

/**
 * 从赋值表达式解析变量名：取第一个单字符 `=` 左侧，
 * 且以 `v.` / `variable.` 开头时返回该左值（如 `v.bv`）。
 */
const parsePreAnimVariableName = (line: string): string | null => {
  let assignIdx = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== '=') continue;
    const prev = i > 0 ? line[i - 1] : '';
    const next = i < line.length - 1 ? line[i + 1] : '';
    if (prev !== '=' && next !== '=' && prev !== '!' && prev !== '<' && prev !== '>') {
      assignIdx = i;
      break;
    }
  }
  if (assignIdx < 0) {
    return null;
  }
  const lhs = line.slice(0, assignIdx).trim();
  const lower = lhs.toLowerCase();
  if (lower.startsWith('v.') || lower.startsWith('variable.')) {
    return lhs;
  }
  return null;
};

/** 去重键：`variable.xxx` 与 `v.xxx` 视为同一变量 */
const toPreAnimVarKey = (varName: string): string => {
  return varName.toLowerCase().replace(/^variable\./, 'v.');
};

/** 收集模板中已注册的 pre_animation 变量（规范化小写键） */
const collectRegisteredPreAnimVars = (preAnimation: string[]): Set<string> => {
  const registered = new Set<string>();
  for (const line of preAnimation) {
    const varName = parsePreAnimVariableName(line);
    if (varName) {
      registered.add(toPreAnimVarKey(varName));
    }
  }
  return registered;
};

/** 与 SkinPackConvertor 一致：皮肤包属性 = packId + BASE_INDEX */
const BASE_INDEX = 1000;

/**
 * 各动画类型在 scripts.animate 中的额外触发条件
 *  （主条件 `v.animate_xxx == n` 之外）
 */
const ANIMATE_EXTRA_CONDITION: Record<AnimationTypes, string> = {
  [AnimationTypes.hug]: " && !q.is_in_ui && v.tlm_is_hug",
  [AnimationTypes.walk]: " && !v.tlm_is_sitting && v.walk_process>0",
  [AnimationTypes.beg]: " && query.is_interested",
  [AnimationTypes.sit]: " && !q.is_in_ui && v.tlm_is_sitting && !v.tlm_is_hug", // 被抱起时不可播放坐下动画
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
  // 对齐 Java Priority.LOWEST 兜底：更高优先级主状态（sit/hug/walk）都不匹配时播放
  [AnimationTypes.idle]: " && !v.tlm_is_sitting && !v.tlm_is_hug && v.walk_process<=0",
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
   *   - 将原 json 动画文件的固定动画名（即 AnimationTypes）转换为基岩版的唯一动画名；<namespace>.<文件名（去掉.json）>.<type>
   *   - 将动画添加到 AnimationDefinition.animations，生成唯一编号;
   *   - 将动画注册到 scripts - animate，使用动画变量 `v.animate_xxx = n` 控制展示;
   *   - 汇总所有的动画展示条件，输出到 scripts - pre_animation;
   *   - 将 molang 伪骨骼提取的变量赋值并入 scripts - pre_animation（按动画开关门控）
   */
  async exportDefinition(): Promise<AnimationDefinition> {
    // 从模板创建基础动画定义
    let res: AnimationDefinition = JSON.parse(JSON.stringify(ANIMATION_DEF_TEMPLATE));

    // 记录已注册到 animations / animate 的 shortKey，避免重复
    const registered = new Set<string>();
    // 已在 pre_animation 注册初始化的变量字段名（小写），用于去重
    const registeredPreAnimVars = collectRegisteredPreAnimVars(res.scripts.pre_animation);
    // packId -> modelId -> 动画类型 -> 导出编号（后解析的文件覆盖先解析的）
    const showConditions = new Map<number, Map<number, Partial<Record<AnimationTypes, number>>>>();
    // 动画列表
    let animationList: Record<string, object> = {};

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
            if (!sourceAnim) {
              continue;
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
                // 若动画还未注册，则执行转换并注册
                const processed = await AnimationProcessor.getInstance()
                  .process(type, sourceAnim);
                // molang 伪骨骼处理
                if (processed.extractedScripts?.length) {
                  // 单独注册变量初始化行
                  for (const script of processed.extractedScripts) {
                    this.registerPreAnimVariable(script, res.scripts.pre_animation, registeredPreAnimVars);
                  }
                  // 按动画开关写入赋值
                  const body = processed.extractedScripts.join('');
                  res.scripts.pre_animation.push(
                    `(v.animate_${type}==${exportId}) ? { ${body} };`,
                  );
                  delete processed.extractedScripts;
                }
                animationList[animationName] = processed;
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

    // 汇总展示条件到 pre_animation
    const conditionMolang = this.buildShowConditionMolang(
      showConditions,
      this.modelScale,
      this.modelIsGecko,
    );
    if (conditionMolang) {
      res.scripts.pre_animation.push(conditionMolang);
    }
    // 汇总动画到 animationList
    res.animationList = animationList;

    return res;
  }

  /**
   * 生成基岩版唯一动画名：animation.tlm.skin_pack.<animationId>.<type>
   */
  private buildAnimationName(fileInfo: AnimationFileInfo, type: AnimationTypes): string {
    return buildSkinPackAnimationName(fileInfo.id, type);
  }

  /**
   * 在 pre_animation 中为变量单独注册初始化行 `v.xxx=1;`（已注册则跳过）。
   */
  private registerPreAnimVariable(
    script: string,
    preAnimation: string[],
    registeredVars: Set<string>,
  ): void {
    const varName = parsePreAnimVariableName(script);
    if (!varName) {
      return;
    }
    const key = toPreAnimVarKey(varName);
    if (registeredVars.has(key)) {
      return;
    }
    registeredVars.add(key);
    preAnimation.push(`${varName}=1;`);
    // keep 白名单按字段名匹配
    const field = varName.replace(/^(?:v|variable)\./i, '');
    registerMolangVariableKeep(field);
  }

  /**
   * 汇总 pack/model 到动画变量的切换条件
   *  形如：temp.pack=...;temp.model=...;(temp.pack == 1001) ? { (temp.model==0) ? { v.animate_sit=1; }; };
   */
  private buildShowConditionMolang(
    showConditions: Map<number, Map<number, Partial<Record<AnimationTypes, number>>>>,
    modelScale: Map<number, Map<number, number>>,
    modelIsGecko: Map<number, Map<number, boolean>>,
  ): string {
    if (showConditions.size === 0 && modelScale.size === 0) {
      return "";
    }
    let molang = `temp.pack=q.property('thlm:skin_pack');temp.model=q.variant;`;

    const allPackIds = new Set<number>([
      ...showConditions.keys(),
      ...modelScale.keys(),
    ]);

    for (const packId of allPackIds) {
      const skinPack = packId + BASE_INDEX;
      const models = showConditions.get(packId);
      const scales = modelScale.get(packId);
      const geckoFlags = modelIsGecko.get(packId);
      const allModelIds = new Set<number>([
        ...(models?.keys() ?? []),
        ...(scales?.keys() ?? []),
      ]);

      let modelBlocks = "";
      for (const modelId of allModelIds) {
        const types = models?.get(modelId);
        const isGecko = geckoFlags?.get(modelId) ?? false;
        // 未定义动画时，geck 模型使用默认动画1，非geck模型使用默认动画0
        const defaultAnimId = isGecko ? DEFAULT_ANIMATION_ID : 0;
        const needAnimateAssigns = types !== undefined || isGecko;
        const animateAssigns = needAnimateAssigns
          ? (Object.values(AnimationTypes) as AnimationTypes[])
            .map((type) => `v.animate_${type}=${types?.[type] ?? defaultAnimId};`)
            .join("")
          : "";

        const scale = scales?.get(modelId);
        const scaleAssign = scale !== undefined ? `v.scale=${scale};` : "";
        const assigns = `${scaleAssign}${animateAssigns}`;

        if (!assigns) {
          continue;
        }
        modelBlocks += `(temp.model==${modelId}) ? { ${assigns} };`;
      }

      if (!modelBlocks) {
        continue;
      }
      molang += `(temp.pack == ${skinPack}) ? { ${modelBlocks} };`;
    }
    return molang;
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
  pre_animation: string[];
  should_update_bones_and_effects_offscreen: true;
  animate: (string | Record<string,string>)[];
}

