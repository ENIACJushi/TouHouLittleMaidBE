import {AnimationTypes} from "./types/AnimationTypes";
import {AnimationFileInfo} from "../resource_manager/AnimationManager";
import {AnimationProcessor} from "./processor/AnimationProcessor";
import {
  buildSkinPackAnimationName,
} from "./default/DefaultGeckoAnimation";
import {
  DEFAULT_ANIMATION_ID,
  ANIMATION_DEF_TEMPLATE,
} from "../config";

/** 与 SkinPackConvertor 一致：皮肤包属性 = packId + BASE_INDEX */
const BASE_INDEX = 1000;

/**
 * 各动画类型在 scripts.animate 中的额外触发条件
 *  （主条件 `v.animate_xxx == n` 之外）
 */
const ANIMATE_EXTRA_CONDITION: Record<AnimationTypes, string> = {
  [AnimationTypes.walk]: " && !query.property('thlm:is_sitting') && v.walk_process>0",
  [AnimationTypes.beg]: " && query.is_interested",
  [AnimationTypes.sit]: " && !q.is_in_ui && query.property('thlm:is_sitting')",
  [AnimationTypes.parallel0]: "",
  [AnimationTypes.parallel1]: "",
  [AnimationTypes.parallel2]: "",
  [AnimationTypes.parallel3]: "",
  // [AnimationTypes.swing_hand]: "",
  // [AnimationTypes.idle]: "",
  // [AnimationTypes.run]: "",
  // [AnimationTypes.jump]: "",
  // [AnimationTypes.death]: "",
  // [AnimationTypes.chair]: "",
  // [AnimationTypes.swim_stand]: "",
  // [AnimationTypes.use_offhand]: "",
  // [AnimationTypes.use_mainhand]: "",
  // [AnimationTypes.pre_parallel0]: "",
  // [AnimationTypes.pre_parallel1]: "",
  // [AnimationTypes.pre_parallel2]: "",
  // [AnimationTypes.pre_parallel3]: "",
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
   *   - 汇总所有的动画展示条件，输出到 scripts - pre_animation
   */
  async exportDefinition(): Promise<AnimationDefinition> {
    // 从模板创建基础动画定义
    let res: AnimationDefinition = JSON.parse(JSON.stringify(ANIMATION_DEF_TEMPLATE));

    // 记录已注册到 animations / animate 的 shortKey，避免重复
    const registered = new Set<string>();
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
            if (!animList[type]) {
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
                animationList[animationName] = await AnimationProcessor.getInstance()
                  .process(type, fileInfo.animation.animations[type]);
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

