
/**
 * 动画相关模板，因为需要覆盖主包动画，这里会定义一些主包的基础值
 */
export namespace AnimationTemplates {
  const scripts =  {
    "scale": "query.property('thlm:scale') * v.scale",
    "pre_animation": [
      // 基础参数
      "variable.tcos0 = (Math.cos(query.modified_distance_moved * 38.17) * query.modified_move_speed / variable.gliding_speed_value) * 28.65;",
      "variable.emote_index=Math.mod(query.property('thlm:emote'),1000);",
      "variable.emote_frame=Math.max(1, Math.mod( Math.floor(query.property('thlm:emote')/1000), 1000) );",
      "variable.emote_speed=Math.max(1, Math.floor(query.property('thlm:emote')/1000000) );",
      // 模型包可变参数
      "v.scale = 1;", // 缩放
      "v.animate_walk = 0;",
      "v.animate_beg = 0;",
      "v.animate_sit = 0;"
    ],
    "should_update_bones_and_effects_offscreen": true,
    "animate": [
      // 基础动画
      "backpack_offset",
      {"blink" : "query.property('thlm:work') >= -1"},
      {"look_at_target": "!query.property('thlm:is_hug')"},
      {"statue_base": "(q.property('thlm:work') >= -4) && (q.property('thlm:work') <= -2)"},
      "wing",
      "emote",

      // 模型包可变动画
      {"walk" : "v.animate_walk==0 && !query.property('thlm:is_sitting')"},
      "beg",
      { "controller_sit": "q.property('thlm:skin_pack')!=1001" },
      { "controller_sit_pack1": "q.property('thlm:skin_pack')==1001" }
    ]
  }
}
