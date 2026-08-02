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
      `v.animate_walk = 0;`,
      `v.animate_beg = 0;`,
      `v.animate_sit = 0;`,
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
      { "sit": "v.animate_sit == 0 && !q.is_in_ui && query.property('thlm:is_sitting')" },
      // 默认动画由主资源包提供，命名与转换动画一致
      { "walk_1": `v.animate_walk == ${DEFAULT_ANIMATION_ID} && !query.property('thlm:is_sitting')` },
      { "beg_1": `v.animate_beg == ${DEFAULT_ANIMATION_ID} && query.is_interested` },
      { "sit_1": `v.animate_sit == ${DEFAULT_ANIMATION_ID} && !q.is_in_ui && query.property('thlm:is_sitting')` }
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
    "sit": "animation.touhou_little_maid.maid.sit",
    // 默认 walk/beg/sit：主资源包按 animation.tlm.skin_pack.<DEFAULT_ANIMATION_ID>.<type> 提供
    "walk_1": buildSkinPackAnimationName(DEFAULT_ANIMATION_ID, AnimationTypes.walk),
    "beg_1": buildSkinPackAnimationName(DEFAULT_ANIMATION_ID, AnimationTypes.beg),
    "sit_1": buildSkinPackAnimationName(DEFAULT_ANIMATION_ID, AnimationTypes.sit),
  },
  animationList: {},
};
