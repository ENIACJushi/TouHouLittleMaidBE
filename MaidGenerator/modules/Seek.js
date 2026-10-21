/** Seek 容量：档位 0..255（共 256） */
const END_INDEX = 255;

/**
 * 终点追逐：短距 ranged_attack，有触及距离（历史默认）。
 * 使用场景：路径终点路点；脚本 `slot:seek_pursue` 挂载。
 */
const SEEK_PURSUE = "slot:seek_pursue";

/**
 * 途经追逐：触及定死为 0，迫使贴着路点走完，头部平视途经 marker。
 * 使用场景：寻路过程中的中间路点；与终点追逐互斥，脚本 `slot:seek_pursue_via` 挂载。
 */
const SEEK_PURSUE_VIA = "slot:seek_pursue_via";

/**
 * 脚本代理目视：仅 look_at_target（look），无 move/jump。
 * 使用场景：冲量代理段挂载；与追逐组互斥；脚本 `slot:seek_look`。
 */
const SEEK_LOOK = "slot:seek_look";

/**
 * 构造某一 Seek 档的 NAT（仅 must_reach 不同）。
 * 使用场景：严格档（原版寻路）/ 宽松档（脚本寻路）。
 * @param {number} i seekId
 * @param {boolean} mustReach
 */
function makeNat(i, mustReach) {
  return {
    "minecraft:follow_range": { max: 32, value: 32 },
    "minecraft:behavior.nearest_attackable_target": {
      priority: 7,
      must_reach: mustReach,
      must_see: false,
      persist_time: 0,
      reselect_targets: true,
      within_radius: 32,
      scan_interval: 10,
      entity_types: [
        {
          filters: {
            test: "int_property",
            domain: "thlmt:value",
            subject: "other",
            value: i,
          },
          max_dist: 32,
          must_see: false,
          reevaluate_description: true,
        },
      ],
    },
  };
}

/**
 * 精准目标 Seek 枚举（Task6 Phase 1 + Task7 追逐分离）。
 * 使用场景：生成 `slot:seek_<n>`（严格 NAT）与 `slot:seek_<n>_soft`（宽松 NAT）；
 * 追逐 / 目视另挂。原版寻路 must_reach=true；脚本寻路切 soft=false。
 */
export class Seek {
  /**
   * @param {import('../main.js').MaidGenerator} g
   */
  static process(g) {
    console.log(
      `添加精准目标 Seek: 0~${END_INDEX}（严格+soft）；追逐 ${SEEK_PURSUE} / ${SEEK_PURSUE_VIA}；目视 ${SEEK_LOOK}`
    );

    g.addProperty("thlm:seek_index", {
      type: "int",
      client_sync: true,
      default: -1,
      range: [-1, END_INDEX],
    });

    // 终点追逐：带触及半径，到终点附近即可停
    g.addComponentGroup(SEEK_PURSUE, {
      // "minecraft:behavior.ranged_attack": {
      //   priority: 6,
      //   attack_interval_min: 0.8,
      //   attack_interval_max: 0.8,
      //   attack_radius: 2.1,
      //   attack_radius_min: 0.9,
      // },

      // 使用远攻组件会导致女仆在越过沟后短暂的往回走而掉下沟，使用近战就不会出现这种问题
      "minecraft:behavior.melee_attack": {
        "priority": 6,
        "reach_multiplier": 10, // 实体半径（0.3）×reach_multiplier=实际距离(3)
        "cooldown_time": 0.8,
        "control_flags": [ "move", "jump" ]
      },
      // 保证在索敌失效时也能看向目标
      "minecraft:behavior.look_at_target": {
        priority: 6,
        look_distance: 32,
        probability: 1,
        control_flags: [ "look" ],
      },
    });
    // 途经追逐：触及=0，中间路点要贴紧再切下一段
    g.addComponentGroup(SEEK_PURSUE_VIA, {
      // "minecraft:behavior.ranged_attack": {
      //   priority: 6,
      //   attack_interval_min: 0.8,
      //   attack_interval_max: 0.8,
      //   attack_radius: 0,
      //   attack_radius_min: 0,
      // },
      // 使用远攻组件会导致女仆在越过沟后短暂的往回走而掉下沟，使用近战就不会出现这种问题
      "minecraft:behavior.melee_attack": {
        "priority": 6,
        "reach_multiplier": 0,
        "cooldown_time": 0.8,
        "control_flags": [ "move", "jump" ]
      },
      // 保证在索敌失效时也能看向目标
      "minecraft:behavior.look_at_target": {
        priority: 6,
        look_distance: 32,
        probability: 1,
        control_flags: [ "look" ],
      },
    });

    // 脚本代理目视（仅转头）
    g.addComponentGroup(SEEK_LOOK, {
      "minecraft:behavior.look_at_target": {
        priority: 6,
        look_distance: 32,
        probability: 1,
        control_flags: ["look"],
      },
    });
    // 挂目视：卸两种追逐，避免与 melee/move 叠层
    g.addEvent(SEEK_LOOK, {
      sequence: [
        { remove: { component_groups: [SEEK_PURSUE, SEEK_PURSUE_VIA] } },
        { add: { component_groups: [SEEK_LOOK] } },
      ],
    });
    g.addEvent(`${SEEK_LOOK}_quit`, {
      remove: { component_groups: [SEEK_LOOK] },
    });

    // 挂终点：卸途经 + 目视，避免双追逐 / 双 look
    g.addEvent(SEEK_PURSUE, {
      sequence: [
        { remove: { component_groups: [SEEK_PURSUE_VIA, SEEK_LOOK] } },
        { add: { component_groups: [SEEK_PURSUE] } },
      ],
    });
    // 挂途经：卸终点 + 目视
    g.addEvent(SEEK_PURSUE_VIA, {
      sequence: [
        { remove: { component_groups: [SEEK_PURSUE, SEEK_LOOK] } },
        { add: { component_groups: [SEEK_PURSUE_VIA] } },
      ],
    });
    // 卸追逐：两种一并卸（teardown / 换实现前清理）；不卸目视（由 quitLook 管）
    g.addEvent(`${SEEK_PURSUE}_quit`, {
      remove: { component_groups: [SEEK_PURSUE, SEEK_PURSUE_VIA] },
    });
    g.addEvent(`${SEEK_PURSUE_VIA}_quit`, {
      remove: { component_groups: [SEEK_PURSUE, SEEK_PURSUE_VIA] },
    });

    for (let i = 0; i <= END_INDEX; i++) {
      const groupName = `slot:seek_${i}`;
      const softName = `slot:seek_${i}_soft`;
      const quitName = `slot:seek_${i}_quit`;

      // 原版寻路：must_reach true → 选不中/丢目标可作失败信号
      g.addComponentGroup(groupName, makeNat(i, true));
      // 脚本寻路：must_reach false → 无通路也能盯着 stamp 目标
      g.addComponentGroup(softName, makeNat(i, false));

      // 装载严格档（默认 mount）；卸 soft 防双 NAT
      g.addEvent(groupName, {
        sequence: [
          { remove: { component_groups: [softName] } },
          { add: { component_groups: [groupName] } },
          { set_property: { "thlm:seek_index": i } },
        ],
      });
      // 切宽松档（脚本段）；卸严格组
      g.addEvent(softName, {
        sequence: [
          { remove: { component_groups: [groupName] } },
          { add: { component_groups: [softName] } },
          { set_property: { "thlm:seek_index": i } },
        ],
      });

      g.addEvent(quitName, {
        sequence: [
          { remove: { component_groups: [groupName, softName] } },
          { set_property: { "thlm:seek_index": -1 } },
          { reset_target: {} },
        ],
      });
    }

    g.addEvent("api:reset_target", {
      reset_target: {},
    });
  }
}
