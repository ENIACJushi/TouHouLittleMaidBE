import {AnimationTypes} from "./types/AnimationTypes";
import {AnimationFileInfo} from "../resource_manager/AnimationManager";
import {AnimationProcessor} from "./processor/AnimationProcessor";

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
};

/**
 * 女仆的动画转换器
 *  此转换器专注于处理动画导出，通过统一的入参接入不同的动画管理器，用于适配多种场景
 *  尽量不使用额外实体属性实现模型动画状态变化，因为实体属性只能设32个
 */
export class MaidAnimationConvertor {
  modelAnimation: Map<number, Map<number, AnimationFileInfo[]>>;
  modelScale: Map<number, Map<number, number>>;

  constructor(
    modelAnimation: Map<number, Map<number, AnimationFileInfo[]>>,
    modelScale: Map<number, Map<number, number>>,
  ) {
    this.modelAnimation = modelAnimation;
    this.modelScale = modelScale;
  }

  /**
   * 导出实体定义的动画信息
   *   - 将原 json 动画文件的固定动画名（即 AnimationTypes）转换为基岩版的唯一动画名；<namespace>.<文件名（去掉.json）>.<type>
   *   - 将动画添加到 AnimationDefinition.animations，生成唯一编号;
   *   - 将动画注册到 scripts - animate，使用动画变量 `v.animate_xxx = n` 控制展示;
   *   - 汇总所有的动画展示条件，输出到 scripts - pre_animation
   */
  async exportDefinition(): Promise<AnimationDefinition> {
    let res: AnimationDefinition = {
      scripts: {
        scale: "query.property('thlm:scale') * v.scale",
        pre_animation: [
          // 特殊行走动画属性
          "variable.walk_process = Math.min(1, Math.abs(query.modified_move_speed / 0.9));",
          // 基础动画
          "variable.tcos0 = (Math.cos(query.modified_distance_moved * 38.17) * query.modified_move_speed / variable.gliding_speed_value) * 28.65;",
          "variable.emote_index=Math.mod(query.property('thlm:emote'),1000);",
          "variable.emote_frame=Math.max(1, Math.mod( Math.floor(query.property('thlm:emote')/1000), 1000) );",
          "variable.emote_speed=Math.max(1, Math.floor(query.property('thlm:emote')/1000000) );",

          "v.biaoqing = 0;", // 表情当前未实现，置0
          // 默认使用主包动画（编号 0）
          "v.scale = 1;", // 缩放
          "v.animate_walk = 0;",
          "v.animate_beg = 0;",
          "v.animate_sit = 0;",
        ],
        should_update_bones_and_effects_offscreen: true,
        animate: [
          "backpack_offset",
          "wing",
          "emote",
          { "statue_base": "(q.property('thlm:work') >= -4) && (q.property('thlm:work') <= -2)" },
          { "blink" : "query.property('thlm:work') >= -1" },
          { "look_at_target": "!query.property('thlm:is_hug')" },
          { "hug": "!q.is_in_ui && query.property('thlm:is_hug')" },

          { "walk": "v.animate_walk == 0 && !query.property('thlm:is_sitting')" },
          { "beg": "v.animate_beg == 0 && query.is_interested" },
          { "sit": "v.animate_sit == 0 && !q.is_in_ui && query.property('thlm:is_sitting')" }
        ],
      },
      animations: {
        "backpack_offset": "animation.touhou_little_maid.maid.backpack_offset",
        "wing": "animation.touhou_little_maid.basic.wing",
        "emote": "animation.touhou_little_maid.emote",
        "statue_base": "animation.touhou_little_maid.statue_base",
        "blink": "animation.touhou_little_maid.basic.blink",
        "look_at_target": "animation.common.look_at_target",
        "hug": "animation.touhou_little_maid.maid.hug",

        "walk": "animation.touhou_little_maid.basic.walk",
        "beg": "animation.touhou_little_maid.maid.beg",
        "sit": "animation.touhou_little_maid.maid.sit"
      },
      animationList: {},
    };

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
          // 导出编号：为主包动画留出 0
          const exportId = fileInfo.id + 1;

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
    const conditionMolang = this.buildShowConditionMolang(showConditions, this.modelScale);
    if (conditionMolang) {
      res.scripts.pre_animation.push(conditionMolang);
    }
    // 汇总动画到 animationList
    res.animationList = animationList;

    return res;
  }

  /**
   * 生成基岩版唯一动画名：animation.tlm.skin_pack.<packId>.<animationId>.<type>
   */
  private buildAnimationName(fileInfo: AnimationFileInfo, type: AnimationTypes): string {
    return `animation.tlm.skin_pack.${fileInfo.id}.${type}`;
  }

  /**
   * 汇总 pack/model 到动画变量的切换条件
   *  形如：temp.pack=...;temp.model=...;(temp.pack == 1001) ? { (temp.model==0) ? { v.animate_sit=1; }; };
   */
  private buildShowConditionMolang(
    showConditions: Map<number, Map<number, Partial<Record<AnimationTypes, number>>>>,
    modelScale: Map<number, Map<number, number>>,
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
      const allModelIds = new Set<number>([
        ...(models?.keys() ?? []),
        ...(scales?.keys() ?? []),
      ]);

      let modelBlocks = "";
      for (const modelId of allModelIds) {
        const types = models?.get(modelId);
        const animateAssigns = types
          ? (Object.entries(types) as [AnimationTypes, number][])
            .map(([type, id]) => `v.animate_${type}=${id};`)
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

