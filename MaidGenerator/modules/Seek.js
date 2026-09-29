/** Seek 容量：档位 0..255（共 256） */
const END_INDEX = 255;

/**
 * 精准目标 Seek 枚举（Task6 Phase 1）。
 * 使用场景：生成 `slot:seek_<n>` / `_quit` 与 `api:reset_target`；脚本门面（Phase 2）再接线。
 * 定稿依据 Phase0：组内仅索敌；`reevaluate_description` + `persist_time:0`；quit 内叠加 `reset_target`。
 */
export class Seek {
  /**
   * @param {import('../main.js').MaidGenerator} g
   */
  static process(g) {
    console.log(`添加精准目标 Seek: 0~${END_INDEX}`);
    // 当前挂载档；-1 表示未挂 Seek（脚本/验收观测用）
    g.addProperty("thlm:seek_index", {
      type: "int",
      client_sync: true,
      default: -1,
      range: [-1, END_INDEX],
    });

    for (let i = 0; i <= END_INDEX; i++) {
      const groupName = `slot:seek_${i}`;
      const quitName = `slot:seek_${i}_quit`;

      // 仅索敌：不捆绑攻击；must_reach 留给日后农作接入
      g.addComponentGroup(groupName, {
        "minecraft:follow_range": { max: 32, value: 32 },
        "minecraft:behavior.nearest_attackable_target": {
          priority: 7,
          must_reach: true,
          must_see: false,
          persist_time: 0,
          reselect_targets: false,
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

      // 装载：只加本组。切换档位前须先 quit（避免多档 NAT 叠挂）
      g.addEvent(groupName, {
        sequence: [
          { add: { component_groups: [groupName] } },
          { set_property: { "thlm:seek_index": i } },
        ],
      });

      // 卸载：卸组 + 清 index + reset_target（Phase0：仅卸组会残留仇恨）
      g.addEvent(quitName, {
        sequence: [
          { remove: { component_groups: [groupName] } },
          { set_property: { "thlm:seek_index": -1 } },
          { reset_target: {} },
        ],
      });
    }

    // 独立清恨：保留 Seek 组时也可由脚本调用（stamp/release 等）
    g.addEvent("api:reset_target", {
      reset_target: {},
    });
  }
}
