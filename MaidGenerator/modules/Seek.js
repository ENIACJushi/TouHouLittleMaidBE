/** Seek 容量：档位 0..255（共 256） */
const END_INDEX = 255;

/**
 * 默认追逐组件组（历史每档内 short ranged_attack；Task6 从档内剥离）。
 * 使用场景：仅由脚本 `slot:seek_pursue` / `_quit` 挂卸，不与 slot:seek_n 绑定。
 */
const SEEK_PURSUE = "slot:seek_pursue";

/**
 * 精准目标 Seek 枚举（Task6 Phase 1 + Task7 追逐分离）。
 * 使用场景：生成 `slot:seek_<n>`（仅索敌）与独立 `slot:seek_pursue`（可换其它追逐实现）。
 * 定稿：档内仅 NAT；追逐由脚本另调，便于换 melee / move_towards 等。
 */
export class Seek {
  /**
   * @param {import('../main.js').MaidGenerator} g
   */
  static process(g) {
    console.log(`添加精准目标 Seek: 0~${END_INDEX}；追逐组 ${SEEK_PURSUE}（脚本单独挂）`);

    g.addProperty("thlm:seek_index", {
      type: "int",
      client_sync: true,
      default: -1,
      range: [-1, END_INDEX],
    });

    // 默认追逐（与删前配置一致）；后续可再加 slot:seek_pursue_* 变体，由脚本选挂
    g.addComponentGroup(SEEK_PURSUE, {
      "minecraft:behavior.ranged_attack": {
        priority: 6,
        attack_interval_min: 0.8,
        attack_interval_max: 0.8,
        attack_radius: 2.1,
        attack_radius_min: 0.9,
      },
    });
    g.addEvent(SEEK_PURSUE, {
      add: { component_groups: [SEEK_PURSUE] },
    });
    g.addEvent(`${SEEK_PURSUE}_quit`, {
      remove: { component_groups: [SEEK_PURSUE] },
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
