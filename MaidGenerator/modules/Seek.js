const END_INDEX = 300;

/**
 * 女仆目标搜寻枚举
 */
export class Seek {
  /**
   * @param {MaidGenerator} g
   */
  static process(g) {
    console.log(`添加目标搜寻枚举: 0~${END_INDEX}`);
    // 属性值
    g.addProperty(
      'thlm:seek_index',
      {"type": "int", "client_sync": true, "default": -1, "range": [-1, END_INDEX]}
    );
    // 组件组
    for (let i = 0; i <= END_INDEX; i++) {
      // 组件组
      g.addComponentGroup(`seek:${i}`, {
        "minecraft:follow_range": { "max": 32, "value": 32 },
        "minecraft:behavior.nearest_attackable_target": {
          "priority": 7, "must_reach": true, "must_see": false, "persist_time": 5.0,
          "reselect_targets": false, "within_radius": 32, "scan_interval": 20,
          "entity_types": [ {
            "filters": {
              "test": "int_property", "domain": "thlmt:value", "subject": "other", "value": i
            },
            "max_dist": 32,
            "must_see": false
          } ]
        },
        "minecraft:behavior.ranged_attack": {
          "priority": 6,
          "attack_interval_min": 0.8,
          "attack_interval_max": 0.8,
          "attack_radius": 2.1,
          "attack_radius_min": 0.9
        }
      });
      // 添加组件组
      g.addEvent(`tlm_seek:enter_${i}`, {
        "sequence": [
          {
            "add": {
              "component_groups": [
                `seek:${i}`
              ]
            }
          },
          {
            "set_property":{
              "thlm:seek_index": i
            }
          }
        ]
      });
      // 移除组件组
      g.addEvent(`tlm_seek:quit_${i}`, {
        "sequence": [
          {
            "remove": {
              "component_groups": [
                `seek:${i}`
              ]
            },
            "set_property":{ "thlm:seek_index": -1 }
          }
        ]
      });
    }
  }
}