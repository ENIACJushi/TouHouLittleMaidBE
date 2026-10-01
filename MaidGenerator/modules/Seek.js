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
 * 精准目标 Seek 枚举（Task6 Phase 1 + Task7 追逐分离）。
 * 使用场景：生成 `slot:seek_<n>`（仅索敌）与独立追逐组（终点 / 途经可换）。
 * 定稿：档内仅 NAT；追逐由脚本另调。
 */
export class Seek {
  /**
   * @param {import('../main.js').MaidGenerator} g
   */
  static process(g) {
    console.log(
      `添加精准目标 Seek: 0~${END_INDEX}；追逐 ${SEEK_PURSUE} / ${SEEK_PURSUE_VIA}`
    );

    g.addProperty("thlm:seek_index", {
      type: "int",
      client_sync: true,
      default: -1,
      range: [-1, END_INDEX],
    });

    // 终点追逐：带触及半径，到终点附近即可停
    g.addComponentGroup(SEEK_PURSUE, {
      "minecraft:behavior.ranged_attack": {
        priority: 6,
        attack_interval_min: 0.8,
        attack_interval_max: 0.8,
        attack_radius: 2.1,
        attack_radius_min: 0.9,
      },
    });
    // 途经追逐：触及=0，中间路点要贴紧再切下一段
    g.addComponentGroup(SEEK_PURSUE_VIA, {
      "minecraft:behavior.ranged_attack": {
        priority: 6,
        attack_interval_min: 0.8,
        attack_interval_max: 0.8,
        attack_radius: 0,
        attack_radius_min: 0,
      },
    });

    // 挂终点：卸途经，避免双追逐
    g.addEvent(SEEK_PURSUE, {
      sequence: [
        { remove: { component_groups: [SEEK_PURSUE_VIA] } },
        { add: { component_groups: [SEEK_PURSUE] } },
      ],
    });
    // 挂途经：卸终点
    g.addEvent(SEEK_PURSUE_VIA, {
      sequence: [
        { remove: { component_groups: [SEEK_PURSUE] } },
        { add: { component_groups: [SEEK_PURSUE_VIA] } },
      ],
    });
    // 卸追逐：两种一并卸（teardown / 换实现前清理）
    g.addEvent(`${SEEK_PURSUE}_quit`, {
      remove: { component_groups: [SEEK_PURSUE, SEEK_PURSUE_VIA] },
    });
    g.addEvent(`${SEEK_PURSUE_VIA}_quit`, {
      remove: { component_groups: [SEEK_PURSUE, SEEK_PURSUE_VIA] },
    });

    for (let i = 0; i <= END_INDEX; i++) {
      const groupName = `slot:seek_${i}`;
      const quitName = `slot:seek_${i}_quit`;

      g.addComponentGroup(groupName, {
        "minecraft:follow_range": { max: 32, value: 32 },
        "minecraft:behavior.nearest_attackable_target": {
          priority: 7,
          must_reach: true,
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
      });

      // 装载：只加本档 NAT（追逐另由脚本 mountPursue）
      g.addEvent(groupName, {
        sequence: [
          { add: { component_groups: [groupName] } },
          { set_property: { "thlm:seek_index": i } },
        ],
      });

      g.addEvent(quitName, {
        sequence: [
          { remove: { component_groups: [groupName] } },
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
