import {DEFAULT_ANIMATION_ID} from "./Constants";
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
     * 添加变量时，需要同步加进白名单 `src/convertor/molang/v/VariableResolvers.ts`
     */
    pre_animation: [
      // 特殊行走动画属性
      "variable.walk_process = Math.min(1, Math.abs(query.modified_move_speed / 0.9));",
      // 基础动画
      "variable.tcos0 = (Math.cos(query.modified_distance_moved * 38.17) * query.modified_move_speed / variable.gliding_speed_value) * 28.65;",
      "variable.emote_index=Math.mod(query.property('thlm:emote'),1000);",
      "variable.emote_frame=Math.max(1, Math.mod( Math.floor(query.property('thlm:emote')/1000), 1000) );",
      "variable.emote_speed=Math.max(1, Math.floor(query.property('thlm:emote')/1000000) );",

      "v.biaoqing = 0;", // 表情当前未实现，置0
      // 默认使用主资源包默认动画（id 见 DEFAULT_ANIMATION_ID）
      "v.scale = 1;", // 缩放
      `v.animate_blink = 1;`, // 眨眼动画，目前仅非 geck 模型会使用专门的眨眼动画 todo 为了便于测试，这里设为1了
      `v.animate_walk = 0;`,
      `v.animate_beg = 0;`,
      `v.animate_sit = 0;`,
      `v.animate_parallel0 = 0;`,
      `v.animate_parallel1 = 0;`,
      `v.animate_parallel2 = 0;`,
      `v.animate_parallel3 = 0;`,
      `v.animate_pre_parallel0 = 0;`,
      `v.animate_pre_parallel1 = 0;`,
      `v.animate_pre_parallel2 = 0;`,
      `v.animate_pre_parallel3 = 0;`,
      `v.animate_pre_parallel4 = 0;`,
      `v.animate_pre_parallel5 = 0;`,
      `v.animate_pre_parallel6 = 0;`,
      `v.animate_pre_parallel7 = 0;`,
      // 眨眼：每 100~200 次循环闭眼一次，持续 20 次循环
      "v.ysm_blink_timer = (v.ysm_blink_timer ?? Math.random(100, 200)) - 1;",
      "v.ysm_is_close_eyes = v.ysm_blink_timer <= 0 && v.ysm_blink_timer > -20;",
      "v.ysm_blink_timer = v.ysm_blink_timer <= -20 ? Math.random(100, 200) : v.ysm_blink_timer;",
    ],
    should_update_bones_and_effects_offscreen: true,
    animate: [
      "backpack_offset",
      "wing",
      "emote",
      { "statue_base": "(q.property('thlm:work') >= -4) && (q.property('thlm:work') <= -2)" },
      { "look_at_target": "!query.property('thlm:is_hug')" },
      { "hug": "!q.is_in_ui && query.property('thlm:is_hug')" },

      { "blink" : "v.animate_blink === 0 && query.property('thlm:work') >= -1" },
      { "walk": "v.animate_walk == 0 && !query.property('thlm:is_sitting')" },
      { "beg": "v.animate_beg == 0 && query.is_interested" },
      { "sit": "v.animate_sit == 0 && !q.is_in_ui && query.property('thlm:is_sitting')" },
      // 默认动画由主资源包提供，命名与转换动画一致
      { "walk_1": `v.animate_walk == ${DEFAULT_ANIMATION_ID} && !query.property('thlm:is_sitting')` },
      { "beg_1": `v.animate_beg == ${DEFAULT_ANIMATION_ID} && query.is_interested` },
      { "sit_1": `v.animate_sit == ${DEFAULT_ANIMATION_ID} && !q.is_in_ui && query.property('thlm:is_sitting')` },
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
    "look_at_target": "animation.common.look_at_target",
    "hug": "animation.touhou_little_maid.maid.hug",

    "blink": "animation.touhou_little_maid.basic.blink",
    "walk": "animation.touhou_little_maid.basic.walk",
    "beg": "animation.touhou_little_maid.maid.beg",
    "sit": "animation.touhou_little_maid.maid.sit",
    // 默认 walk/beg/sit：主资源包按 animation.tlm.skin_pack.<DEFAULT_ANIMATION_ID>.<type> 提供
    "walk_1": buildSkinPackAnimationName(DEFAULT_ANIMATION_ID, AnimationTypes.walk),
    "beg_1": buildSkinPackAnimationName(DEFAULT_ANIMATION_ID, AnimationTypes.beg),
    "sit_1": buildSkinPackAnimationName(DEFAULT_ANIMATION_ID, AnimationTypes.sit),
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
