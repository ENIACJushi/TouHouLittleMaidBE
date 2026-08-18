import {
  DEFAULT_ANIMATION_ID,
  WALK_PROCESS_MOVING_MIN,
} from "./Constants";
import {buildSkinPackAnimationName} from "../animation/default/DefaultGeckoAnimation";
import {AnimationTypes} from "../animation/types/AnimationTypes";
import {AnimationDefinition} from "../animation/MaidAnimationConvertor";

/**
 * 动画定义基础模板，导出的定义在此基础上生成
 */
export const ANIMATION_DEF_TEMPLATE: AnimationDefinition = {
  scripts: {
    scale: "query.property('thlm:scale') * v.scale",
    /**
     * 实体加载时执行一次。动态 keep 变量的默认 0 会追加到这里。
     */
    initialize: [
      // 表情：默认 0；坐下等动画 timeline 的 random 只在进入时掷一次，故不在此每帧清零
      "v.biaoqing=0;",
    ],
    /**
     * 添加变量时，需要同步加进白名单 `src/convertor/molang/v/VariableResolvers.ts`
     */
    pre_animation: [
      // 特殊行走动画属性
      "variable.walk_process = Math.min(1, Math.abs(query.modified_move_speed / 0.9));",
      // 行走式中的除数；原版实体动画通常预置为 1（须在 tcos0 之前）
      "variable.gliding_speed_value = 1;",
      // 基础动画
      "variable.tcos0 = (Math.cos(query.modified_distance_moved * 38.17) * query.modified_move_speed / variable.gliding_speed_value) * 28.65;",
      "variable.emote_index=Math.mod(query.property('thlm:emote'),1000);",
      "variable.emote_frame=Math.max(1, Math.mod( Math.floor(query.property('thlm:emote')/1000), 1000) );",
      "variable.emote_speed=Math.max(1, Math.floor(query.property('thlm:emote')/1000000) );",

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
      // 眨眼动画开关；gecko 模型在展示条件中覆写为 0
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
    should_update_bones_and_effects_offscreen: true,
    animate: [
      "backpack_offset",
      "wing",
      "emote",
      { "statue_base": "(q.property('thlm:work') >= -4) && (q.property('thlm:work') <= -2)" },
      { "look_at_target": "!v.tlm_is_hug" },
      { "blink" : "v.animate_blink == 0 && query.property('thlm:work') >= -1" },
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
  animations: {
    "backpack_offset": "animation.touhou_little_maid.maid.backpack_offset",
    "wing": "animation.touhou_little_maid.basic.wing",
    "emote": "animation.touhou_little_maid.emote",
    "statue_base": "animation.touhou_little_maid.statue_base",
    "look_at_target": "animation.touhou_little_maid.maid.look_at_target",
    "hug": "animation.touhou_little_maid.maid.hug",

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
  // 用到的所有动画
  animationList: {},
};
