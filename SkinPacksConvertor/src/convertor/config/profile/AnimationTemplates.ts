import {
  DEFAULT_ANIMATION_ID,
  WALK_PROCESS_MOVING_MIN,
} from "../Constants";
import {buildSkinPackAnimationName} from "../../animation/default/DefaultGeckoAnimation";
import {AnimationTypes} from "../../animation/types/AnimationTypes";
import {AnimationDefinition} from "../../animation/MaidAnimationConvertor";
import { MAID_ENTITY_DEF_BASIC } from "../../../maid_basic";

/**
 * 构建基础动画定义基础模板，只包含手动转换的东方包
 *  内置包在此基础上生成
 */
export function buildDefaultTemplate(): AnimationDefinition {
  // 读取模板包
  const DESC = MAID_ENTITY_DEF_BASIC["minecraft:client_entity"].description;
  let res: AnimationDefinition = {
    scripts: JSON.parse(JSON.stringify(DESC.scripts)),
    animations: JSON.parse(JSON.stringify(DESC.animations)),
    animationList: {},
  }
  // 补充信息
  // scale、should_update_bones_and_effects_offscreen、initialize 使用模板值
  // 追加 scripts.pre_animation 信息
  res.scripts.pre_animation = [
    ...res.scripts.pre_animation,
    ...ANIMATION_DEF_TEMPLATE.scripts.pre_animation,
  ];
  // 追加 scripts.animate 信息
  res.scripts.animate = [
    ...res.scripts.animate,
    ...ANIMATION_DEF_TEMPLATE.scripts.animate,
  ];
  // 追加 animations 信息
  res.animations = {
    ...res.animations,
    ...ANIMATION_DEF_TEMPLATE.animations,
  };
  return res;
}

/**
 * 基础动画定义基础模板附加信息
 */
const ANIMATION_DEF_TEMPLATE: AnimationDefinition = {
  scripts: {
    // 这三个属性完全使用模板包的值，这里只是占个位
    "scale": "query.property('thlm:scale') * v.scale",
    "should_update_bones_and_effects_offscreen": true,
    "initialize": [],
    // 这两个属性的数据追加到模板的对应属性之后
    /**
     * 添加变量时，需要同步加进白名单 `src/convertor/molang/v/VariableResolvers.ts`
     */
    pre_animation: [
      `variable.tcos0 = (Math.cos(query.modified_distance_moved * 38.17) * Math.max(0, query.modified_move_speed - ${WALK_PROCESS_MOVING_MIN}) / variable.gliding_speed_value) * 28.65;`,
      // 特殊行走动画属性
      `variable.walk_process = Math.min(1, Math.max(0, (query.modified_move_speed - ${WALK_PROCESS_MOVING_MIN}) / 0.9));`,
      // 行走式中的除数；原版实体动画通常预置为 1（须在 tcos0 之前）
      "variable.gliding_speed_value = 1;",
      ///// 状态变量 /////
      // 眨眼：下次闭眼时刻随机落在当前起 2s~4s，闭眼持续 0.15 秒
      "v.ysm_blink_at = v.ysm_blink_at ?? (query.life_time + math.random(2.5, 4));",
      "v.ysm_is_close_eyes = query.life_time >= v.ysm_blink_at && query.life_time < v.ysm_blink_at + 0.15;",
      "v.ysm_blink_at = query.life_time >= v.ysm_blink_at + 0.15 ? (query.life_time + math.random(2, 4)) : v.ysm_blink_at;",
      "v.tlm_is_hug = query.property('thlm:is_hug');", // 是否处于抱起状态
      "v.tlm_is_sitting = query.property('thlm:is_sitting');", // 是否处于坐下状态
      "v.tlm_is_gecko = 0;", // 是否为 gecko 模型（gecko 模型在展示条件中覆写为 1）
      // sit/idle 自带眨眼关键帧时置 1，抑制 pre_parallel 的 molang 眨眼（对齐 Java main 覆盖）
      "v.tlm_suppress_molang_blink = 0;",
      // 经验，预留
      "v.exp = 0;",

      ///// 动画变量 /////
      // 默认使用转换器内置兜底动画（id 见 DEFAULT_ANIMATION_ID）
      "v.scale = 1;", // 缩放
      // 眨眼动画开关；gecko 模型没有专门的眨眼动画，在展示条件中均置 0，非gecko动画目前均置1
      `v.animate_blink = 1;`,
      `v.animate_hug = 0;`,
      `v.animate_walk = 0;`,
      `v.animate_beg = 0;`,
      `v.animate_sit = 0;`,
      `v.animate_idle = 0;`,
      `v.animate_parallel0 = 0;`,
      `v.animate_parallel1 = 0;`,
      `v.animate_parallel2 = 0;`,
      `v.animate_parallel3 = 0;`,
      `v.animate_parallel4 = 0;`,
      `v.animate_parallel5 = 0;`,
      `v.animate_parallel6 = 0;`,
      `v.animate_parallel7 = 0;`,
      `v.animate_pre_parallel0 = 0;`,
      `v.animate_pre_parallel1 = 0;`,
      `v.animate_pre_parallel2 = 0;`,
      `v.animate_pre_parallel3 = 0;`,
      `v.animate_pre_parallel4 = 0;`,
      `v.animate_pre_parallel5 = 0;`,
      `v.animate_pre_parallel6 = 0;`,
      `v.animate_pre_parallel7 = 0;`,
    ],
    animate: [
      { "statue_base": "(q.property('thlm:work') >= -4) && (q.property('thlm:work') <= -2)" },
      { "look_at_target": "!v.tlm_is_hug" },
      { "blink" : "v.animate_blink == 1 && query.property('thlm:work') >= -1" },
      // 非 gecko 默认动画
      { "hug": "v.animate_hug == 0 && !q.is_in_ui && v.tlm_is_hug" },
      { "walk": `v.animate_walk == 0 && !v.tlm_is_sitting && v.walk_process>${WALK_PROCESS_MOVING_MIN}` },
      { "beg": "v.animate_beg == 0 && query.is_interested" },
      { "sit": "v.animate_sit == 0 && !q.is_in_ui && v.tlm_is_sitting && !v.tlm_is_hug" },
      // 兜底动画由转换器内置源文件转换生成，命名与皮肤包动画一致
      { "hug_1": `v.animate_hug == ${DEFAULT_ANIMATION_ID} && !q.is_in_ui && v.tlm_is_hug` },
      { "gecko_hug_base": `v.animate_hug != 0 && !q.is_in_ui && v.tlm_is_hug` },
      { "walk_1": `v.animate_walk == ${DEFAULT_ANIMATION_ID} && !v.tlm_is_sitting && v.walk_process>${WALK_PROCESS_MOVING_MIN}` },
      { "beg_1": `v.animate_beg == ${DEFAULT_ANIMATION_ID} && query.is_interested` },
      { "sit_1": `v.animate_sit == ${DEFAULT_ANIMATION_ID} && !q.is_in_ui && v.tlm_is_sitting && !v.tlm_is_hug` },
      { "idle_1": `v.animate_idle == ${DEFAULT_ANIMATION_ID} && !v.tlm_is_sitting && !v.tlm_is_hug && v.walk_process<=${WALK_PROCESS_MOVING_MIN}` },
      { "parallel0_1": `v.animate_parallel0 == ${DEFAULT_ANIMATION_ID}` },
      { "parallel1_1": `v.animate_parallel1 == ${DEFAULT_ANIMATION_ID}` },
      { "parallel2_1": `v.animate_parallel2 == ${DEFAULT_ANIMATION_ID}` },
      { "parallel3_1": `v.animate_parallel3 == ${DEFAULT_ANIMATION_ID}` },
      { "pre_parallel0_1": `v.animate_pre_parallel0 == ${DEFAULT_ANIMATION_ID}` },
      { "pre_parallel1_1": `v.animate_pre_parallel1 == ${DEFAULT_ANIMATION_ID}` },
      { "pre_parallel2_1": `v.animate_pre_parallel2 == ${DEFAULT_ANIMATION_ID}` },
      { "pre_parallel3_1": `v.animate_pre_parallel3 == ${DEFAULT_ANIMATION_ID}` },
      { "pre_parallel4_1": `v.animate_pre_parallel4 == ${DEFAULT_ANIMATION_ID}` },
      { "pre_parallel5_1": `v.animate_pre_parallel5 == ${DEFAULT_ANIMATION_ID}` },
      { "pre_parallel6_1": `v.animate_pre_parallel6 == ${DEFAULT_ANIMATION_ID}` },
      { "pre_parallel7_1": `v.animate_pre_parallel7 == ${DEFAULT_ANIMATION_ID}` }
    ],
  },
  // 追加到模板的 animations 上
  animations: {
    "blink": "animation.touhou_little_maid.basic.blink",
    "walk": "animation.touhou_little_maid.basic.walk",
    "beg": "animation.touhou_little_maid.maid.beg",
    "sit": "animation.touhou_little_maid.maid.sit",
    // 兜底动画：由内置源文件转换，键名 animation.tlm.skin_pack.<DEFAULT_ANIMATION_ID>.<type>
    "hug_1": buildSkinPackAnimationName(DEFAULT_ANIMATION_ID, AnimationTypes.hug),
    "gecko_hug_base": "animation.touhou_little_maid.maid.hug_gecko_base", // 抵消鹦鹉座位偏移
    "walk_1": buildSkinPackAnimationName(DEFAULT_ANIMATION_ID, AnimationTypes.walk),
    "beg_1": buildSkinPackAnimationName(DEFAULT_ANIMATION_ID, AnimationTypes.beg),
    "sit_1": buildSkinPackAnimationName(DEFAULT_ANIMATION_ID, AnimationTypes.sit),
    "idle_1": buildSkinPackAnimationName(DEFAULT_ANIMATION_ID, AnimationTypes.idle),
    "parallel0_1": buildSkinPackAnimationName(DEFAULT_ANIMATION_ID, AnimationTypes.parallel0),
    "parallel1_1": buildSkinPackAnimationName(DEFAULT_ANIMATION_ID, AnimationTypes.parallel1),
    "parallel2_1": buildSkinPackAnimationName(DEFAULT_ANIMATION_ID, AnimationTypes.parallel2),
    "parallel3_1": buildSkinPackAnimationName(DEFAULT_ANIMATION_ID, AnimationTypes.parallel3),
    "pre_parallel0_1": buildSkinPackAnimationName(DEFAULT_ANIMATION_ID, AnimationTypes.pre_parallel0),
    "pre_parallel1_1": buildSkinPackAnimationName(DEFAULT_ANIMATION_ID, AnimationTypes.pre_parallel1),
    "pre_parallel2_1": buildSkinPackAnimationName(DEFAULT_ANIMATION_ID, AnimationTypes.pre_parallel2),
    "pre_parallel3_1": buildSkinPackAnimationName(DEFAULT_ANIMATION_ID, AnimationTypes.pre_parallel3),
    "pre_parallel4_1": buildSkinPackAnimationName(DEFAULT_ANIMATION_ID, AnimationTypes.pre_parallel4),
    "pre_parallel5_1": buildSkinPackAnimationName(DEFAULT_ANIMATION_ID, AnimationTypes.pre_parallel5),
    "pre_parallel6_1": buildSkinPackAnimationName(DEFAULT_ANIMATION_ID, AnimationTypes.pre_parallel6),
    "pre_parallel7_1": buildSkinPackAnimationName(DEFAULT_ANIMATION_ID, AnimationTypes.pre_parallel7),
  },
  // 占位
  animationList: {},
};
