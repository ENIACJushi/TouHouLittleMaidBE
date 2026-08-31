/**
 * 女仆生成原始文件
 **/
export let TEMPLATE = {
  "format_version": "1.18.10",
  "minecraft:entity": {
    "description": {
      "identifier": "thlmm:maid", "is_spawnable": true, "is_summonable": true, "is_experimental": false,
      "properties": {
        // 家模式
        "thlm:home": {"type": "bool", "default": false, "client_sync": true},
        // 工作模式
        "thlm:work" : {"type": "int", "default": 0, "range":[-20, 20], "client_sync": true},
        // 模型包
        "thlm:skin_pack"  : {"type": "int", "default": -1, "range":[-1, 99999], "client_sync": true},
        // 背包
        "thlm:backpack_type"     :{"type": "int" , "default": 0    , "range":[0,3], "client_sync": true},
        "thlm:backpack_invisible":{"type": "bool", "default": false, "client_sync": true},
        // 压缩位标志：bit0 坐下 / bit1 抱起 / bit2 睡觉 / bit3~7 food_level（0~20，默认 20）
        "thlm:anim": {"type": "int", "default": 160, "range": [0, 255], "client_sync": true},
        // 表情
        "thlm:emote"             :{"type": "int", "client_sync": true, "default": 0, "range": [0, 2147483647]},
        // 环境
        "environment:temperature" :{"type": "int", "client_sync": true, "default": 0 , "range": [0, 5]}, // 0 正常  0 海  1 冷  2 热
        "environment:weather"     :{"type": "int", "client_sync": true, "default": 0 , "range": [0, 5]}, // 0 无天气  1 雨  1 雷电  2 雪
        "environment:daytime"     :{"type": "int", "client_sync": true, "default": -1, "range": [-1, 1]}, // 为了在生成时发出声音，默认设为-1
        // 缩放大小 仅用于雕塑
        "thlm:scale": {"type": "float", "client_sync": true, "default": 1.01, "range": [-0.1, 999.1]}
      }
    },
    "component_groups": {
      "despawn":{ "minecraft:instant_despawn":{ "remove_child_entities": false } },
      "init_failed": {
        "minecraft:ageable": {
          "duration": 2,
          "grow_up": {
            "event": "init_failed",
            "target": "self"
          }
        }
      },
      ///////// 女仆属性 /////////
      ///// 基础属性 /////
      "thlmm:maid_basic":{
        "minecraft:timer": {
          "time": 3,
          "looping": true,
          "time_down_event": {
            "event": "thlmm:t",
            "target": "self"
          }
        },
        "minecraft:behavior.float": { "priority": 2 },
        // TODO: 潜水逻辑
        // "minecraft:inside_block_notifier": {
        //   "block_list": [
        //     {
        //       "block": {
        //         "name":  "minecraft:water"
        //       },
        //       "entered_block_event": {
        //         "event": "enter_swim",
        //         "target": "self"
        //       },
        //       "exited_block_event": {
        //         "event": "enter_swim",
        //         "target": "self"
        //       }
        //     }
        //   ]
        // },
        "minecraft:underwater_movement": {
          "value": 0.06
        },
        ///// 基础属性 /////
        "minecraft:nameable"     : { "always_show": false, "allow_name_tag_renaming": false },
        "minecraft:health"       : { "value": 64, "max": 64 },
        "minecraft:type_family"  : { "family": [ "maid", "mob" ] },
        "minecraft:collision_box": { "width": 0.6, "height": 1.5 },
        "minecraft:loot"         : { "table": "loot_tables/empty.json" },
        "minecraft:on_death"     : { "event": "thlmm:d", "target": "self" },
        // 移速数值由脚本 EntityMaid.Movement / Level.properties.movement 写入，此处仅注册组件
        "minecraft:movement"     : { "value": 0 },
        "minecraft:physics"      : { },
        "minecraft:pushable"     : { "is_pushable": true, "is_pushable_by_piston": true },
        "minecraft:attack"       : { "damage": 6 },
        "minecraft:balloonable"  : { "mass": 0.8 },
        "minecraft:breathable"   : { "total_supply": 15, "suffocate_time": 0 },
        "minecraft:is_hidden_when_invisible": { },
        "minecraft:conditional_bandwidth_optimization": { },
        // 占用 look/move，看向玩家时打断 random_stroll
        "minecraft:behavior.look_at_player": { "priority": 7, "look_distance": 6.0, "look_time": [ 2, 4 ], "probability": 0.03, "control_flags": [ "look", "move" ] },

        ///// 交互属性 /////
        "minecraft:healable": {
          "items": [
            {"item": "cake", "heal_amount": 20},
            {"item": "apple", "heal_amount": 3}
          ]
        },
        // 占用 look/move，打断 random_stroll
        "minecraft:behavior.beg": { "priority": 7, "look_distance": 8, "look_time": [ 15, 30 ], "items": [ "cake" ], "control_flags": [ "look", "move" ] },

        ///// AI属性 /////

        "minecraft:behavior.hurt_by_target": { "priority": 4 }
      },
      // 站起时移动属性
      "thlmm:maid_basic_stand_movement":{
        "minecraft:collision_box": { "width": 0.6, "height": 1.5 },
        "minecraft:water_movement": { "drag_factor": 0.9 },
        "minecraft:jump.static": { },
        "minecraft:can_climb": { },
        "minecraft:navigation.walk": {
          "can_path_over_water": true,
          "avoid_damage_blocks": true,
          "avoid_water": true,
          "avoid_portals": true
        },
        "minecraft:movement.basic": { },
        "minecraft:behavior.mount_pathing": {
          "priority": 3,
          "speed_multiplier": 1.25,
          "target_dist": 0,
          "track_target": true
        },
        "minecraft:behavior.random_stroll": {
          "priority": 8,
          "speed_multiplier": 1.0
        }
      },
      // 坐下时移动属性
      "thlmm:maid_basic_sit_movement":{
        "minecraft:collision_box": { "width": 0.6, "height": 1.15 },
        "minecraft:navigation.walk": {
          "can_walk": false
        },
        "minecraft:behavior.random_stroll": {
          "priority": 0,
          "speed_multiplier": 0.0
        },
        "minecraft:movement.basic": { },
        "minecraft:behavior.mount_pathing": {
          "priority": 3,
          "speed_multiplier": 0.0,
          "target_dist": 0,
          "track_target": true
        }
      },
      // 抱起时移动属性 其实是取消碰撞箱
      "thlmm:maid_basic_hug_movement":{
        "minecraft:collision_box": { "width": 0, "height": 0 },
        "minecraft:navigation.walk": {
          "can_walk": false
        },
        "minecraft:behavior.random_stroll": {
          "priority": 8,
          "speed_multiplier": 0.0
        },
        "minecraft:movement.basic": { },
        "minecraft:behavior.mount_pathing": {
          "priority": 3,
          "speed_multiplier": 0.0,
          "target_dist": 0,
          "track_target": true
        }
      },
      // 正常跟随（站立）
      "status:follow_standard":{
        "minecraft:behavior.follow_owner": {
          "priority": 6,
          "speed_multiplier": 1.4,
          "start_distance": 10,
          "stop_distance": 3,
          "can_teleport": true
        }
      },
      // 正常跟随（坐下）
      "status:follow_sit":{
        "minecraft:behavior.follow_owner": {
          "priority": 6,
          "speed_multiplier": 0.0,
          "start_distance": 10,
          "stop_distance": 3,
          "can_teleport": false
        }
      },

      "thlmm:maid_wild": {
        "minecraft:behavior.panic": { "priority": 1, "speed_multiplier": 1.25 },
        "minecraft:tameable": {
          "probability": 1.0,
          "tame_items": "cake",
          "tame_event": {
            "event": "thlmm:f",
            "target": "self"
          }
        }
      },
      // 野生女仆
      "thlmm:maid_tame": {
        "minecraft:tameable": {
          "probability": 1.0,
          "tame_items": []
        },
        "minecraft:is_tamed": {},
        "minecraft:interact": {
          "interactions": [
            // 相机
            {
              "cooldown": 2.5,
              "use_item": false,
              "hurt_item": 1,
              "interact_text": "action.interact.camera",
              "vibration": "none",
              "on_interact": {
                "filters": {
                  "all_of": [
                    { "test": "has_equipment", "subject": "other", "domain": "hand", "value": "touhou_little_maid:camera"},
                    { "test": "is_family", "subject": "other", "value": "player" },
                    { "test": "is_owner", "subject": "other", "value": true }
                  ]
                },
                "event": "thlmm:p",
                "target": "self"
              }
            },
            // 魂符
            {
              "cooldown": 2.5,
              "use_item": false,
              "interact_text": "action.interact.smart_slab",
              "vibration": "none",
              "on_interact": {
                "filters": {
                  "all_of": [
                    { "test": "has_equipment", "subject": "other", "domain": "hand", "value": "touhou_little_maid:smart_slab_empty"},
                    { "test": "is_family", "subject": "other", "value": "player" },
                    { "test": "is_owner", "subject": "other", "value": true }
                  ]
                },
                "event": "thlmm:1",
                "target": "self"
              }
            },
            // 鞍(抱起)
            {
              "cooldown": 1.5,
              "use_item": false,
              "interact_text": "action.interact.tlm.hug",
              "vibration": "none",
              "on_interact": {
                "filters": {
                  "all_of": [
                    { "test": "has_equipment", "subject": "other", "domain": "hand", "value": "minecraft:saddle"},
                    { "test": "is_family", "subject": "other", "value": "player" },
                    { "test": "is_owner", "subject": "other", "value": true }
                  ]
                },
                "event": "thlmm:j",
                "target": "self"
              }
            },
            // 转化为 NPC
            {
              "cooldown": 2.5,
              "use_item": false,
              "interact_text": "action.interact.thlm.npc",
              "vibration": "none",
              "on_interact": {
                "filters": {
                  "all_of": [
                    { "test": "has_equipment", "subject": "other", "domain": "hand", "value": "touhou_little_maid:npc_tool"},
                    { "test": "is_family", "subject": "other", "value": "player" },
                    { "test": "is_owner", "subject": "other", "value": true }
                  ]
                },
                "event": "become_npc",
                "target": "self"
              }
            },
            // 坐下/站起改由脚本 beforeEvents.playerInteractWithEntity 处理
            // 更换背包 无
            {
              "cooldown": 0, "use_item": true, "play_sounds": "pop", "vibration": "none",
              "interact_text": "action.interact.maid_backpack_carry",
              "on_interact": {
                "filters": {"all_of": [
                    { "test": "is_family", "subject": "other", "value": "player" },
                    { "test": "has_equipment", "subject": "other", "domain": "hand", "value": "minecraft:shears"},
                    { "test" : "int_property", "domain": "thlm:backpack_type", "value": 1, "operator": ">="}
                  ]},
                "event": "thlmb:t0", "target": "self"
              }
            },
            // 更换背包 小
            {
              "cooldown": 0, "use_item": true, "play_sounds": "pop", "vibration": "none",
              "interact_text": "action.interact.maid_backpack_carry",
              "on_interact": {
                "filters": {"all_of": [
                    { "test": "is_family", "subject": "other", "value": "player" },
                    { "test": "has_equipment", "subject": "other", "domain": "hand", "value": "touhou_little_maid:maid_backpack_small"},
                    { "test" : "int_property", "domain": "thlm:backpack_type", "value": 1, "operator": "!="}
                  ]},
                "event": "thlmb:t1", "target": "self"
              }
            },
            // 更换背包 中
            {
              "cooldown": 0, "use_item": true, "play_sounds": "pop", "vibration": "none",
              "interact_text": "action.interact.maid_backpack_carry",
              "on_interact": {
                "filters": {"all_of": [
                    { "test": "is_family", "subject": "other", "value": "player" },
                    { "test": "has_equipment", "subject": "other", "domain": "hand", "value": "touhou_little_maid:maid_backpack_middle"},
                    { "test" : "int_property", "domain": "thlm:backpack_type", "value": 2, "operator": "!="}
                  ]},
                "event": "thlmb:t2", "target": "self"
              }
            },
            // 更换背包 大
            {
              "cooldown": 0, "use_item": true, "play_sounds": "pop", "vibration": "none",
              "interact_text": "action.interact.maid_backpack_carry",
              "on_interact": {
                "filters": {"all_of": [
                    { "test": "is_family", "subject": "other", "value": "player" },
                    { "test": "has_equipment", "subject": "other", "domain": "hand", "value": "touhou_little_maid:maid_backpack_big"},
                    { "test" : "int_property", "domain": "thlm:backpack_type", "value": 3, "operator": "!="}
                  ]},
                "event": "thlmb:t3", "target": "self"
              }
            }
          ]
        }
      },

      // 非潜行交互 坐下/站起/命名
      "thlmm:maid_tame_sit":{
        "minecraft:nameable"     : { "always_show": false, "allow_name_tag_renaming": true },
        "minecraft:entity_sensor": {
          "sensor_range": 6,
          "relative_range": false,
          "minimum_count": 1,
          "maximum_count": 2,
          "event_filters": {
            "all_of":[
              {
                "all_of": [
                  {"test": "is_owner","subject": "other","value": true},
                  {"test": "is_sneaking","subject": "other","value": true}
                ]
              },
              { "test": "distance_to_nearest_player", "subject" : "self", "operator": "<", "value" : 7}
            ]
          },
          "event": "thlmm:i"
        }
      },
      // 潜行交互 打开背包/不可命名
      "thlmm:maid_tame_inventory":{
        "minecraft:nameable"     : { "always_show": false, "allow_name_tag_renaming": false },
        "minecraft:entity_sensor": {
          "sensor_range": 6,
          "relative_range": false,
          "minimum_count": 1,
          "maximum_count": 2,
          "event_filters": {
            "any_of":[
              {
                "all_of": [
                  {"test": "is_owner","subject": "other","value": true},
                  {"test": "is_sneaking","subject": "other","value": false},
                  {"test": "has_container_open", "subject": "other", "value": false}
                ]
              },
              { "test": "distance_to_nearest_player", "subject" : "self", "operator": ">", "value" : 7}
            ]
          },
          "event": "thlmm:s"
        }
      },

      ///// 等级属性 /////
      // tame 在驯服成功后添加  basic 在生成时添加
      "thlmm:lv1_tame": {
        "minecraft:damage_sensor": {
          "triggers": [
            { "cause": "entity_attack", "deals_damage": false, "on_damage": { "event": "thlmm:m", "target": "self", "filters":{"all_of":[
                    {"test": "is_owner","subject": "damager","value": true},
                    {"test": "is_sneaking", "subject": "damager", "value": true }
                  ]} }}, // 打开菜单
            { "cause": "all", "deals_damage": false, "on_damage": { "filters": {"test": "is_owner","subject": "other","value": true} } }, // 免疫主人伤害
            { "cause": "all", "damage_multiplier": 0.9 }
          ]
        }
      },
      "thlmm:lv1_basic":{
        // 移速改由脚本按 Level.properties.movement 设置，避免与坐下锁定冲突
        "minecraft:attack": {"damage": 12 },
        "minecraft:health": {"value": 64, "max": 64 },
        "minecraft:knockback_resistance": { "value": 0.1 }
      },
      "thlmm:lv2_tame": {
        "minecraft:damage_sensor": {
          "triggers": [
            { "cause": "entity_attack", "deals_damage": false, "on_damage": { "event": "thlmm:m", "target": "self", "filters":{"all_of":[
                    {"test": "is_owner","subject": "damager","value": true},
                    {"test": "is_sneaking", "subject": "damager", "value": true }
                  ]} }}, // 打开菜单
            { "cause": "all", "deals_damage": false, "on_damage": { "filters": {"test": "is_owner","subject": "other","value": true} } }, // 免疫主人伤害
            { "cause": "all", "damage_multiplier": 0.75 }
          ]
        }
      },
      "thlmm:lv2_basic":{
        // 移速改由脚本按 Level.properties.movement 设置，避免与坐下锁定冲突
        "minecraft:attack": { "damage"  : 16 },
        "minecraft:health": { "value": 70, "max": 70 },
        "minecraft:knockback_resistance": { "value": 0.2 }
      },

      ///// 工作模式 /////
      // 战斗索敌
      "mode:searching_melee_attack":{
        "minecraft:type_family"  : { "family": [ "maid", "mob", "player" ] },
        "minecraft:follow_range": { "max": 48, "value": 48 },
        "minecraft:behavior.nearest_attackable_target": {
          "priority": 6, "must_see": true,
          "reselect_targets": true, "within_radius": 48, "scan_interval": 10,
          "entity_types": [{
            "filters": { "all_of": [ {"test": "is_family","subject": "other","value": "monster" } ] },
            "max_dist": 48
          } ]
        },
        "minecraft:behavior.hurt_by_target": {
          "priority": 3,
          "entity_types": {
            "filters":{ "all_of": [
                {"test": "has_component","subject": "other","value": "is_tamed", "operator": "not"},
                {"test": "is_family","subject": "other","value": "maid", "operator": "!="},
                {"test": "is_family","subject": "other","value": "player", "operator": "!="}
              ] }
          }
        },
        "minecraft:behavior.owner_hurt_by_target": {
          "priority": 1,
          "entity_types": {
            "filters":{ "all_of": [
                {"test": "has_component","subject": "other","value": "is_tamed", "operator": "not"},
                {"test": "is_family","subject": "other","value": "maid", "operator": "!="},
                {"test": "is_family","subject": "other","value": "player", "operator": "!="}
              ] }
          }
        },
        "minecraft:behavior.owner_hurt_target"   : {
          "priority": 2,
          "entity_types": {
            "filters":{ "all_of": [
                {"test": "has_component","subject": "other","value": "is_tamed", "operator": "not"},
                {"test": "is_family","subject": "other","value": "maid", "operator": "!="},
                {"test": "is_family","subject": "other","value": "player", "operator": "!="},
                {"test": "is_family","subject": "other","value": "villager", "operator": "!="},
                {"test": "is_family","subject": "other","value": "allay", "operator": "!="},
                {"test": "is_family","subject": "other","value": "horse", "operator": "!="},
                {"test": "is_family","subject": "other","value": "donkey", "operator": "!="},
                {"test": "is_family","subject": "other","value": "mule", "operator": "!="},
                {"test": "is_family","subject": "other","value": "axolotl", "operator": "!="}, // 美西螈
                {"test": "is_family","subject": "other","value": "cat", "operator": "!="},
                {"test": "is_family","subject": "other","value": "ocelot", "operator": "!="}, // 豹猫
                {"test": "is_family","subject": "other","value": "parrot_tame", "operator": "!="},
                {"test": "is_family","subject": "other","value": "parrot_wild", "operator": "!="},
                {"test": "is_family","subject": "other","value": "camel", "operator": "!="}, // 骆驼
                {"test": "is_family","subject": "other","value": "panda", "operator": "!="}
              ] }
          }
        }
      },
      "mode:searching_danmaku_attack":{
        "minecraft:type_family"  : { "family": [ "maid", "mob", "player" ] },
        "minecraft:follow_range": { "max": 48, "value": 48 },
        "minecraft:behavior.nearest_attackable_target": {
          "priority": 4, "must_see": true, "must_reach": false,
          "reselect_targets": true, "within_radius": 48, "scan_interval": 10,
          "entity_types": [ {
            "filters": { "test": "is_family","subject": "other","value": "monster" },
            "max_dist": 48
          } ]
        },
        "minecraft:behavior.hurt_by_target": {
          "priority": 3,
          "entity_types": {
            "filters":{ "all_of": [
                {"test": "has_component","subject": "other","value": "is_tamed", "operator": "not"},
                {"test": "is_family","subject": "other","value": "maid", "operator": "!="},
                {"test": "is_family","subject": "other","value": "player", "operator": "!="}
              ] }
          }
        },
        "minecraft:behavior.owner_hurt_by_target": {
          "priority": 1,
          "entity_types": {
            "filters":{ "all_of": [
                {"test": "has_component","subject": "other","value": "is_tamed", "operator": "not"},
                {"test": "is_family","subject": "other","value": "maid", "operator": "!="},
                {"test": "is_family","subject": "other","value": "player", "operator": "!="}
              ] }
          }
        },
        "minecraft:behavior.owner_hurt_target"   : {
          "priority": 2,
          "entity_types": {
            "filters":{ "all_of": [
                {"test": "has_component","subject": "other","value": "is_tamed", "operator": "not"},
                {"test": "is_family","subject": "other","value": "maid", "operator": "!="},
                {"test": "is_family","subject": "other","value": "player", "operator": "!="},
                {"test": "is_family","subject": "other","value": "villager", "operator": "!="},
                {"test": "is_family","subject": "other","value": "allay", "operator": "!="},
                {"test": "is_family","subject": "other","value": "horse", "operator": "!="},
                {"test": "is_family","subject": "other","value": "donkey", "operator": "!="},
                {"test": "is_family","subject": "other","value": "mule", "operator": "!="},
                {"test": "is_family","subject": "other","value": "axolotl", "operator": "!="}, // 美西螈
                {"test": "is_family","subject": "other","value": "cat", "operator": "!="},
                {"test": "is_family","subject": "other","value": "ocelot", "operator": "!="}, // 豹猫
                {"test": "is_family","subject": "other","value": "parrot_tame", "operator": "!="},
                {"test": "is_family","subject": "other","value": "parrot_wild", "operator": "!="},
                {"test": "is_family","subject": "other","value": "camel", "operator": "!="}, // 骆驼
                {"test": "is_family","subject": "other","value": "panda", "operator": "!="}
              ] }
          }
        }
      },
      // 加了一个 parrot_tame 和rideable
      "mode:searching_danmaku_attack_hug":{
        "minecraft:type_family"  : { "family": [ "maid", "mob", "player", "parrot_tame" ] },
        "minecraft:rideable": {// 提供交互
          "controlling_seat": 0,
          "crouching_skip_interact": true,
          "family_types": ["hug_maid"],
          "interact_text": "",
          "pull_in_entities": false,
          "rider_can_interact": false,
          "seat_count": 1,
          "seats":[
            {"position": [ -0.4, 0.2, 0.1 ], "lock_rider_rotation": 0, "rotate_rider_by": 0}
          ]
        },
        "minecraft:follow_range": { "max": 48, "value": 48 },
        "minecraft:behavior.nearest_attackable_target": {
          "priority": 4, "must_see": true, "must_reach": false,
          "reselect_targets": true, "within_radius": 48, "scan_interval": 10,
          "entity_types": [ {
            "filters": { "test": "is_family","subject": "other","value": "monster" },
            "max_dist": 48
          } ]
        },
        "minecraft:behavior.hurt_by_target": {
          "priority": 3,
          "entity_types": {
            "filters":{ "all_of": [
                {"test": "has_component","subject": "other","value": "is_tamed", "operator": "not"},
                {"test": "is_family","subject": "other","value": "maid", "operator": "!="},
                {"test": "is_family","subject": "other","value": "player", "operator": "!="}
              ] }
          }
        },
        "minecraft:behavior.owner_hurt_by_target": {
          "priority": 1,
          "entity_types": {
            "filters":{ "all_of": [
                {"test": "has_component","subject": "other","value": "is_tamed", "operator": "not"},
                {"test": "is_family","subject": "other","value": "maid", "operator": "!="},
                {"test": "is_family","subject": "other","value": "player", "operator": "!="}
              ] }
          }
        },
        "minecraft:behavior.owner_hurt_target"   : {
          "priority": 2,
          "entity_types": {
            "filters":{ "all_of": [
                {"test": "has_component","subject": "other","value": "is_tamed", "operator": "not"},
                {"test": "is_family","subject": "other","value": "maid", "operator": "!="},
                {"test": "is_family","subject": "other","value": "player", "operator": "!="},
                {"test": "is_family","subject": "other","value": "villager", "operator": "!="},
                {"test": "is_family","subject": "other","value": "allay", "operator": "!="},
                {"test": "is_family","subject": "other","value": "horse", "operator": "!="},
                {"test": "is_family","subject": "other","value": "donkey", "operator": "!="},
                {"test": "is_family","subject": "other","value": "mule", "operator": "!="},
                {"test": "is_family","subject": "other","value": "axolotl", "operator": "!="}, // 美西螈
                {"test": "is_family","subject": "other","value": "cat", "operator": "!="},
                {"test": "is_family","subject": "other","value": "ocelot", "operator": "!="}, // 豹猫
                {"test": "is_family","subject": "other","value": "parrot_tame", "operator": "!="},
                {"test": "is_family","subject": "other","value": "parrot_wild", "operator": "!="},
                {"test": "is_family","subject": "other","value": "camel", "operator": "!="}, // 骆驼
                {"test": "is_family","subject": "other","value": "panda", "operator": "!="}
              ] }
          }
        }
      },
      // 空闲
      "mode:idle":{
        "minecraft:type_family"  : { "family": [ "maid", "mob"] }
      },
      // 抱起
      "mode:hug":{
        "minecraft:type_family"  : { "family": [ "maid", "mob", "parrot_tame"] },
        "minecraft:rideable": {// 提供交互
          "controlling_seat": 0,
          "crouching_skip_interact": true,
          "family_types": ["hug_maid"],
          "interact_text": "",
          "pull_in_entities": false,
          "rider_can_interact": false,
          "seat_count": 1,
          "seats":[
            {"position": [ -0.4, 0.2, 0.1 ], "lock_rider_rotation": 0, "rotate_rider_by": 0}
          ]
        }
      },
      "mode:idle_stand":{
        "minecraft:behavior.panic": { "priority": 4, "speed_multiplier": 1.25 }
      },
      // 近战
      "mode:attack_lv1":{
        "minecraft:behavior.melee_attack": {
          "priority": 5,
          "reach_multiplier": 7,
          "speed_multiplier": 1.25,
          "cooldown_time": 0.9
        }
      },
      "mode:attack_lv2":{
        "minecraft:behavior.melee_attack": {
          "priority": 5,
          "reach_multiplier": 9,
          "speed_multiplier": 1.25,
          "cooldown_time": 0.8
        }
      },
      // 弹幕攻击
      "mode:danmaku_attack":{
        "minecraft:behavior.ranged_attack": {
          "priority": 5,
          "attack_interval_min": 0.3,
          "attack_interval_max": 0.3,
          "attack_radius": 48,
          "attack_radius_min": 16,
          "speed_multiplier": 1.25,
          "x_max_rotation": 30
        },
        "minecraft:behavior.panic": { "priority": 4, "speed_multiplier": 1.25 }
      },
      "mode:danmaku_attack_sit":{
        "minecraft:behavior.ranged_attack": {
          "priority": 5,
          "attack_interval_min": 0.3,
          "attack_interval_max": 0.3,
          "attack_radius": 48.0,
          "attack_radius_min": 16,
          "speed_multiplier": 0
        },
        "minecraft:behavior.panic": { "priority": 4, "speed_multiplier": 0 }
      },
      // 农耕
      "mode:farm":{
        "minecraft:follow_range": { "max": 32, "value": 32 },
        "minecraft:behavior.nearest_attackable_target": {
          "priority": 7, "must_reach": true, "must_see": false, "persist_time": 5.0,
          "reselect_targets": false, "within_radius": 32, "scan_interval": 20, "target_search_height": 2,
          "entity_types": [
            {
              "filters": { "all_of": [
                  {"test": "is_family","subject": "other","value": "thlmt:farm"}
                ] },
              "max_dist": 32, "must_see": false
            }
          ]
        },
        "minecraft:behavior.ranged_attack": {
          "priority": 6,
          "speed_multiplier": 0.8,
          "attack_interval_min": 0.8,
          "attack_interval_max": 0.8,
          "attack_radius": 1.9,
          "attack_radius_min": 0
        }
      },
      // 甘蔗
      "mode:sugar_cane":{
        "minecraft:follow_range": { "max": 32, "value": 32 },
        "minecraft:behavior.nearest_attackable_target": {
          "priority": 7, "must_reach": true, "must_see": false,
          "reselect_targets": true, "within_radius": 32, "scan_interval": 10,
          "entity_types": [ { "filters": { "all_of": [ {"test": "is_family","subject": "other","value": "thlmt:sugar_cane"} ] }, "max_dist": 32, "must_see": false } ]
        },
        "minecraft:behavior.melee_attack": { "priority": 6, "speed_multiplier": 1, "cooldown_time": 1.0,"reach_multiplier": 3 }
      },
      // 瓜类
      "mode:melon":{
        "minecraft:follow_range": { "max": 32, "value": 32 },
        "minecraft:behavior.nearest_attackable_target": {
          "priority": 7, "must_reach": true, "must_see": false, "persist_time": 5.0,
          "reselect_targets": false, "within_radius": 32, "scan_interval": 20,
          "entity_types": [ {
            "filters": { "all_of": [ {"test": "is_family","subject": "other","value": "thlmt:melon"} ] },
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
      },
      // 可可豆
      "mode:cocoa": {
        "minecraft:follow_range": { "max": 32, "value": 32 },
        "minecraft:behavior.nearest_attackable_target": {
          "priority": 7, "must_reach": true, "must_see": false, "persist_time": 3.0,
          "reselect_targets": false, "within_radius": 32, "scan_interval": 20, "target_search_height": 4,
          "entity_types": [ {
            "filters": { "all_of": [ {"test": "is_family","subject": "other","value": "thlmt:cocoa"} ] },
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
      },

      ///// 背包类别 /////
      "backpack:default_sneaking":{ "minecraft:inventory":{ "container_type": "inventory", "inventory_size": 6, "restrict_to_owner": true} },
      "backpack:small_sneaking":{ "minecraft:inventory":{ "container_type": "inventory", "inventory_size": 12, "restrict_to_owner": true} },
      "backpack:middle_sneaking":{ "minecraft:inventory":{ "container_type": "inventory", "inventory_size": 24, "restrict_to_owner": true} },
      "backpack:big_sneaking":{ "minecraft:inventory":{ "container_type": "inventory", "inventory_size": 36, "restrict_to_owner": true} },

      "backpack:default":{ "minecraft:inventory":{ "container_type": "inventory", "inventory_size": 6, "private": true} },
      "backpack:small":{ "minecraft:inventory":{ "container_type": "inventory", "inventory_size": 12, "private": true} },
      "backpack:middle":{ "minecraft:inventory":{ "container_type": "inventory", "inventory_size": 24, "private": true} },
      "backpack:big":{ "minecraft:inventory":{ "container_type": "inventory", "inventory_size": 36, "private": true} },

      ///// 拾物模式 /////
      "mode:pick":{
        "minecraft:behavior.pickup_items": {
          "priority": 5,
          "max_dist": 8,
          "goal_radius": 2,
          "speed_multiplier": 1.25,
          "search_height": 2,
          "can_pickup_any_item": true,
          "track_target": true,
          "can_pickup_to_hand_or_equipment": false
        },
        "minecraft:shareables": {
          "singular_pickup": true,
          "all_items": true,
          "items": [
            {"item": "minecraft:apple", "want_amount": 1111}
          ]
        }
      },
      "mode:pick_sit": {
        "minecraft:behavior.pickup_items": {
          "priority": 5,
          "max_dist": 8,
          "goal_radius": 2,
          "speed_multiplier": 0,
          "track_target": true,
          "search_height": 2,
          "can_pickup_any_item": true,
          "can_pickup_to_hand_or_equipment": false
        },
        "minecraft:shareables": {
          "singular_pickup": true,
          "all_items": true,
          "items": [
            {"item": "minecraft:apple", "want_amount": 1111}
          ]
        }
      },

      ///// 环境状态 /////
      "environment:simple":{
        "minecraft:environment_sensor": {
          "triggers": [
            ///// 温度 /////
            { // 适宜
              "event": "environment:temperature_mild", "target": "self",
              "filters": [ { "all_of": [
                  {"test": "int_property", "value": 0, "operator":"!=", "domain": "environment:temperature"},
                  {"test": "is_temperature_type", "value": "mild"}
                ] } ]
            },
            { // 热
              "event": "environment:temperature_warm", "target": "self",
              "filters": [ { "all_of": [
                  {"test": "int_property", "value": 1, "operator":"!=", "domain": "environment:temperature"},
                  {"test": "is_temperature_type", "value": "warm"}
                ] } ]
            },
            { // 冷
              "event": "environment:temperature_cold", "target": "self",
              "filters": [ { "all_of": [
                  {"test": "int_property", "value": 2, "operator":"!=", "domain": "environment:temperature"},
                  {"test": "is_temperature_type", "value": "cold"}
                ] } ]
            },
            ///// 天气 /////
            { // 无天气：普通群系的无天气、炎热群系的雨天
              "event": "environment:weather_clear", "target": "self", "filters": [{ "all_of": [
                  {"test": "int_property", "value": 0, "operator":"!=", "domain": "environment:weather"},
                  {"any_of": [
                      {"all_of": [{"test": "is_temperature_type", "value": "mild"}, {"test": "weather", "operator": "==", "value": "clear"} ]},
                      {"all_of": [{"test": "is_temperature_type", "value": "warm"}, {"test": "weather", "operator": "==", "value": "precipitation"} ]}
                    ]}
                ]}]
            },
            { // 雨：普通群系的雨天
              "event": "environment:weather_rain", "target": "self", "filters": [{ "all_of": [
                  {"test": "int_property", "value": 1, "operator":"!=", "domain": "environment:weather"},
                  { "any_of": [
                      {"test": "is_temperature_type", "value": "mild"},
                      {"test": "is_temperature_type", "value": "ocean"}
                    ]
                  },
                  {"test": "weather", "operator": "==", "value": "precipitation"}
                ]}]
            },
            { // 雪：寒冷群系的雨天
              "event": "environment:weather_snow", "target": "self", "filters": [{ "all_of": [
                  {"test": "int_property", "value": 2, "operator":"!=", "domain": "environment:weather"},
                  {"test": "is_temperature_type", "value": "cold"},
                  {"test": "weather", "operator": "==", "value": "precipitation"}
                ]}]
            },
            ///// 早晨/夜晚报时 /////
            {
              "event": "environment:morning", "target": "self", "filters": [{ "all_of": [
                  {"test": "int_property", "value": 1, "operator":"!=", "domain": "environment:daytime"},
                  {"test": "is_daytime", "value": true}]}]
            },
            {
              "event": "environment:night"  , "target": "self", "filters": [{ "all_of": [
                  {"test": "int_property", "value": 0, "operator":"!=", "domain": "environment:daytime"},
                  {"test": "is_daytime", "value": false}]}]
            }
          ]
        }
      },

      ///////// NPC 基础属性 /////////
      "thlmm:npc_basic":{
        "minecraft:timer": {
          "time": 30, "looping": true,
          "time_down_event": { "event": "thlmm:h", "target": "self" }
        },
        "minecraft:interact": {
          "interactions": [
            {
              "cooldown": 2.5,
              "use_item": false,
              "hurt_item": 1,
              "vibration": "none",
              "on_interact": {
                "filters": {
                  "all_of": [
                    { "test": "has_equipment", "subject": "other", "domain": "hand", "value": "touhou_little_maid:npc_tool"},
                    { "test": "is_sneaking", "subject": "other", "value": true }
                  ]
                },
                "event": "thlm:n",
                "target": "self"
              }
            }
          ]
        },
        "minecraft:type_family": { "family": [ "npc", "mob" ] },
        "minecraft:knockback_resistance": { "value": 1.0 },
        "minecraft:damage_sensor": {
          "triggers": [
            {
              "on_damage": {
                "filters": {
                  "all_of": [
                    { "test": "is_family", "subject": "other", "value": "player" },
                    { "test": "has_equipment", "subject": "other", "domain": "hand", "value": "touhou_little_maid:npc_tool"},
                    { "test": "is_sneaking", "subject": "other", "value": true }
                  ]
                },
                "event": "despawn",
                "target": "self"
              },
              "deals_damage": false
            },
            {
              "cause": "all",
              "deals_damage": false
            }
          ]
        },
        "minecraft:collision_box": { "width": 0.6, "height": 1.5 },
        "minecraft:nameable": { "always_show": false, "allow_name_tag_renaming": false},
        "minecraft:physics": { "has_collision": true, "has_gravity": true, "push_towards_closest_space": false },
        "minecraft:persistent": { },
        "minecraft:pushable": { "is_pushable": false, "is_pushable_by_piston": false },
        "minecraft:home": { },
        "minecraft:behavior.look_at_player": { "priority": 5, "look_distance": 6.0,"probability": 0.02 },
        "minecraft:npc": {
          "npc_data": {
            "portrait_offsets": {
              "translate": [ -7, 50, 0 ],
              "scale": [ 1.75, 1.75, 1.75 ]
            },
            "picker_offsets": {
              "translate": [ 0, 20, 0 ],
              "scale": [ 1.7, 1.7, 1.7 ]
            },
            "skin_list": [
              { "variant": 0 },{ "variant": 1 },{ "variant": 2 },{ "variant": 3 },{ "variant": 4 },{ "variant": 5 },{ "variant": 6 },{ "variant": 7 },{ "variant": 8 },{ "variant": 9 },{ "variant": 10 },
              { "variant": 11 },{ "variant": 12 },{ "variant": 13 },{ "variant": 14 },{ "variant": 15 },{ "variant": 16 },{ "variant": 17 },{ "variant": 18 },{ "variant": 19 },{ "variant": 20 },
              { "variant": 21 },{ "variant": 22 },{ "variant": 23 },{ "variant": 24 },{ "variant": 25 },{ "variant": 26 },{ "variant": 27 },{ "variant": 28 },{ "variant": 29 },{ "variant": 30 },
              { "variant": 31 },{ "variant": 32 },{ "variant": 33 },{ "variant": 34 },{ "variant": 35 },{ "variant": 36 },{ "variant": 37 },{ "variant": 38 },{ "variant": 39 },{ "variant": 40 },
              { "variant": 41 },{ "variant": 42 },{ "variant": 43 },{ "variant": 44 },{ "variant": 45 },{ "variant": 46 },{ "variant": 47 },{ "variant": 48 },{ "variant": 49 },{ "variant": 50 },
              { "variant": 51 },{ "variant": 52 },{ "variant": 53 },{ "variant": 54 },{ "variant": 55 },{ "variant": 56 },{ "variant": 57 },{ "variant": 58 },{ "variant": 59 },{ "variant": 60 },
              { "variant": 61 },{ "variant": 62 },{ "variant": 63 },{ "variant": 64 },{ "variant": 65 },{ "variant": 66 },{ "variant": 67 },{ "variant": 68 },{ "variant": 69 },{ "variant": 70 },
              { "variant": 71 },{ "variant": 72 },{ "variant": 73 },{ "variant": 74 },{ "variant": 75 },{ "variant": 76 },{ "variant": 77 },{ "variant": 78 },{ "variant": 79 },{ "variant": 80 },
              { "variant": 81 },{ "variant": 82 },{ "variant": 83 },{ "variant": 84 },{ "variant": 85 },{ "variant": 86 },{ "variant": 87 },{ "variant": 88 },{ "variant": 89 },{ "variant": 90 },
              { "variant": 91 },{ "variant": 92 },{ "variant": 93 },{ "variant": 94 },{ "variant": 95 },{ "variant": 96 },{ "variant": 97 },{ "variant": 98 },{ "variant": 99 },{ "variant": 100 },
              { "variant": 101 },{ "variant": 102 },{ "variant": 103 },{ "variant": 104 },{ "variant": 105 },{ "variant": 106 },{ "variant": 107 },{ "variant": 108 },{ "variant": 109 },{ "variant": 110 },
              { "variant": 111 },{ "variant": 112 },{ "variant": 113 },{ "variant": 114 },{ "variant": 115 },{ "variant": 116 },{ "variant": 117 },{ "variant": 118 },{ "variant": 119 },{ "variant": 120 },
              { "variant": 121 },{ "variant": 122 },{ "variant": 123 },{ "variant": 124 },{ "variant": 125 },{ "variant": 126 },{ "variant": 127 },{ "variant": 128 },{ "variant": 129 },{ "variant": 130 },
              { "variant": 131 },{ "variant": 132 },{ "variant": 133 },{ "variant": 134 },{ "variant": 135 },{ "variant": 136 },{ "variant": 137 },{ "variant": 138 },{ "variant": 139 },{ "variant": 140 },
              { "variant": 141 },{ "variant": 142 },{ "variant": 143 },{ "variant": 144 },{ "variant": 145 },{ "variant": 146 },{ "variant": 147 },{ "variant": 148 },{ "variant": 149 },{ "variant": 150 },
              { "variant": 151 },{ "variant": 152 },{ "variant": 153 },{ "variant": 154 },{ "variant": 155 },{ "variant": 156 },{ "variant": 157 },{ "variant": 158 },{ "variant": 159 },{ "variant": 160 },
              { "variant": 161 },{ "variant": 162 },{ "variant": 163 },{ "variant": 164 },{ "variant": 165 },{ "variant": 166 },{ "variant": 167 },{ "variant": 168 },{ "variant": 169 },{ "variant": 170 },
              { "variant": 171 },{ "variant": 172 },{ "variant": 173 },{ "variant": 174 },{ "variant": 175 },{ "variant": 176 },{ "variant": 177 },{ "variant": 178 },{ "variant": 179 },{ "variant": 180 },
              { "variant": 181 },{ "variant": 182 },{ "variant": 183 },{ "variant": 184 },{ "variant": 185 },{ "variant": 186 },{ "variant": 187 },{ "variant": 188 },{ "variant": 189 },{ "variant": 190 },
              { "variant": 191 },{ "variant": 192 },{ "variant": 193 },{ "variant": 194 },{ "variant": 195 },{ "variant": 196 },{ "variant": 197 },{ "variant": 198 },{ "variant": 199 },{ "variant": 200 }
            ]
          }
        }
      },

      ///////// 手办/雕塑 基础属性 /////////
      "thlmm:statues":{
        "minecraft:type_family": {
          "family": ["thlm:statues"]
        },
        "minecraft:knockback_resistance": { "value": 1.0 },
        "minecraft:damage_sensor": { "triggers": [ { "cause": "all", "deals_damage": false } ] },
        "minecraft:collision_box": { "width": 0, "height": 0},
        "minecraft:physics": { "has_collision": false, "has_gravity": false, "push_towards_closest_space": false },
        "minecraft:persistent": { },
        "minecraft:pushable": { "is_pushable": false, "is_pushable_by_piston": false }
      },
      "thlmm:garage_kit_un_solid":{
        "minecraft:type_family": { "family": ["thlm:garage_kit_un_solid"] },
        "minecraft:timer": {
          "time":[ 20, 40 ],
          "looping": true,
          "time_down_event": {
            "event": "garage_kit_scan",
            "target": "self"
          }
        },
        "minecraft:knockback_resistance": { "value": 1.0 },
        "minecraft:damage_sensor": { "triggers": [ { "cause": "all", "deals_damage": false } ] },
        "minecraft:collision_box": { "width": 0, "height": 0},
        "minecraft:physics": { "has_collision": false, "has_gravity": false, "push_towards_closest_space": false },
        "minecraft:persistent": { },
        "minecraft:pushable": { "is_pushable": false, "is_pushable_by_piston": false }
      },
      "thlmm:garage_kit_solid":{
        "minecraft:type_family": { "family": ["thlm:garage_kit_solid"] },
        "minecraft:knockback_resistance": { "value": 1.0 },
        "minecraft:damage_sensor": { "triggers": [ { "cause": "all", "deals_damage": false } ] },
        "minecraft:collision_box": { "width": 0, "height": 0},
        "minecraft:physics": { "has_collision": false, "has_gravity": false, "push_towards_closest_space": false },
        "minecraft:persistent": { },
        "minecraft:pushable": { "is_pushable": false, "is_pushable_by_piston": false }
      }
    },
    "components": {
      "minecraft:dimension_bound": {},
      "minecraft:variant": { "value": 0 },
      "minecraft:knockback_resistance": { "value": 1.0 },
      "minecraft:collision_box": { "width": 0, "height": 0},
      "minecraft:physics": { "has_collision": false, "has_gravity": false, "push_towards_closest_space": false },
      "minecraft:persistent": { },
      "minecraft:pushable": { "is_pushable": false, "is_pushable_by_piston": false }
    },
    "events": {
      ///// 基础事件 /////
      "minecraft:entity_spawned": { "trigger": "thlmm:0" },
      "init_failed":{ "queue_command": {"command":"function touhou_little_maid/not_support"} },
      "become_maid":{
        "add": {
          "component_groups": [
            "thlmm:maid_basic",
            "thlmm:maid_basic_stand_movement",
            "thlmm:maid_wild",
            "environment:simple",
            "backpack:default",
            "thlmm:lv1_basic"
          ]
        }
      },
      // 重生的女仆，等级交给脚本设置
      "become_maid_reborn":{
        "add": {
          "component_groups": [
            "thlmm:maid_basic",
            "thlmm:maid_basic_stand_movement",
            "thlmm:maid_wild",
            "environment:simple",
            "backpack:default"
          ]
        }
      },
      "despawn":{ "add": { "component_groups": [ "despawn" ] } },

      "become_npc":{
        "remove": { "component_groups": [
            "thlmm:maid_basic",
            "thlmm:maid_basic_stand_movement",
            "thlmm:maid_basic_sit_movement",
            "thlmm:maid_wild",
            "environment:simple",
            "backpack:default",
            "thlmm:lv1_basic",
            "thlmm:lv1_tame",
            "status:follow_standard",
            "status:follow_sit",
            "thlmm:maid_tame"
          ]},
        "add": { "component_groups": [ "thlmm:npc_basic" ] },
        "trigger": "thlmm:n",
        "set_property": { "thlm:work": -1 }
      },
      "become_statues":{
        "remove": { "component_groups": [
            "thlmm:maid_basic",
            "thlmm:maid_basic_stand_movement",
            "thlmm:maid_basic_sit_movement",
            "thlmm:maid_wild",
            "environment:simple",
            "backpack:default",
            "thlmm:lv1_basic",
            "thlmm:lv1_tame",
            "status:follow_standard",
            "status:follow_sit",
            "thlmm:maid_tame"
          ]},
        "add": { "component_groups": [ "thlmm:statues" ] },
        "set_property": { "thlm:work": -2 }
      },
      "become_garage_kit_un_solid":{
        "remove": { "component_groups": [
            "thlmm:maid_basic",
            "thlmm:maid_basic_stand_movement",
            "thlmm:maid_basic_sit_movement",
            "thlmm:maid_wild",
            "environment:simple",
            "backpack:default",
            "thlmm:lv1_basic",
            "thlmm:lv1_tame",
            "status:follow_standard",
            "status:follow_sit",
            "thlmm:maid_tame"
          ]},
        "add": { "component_groups": [ "thlmm:garage_kit_un_solid" ] },
        "set_property": { "thlm:work": -3 }
      },
      "garage_kit_scan":{
        "queue_command": { "command": "execute as @s at @s if block ~~-1~ fire run event entity @s become_garage_kit_solid"}
      },
      "become_garage_kit_solid":{
        "sequence": [
          {
            "remove": { "component_groups": [
                "thlmm:maid_basic",
                "thlmm:maid_basic_stand_movement",
                "thlmm:maid_basic_sit_movement",
                "thlmm:maid_wild",
                "environment:simple",
                "backpack:default",
                "thlmm:lv1_basic",
                "thlmm:lv1_tame",
                "status:follow_standard",
                "status:follow_sit",
                "thlmm:maid_tame",
                "thlmm:garage_kit_un_solid"
              ] },
            "add": { "component_groups": [ "thlmm:garage_kit_solid" ] },
            "set_property": { "thlm:work": -4 },
            "queue_command": {"command": [
                "setblock ~~~ touhou_little_maid:garage_kit_block [\"thlm:solid\"=true]"
              ]}
          },
          // 由待烘烤状态转化时产生粒子
          {
            "filters": { "test": "is_family", "subject": "self", "value": "thlm:garage_kit_un_solid" },
            "queue_command": {"command": [
                "particle minecraft:egg_destroy_emitter"
              ]}
          }
        ]

      },

      ///// 脚本事件 /////
      "thlmm:t" :{
        "sequence": [
          // 回家
          {
            "trigger": "thlmm:h",
            "filters": { "all_of": [
                { "test": "bool_property", "domain": "thlm:home", "subject": "self", "value": true }
              ]}
          },
          // 弹幕攻击
          { "trigger": "thlmm:a", "filters": { "all_of": [
                { "test": "int_property", "value": 2, "operator":"==", "domain": "thlm:work" } ]
            } }
        ]
      },// timer 每3秒一次的定时事件
      "thlmm:a": {}, // danmaku Attack
      "thlmm:d" :{}, // Death
      "thlmm:f": {
        "remove": { "component_groups": [ "thlmm:maid_wild" ] },
        "add": {"component_groups": [ "thlmm:maid_tame", "status:follow_standard", "thlmm:maid_tame_sit"]},
        "trigger": "api:mode_idle",
        "queue_command":{ "command": ["particle thlm:maid_happy ~~~"]}
      },
      "thlmm:h" :{}, // Home
      "thlmm:i" :{ "sequence": [ // 退出坐下模式 进入查包模式
          { "remove": {"component_groups": ["thlmm:maid_tame_sit"]},  "add": {"component_groups": ["thlmm:maid_tame_inventory"]} },
          { "filters":  {"test": "int_property", "domain": "thlm:backpack_type", "value": 0},
            "add": { "component_groups": [ "backpack:default_sneaking" ] }, "remove": { "component_groups": [ "backpack:default" ] }
          },
          { "filters":  {"test": "int_property", "domain": "thlm:backpack_type", "value": 1},
            "add": { "component_groups": [ "backpack:small_sneaking" ] }, "remove": { "component_groups": [ "backpack:small" ] } },
          { "filters":  {"test": "int_property", "domain": "thlm:backpack_type", "value": 2},
            "add": { "component_groups": [ "backpack:middle_sneaking" ] }, "remove": { "component_groups": [ "backpack:middle" ] } },
          { "filters":  {"test": "int_property", "domain": "thlm:backpack_type", "value": 3},
            "add": { "component_groups": [ "backpack:big_sneaking" ] }, "remove": { "component_groups": [ "backpack:big" ] } }
        ] },
      // 抱起，与坐下完全相同
      "thlmm:j" :{
        "sequence": [
          { // 切换移动属性
            "remove": { "component_groups": [ "thlmm:maid_basic_stand_movement" ]},
            "add": { "component_groups": [ "thlmm:maid_basic_sit_movement" ]}
          },
          { // 不处于家模式，还需要取消主人跟随
            "filters": { "test": "bool_property", "domain": "thlm:home", "subject": "self", "value": false },
            "remove": { "component_groups": [ "status:follow_standard" ]},
            "add": { "component_groups": [ "status:follow_sit" ]}
          },
          // 工作模式 | 近战、农业模式 交给脚本执行
          { "filters": {"test": "int_property", "domain": "thlm:work", "value": 2}, // 弹幕模式 切换索敌（不跟随）
            "remove": { "component_groups": [ "mode:danmaku_attack"]},
            "add": { "component_groups": ["mode:danmaku_attack_sit"]}
          }
          // 农作模式由脚本取消扫描
        ]
      }, // Hug
      "api:sit_to_hug":{
        "sequence": [
          // 两个包含 family 的组要特别处理
          {
            "filters": {"test": "int_property", "domain": "thlm:work", "value": 2},
            "remove": { "component_groups": [ "mode:searching_danmaku_attack" ] },
            "add": { "component_groups": [ "mode:searching_danmaku_attack_hug" ] }
          },
          {
            "filters": {"test": "int_property", "domain": "thlm:work", "value": 0},
            "remove": { "component_groups": [ "mode:idle" ] }
          },
          // 添加通用 hug 组
          {
            "filters": {"test": "int_property", "domain": "thlm:work", "value": 2, "operator": "not"},
            "add": { "component_groups": [ "mode:hug" ] }
          },
          // 切换移动属性
          {
            "remove": {"component_groups": ["thlmm:maid_basic_sit_movement"]},
            "add": {"component_groups": ["thlmm:maid_basic_hug_movement"]}
          }
        ]
      },
      "thlmm:k": {
      }, // Hug stop
      "api:hug_to_sit":{
        "sequence": [
          // 切换移动属性
          {
            "add": {"component_groups": ["thlmm:maid_basic_sit_movement"]},
            "remove": {"component_groups": ["thlmm:maid_basic_hug_movement"]}
          },
          // 移除通用 hug 组
          {
            "filters": {"test": "int_property", "domain": "thlm:work", "value": 2, "operator": "not"},
            "remove": { "component_groups": [ "mode:hug" ] }
          },
          // 两个包含 family 的组要特别处理
          {
            "filters": {"test": "int_property", "domain": "thlm:work", "value": 2},
            "add": { "component_groups": [ "mode:searching_danmaku_attack" ] },
            "remove": { "component_groups": [ "mode:searching_danmaku_attack_hug" ] }
          },
          {
            "filters": {"test": "int_property", "domain": "thlm:work", "value": 0},
            "add": { "component_groups": [ "mode:idle" ] }
          }
        ]
      },
      "thlmm:l1":{}, "thlmm:l2" :{}, "thlmm:l3" :{}, "thlmm:l4" :{}, "thlmm:l5" :{}, "thlmm:l6" :{}, // Level 1~6
      "thlmm:m" :{}, // Master interact
      "thlmm:n" :{}, // NPC
      "thlmm:p" :{}, // Photo
      "thlmm:s" :{ "sequence": [ // 退出坐下模式 进入查包模式
          { "remove": {"component_groups": ["thlmm:maid_tame_inventory"]}, "add": {"component_groups": ["thlmm:maid_tame_sit"]} },
          { "filters":  {"test": "int_property", "domain": "thlm:backpack_type", "value": 0},
            "remove": { "component_groups": [ "backpack:default_sneaking" ] }, "add": { "component_groups": [ "backpack:default" ] }
          },
          { "filters":  {"test": "int_property", "domain": "thlm:backpack_type", "value": 1},
            "remove": { "component_groups": [ "backpack:small_sneaking" ] }, "add": { "component_groups": [ "backpack:small" ] } },
          { "filters":  {"test": "int_property", "domain": "thlm:backpack_type", "value": 2},
            "remove": { "component_groups": [ "backpack:middle_sneaking" ] }, "add": { "component_groups": [ "backpack:middle" ] } },
          { "filters":  {"test": "int_property", "domain": "thlm:backpack_type", "value": 3},
            "remove": { "component_groups": [ "backpack:big_sneaking" ] }, "add": { "component_groups": [ "backpack:big" ] } }
        ] },
      "thlmm:u": {}, // Statues destory
      // 坐下
      "thlmm:v":{
        "sequence": [
          { // 切换移动属性
            "remove": { "component_groups": [ "thlmm:maid_basic_stand_movement" ]},
            "add": { "component_groups": [ "thlmm:maid_basic_sit_movement" ]}
          },
          { // 不处于家模式，还需要取消主人跟随
            "filters": { "test": "bool_property", "domain": "thlm:home", "subject": "self", "value": false },
            "remove": { "component_groups": [ "status:follow_standard" ]},
            "add": { "component_groups": [ "status:follow_sit" ]}
          },
          // 工作模式 | 近战、农业模式 交给脚本执行
          { "filters": {"test": "int_property", "domain": "thlm:work", "value": 2}, // 弹幕模式 切换索敌（不跟随）
            "remove": { "component_groups": [ "mode:danmaku_attack"]},
            "add": { "component_groups": ["mode:danmaku_attack_sit"]}
          }
          // 农作模式由脚本取消扫描
        ]
      },
      // 站起
      "thlmm:w":{
        "sequence": [
          { // 切换移动属性
            "add": { "component_groups": [ "thlmm:maid_basic_stand_movement" ]},
            "remove": { "component_groups": [ "thlmm:maid_basic_sit_movement" ]}
          },
          { // 不处于家模式，还需要恢复主人跟随
            "filters": { "test": "bool_property", "domain": "thlm:home", "subject": "self", "value": false },
            "add": { "component_groups": [ "status:follow_standard" ]},
            "remove": { "component_groups": [ "status:follow_sit" ]}
          },
          // 工作模式 | 近战、农业模式 拾物模式 交给脚本执行
          { "filters": {"test": "int_property", "domain": "thlm:work", "value": 2}, // 弹幕模式 恢复索敌
            "add": { "component_groups": [ "mode:danmaku_attack" ]},
            "remove": { "component_groups": [ "mode:danmaku_attack_sit" ] } }
        ]
      },
      "thlmm:0" :{ "add": { "component_groups": [ "init_failed" ] } }, // Spawn
      "thlmm:1" :{}, // smart slab
      "thlm:n": {}, // npc交互

      // 发起背包切换
      "thlmb:t0": {},
      "thlmb:t1": {},
      "thlmb:t2": {},
      "thlmb:t3": {},

      //////// 脚本接口 ////////
      //// 初始化成功 ////
      "api:init_success":{ "remove": { "component_groups": [ "init_failed" ] } },
      //// 跟随类型 ////
      "api:status_follow_stand":{
        "add": {"component_groups": ["status:follow_standard"]}
      },
      "api:status_follow_sit":{
        "add": {"component_groups": ["status:follow_sit"]}
      },
      "api:status_home"    :{
        "set_property": {"thlm:home": true},
        "remove": {"component_groups": ["status:follow_standard", "status:follow_sit"]}
      },

      //// 等级 ////
      "api:lv_1_basic" : {"add": { "component_groups": [ "thlmm:lv1_basic" ] }}, "api:lv_1_basic_quit" : {"remove": { "component_groups": [ "thlmm:lv1_basic" ] }},
      "api:lv_1_tame"  : {"add": { "component_groups": [ "thlmm:lv1_tame"  ] }}, "api:lv_1_tame_quit"  : {"remove": { "component_groups": [ "thlmm:lv1_tame"  ] }},
      "api:lv_2_basic" : {"add": { "component_groups": [ "thlmm:lv2_basic" ] }}, "api:lv_2_basic_quit" : {"remove": { "component_groups": [ "thlmm:lv2_basic" ] }},
      "api:lv_2_tame"  : {"add": { "component_groups": [ "thlmm:lv2_tame"  ] }}, "api:lv_2_tame_quit"  : {"remove": { "component_groups": [ "thlmm:lv2_tame"  ] }},

      //// 工作模式 ////
      "api:mode_idle"     :  {"sequence": [{"add"   : {"component_groups": ["mode:idle"]}, "set_property":{"thlm:work": 0}}]},
      "api:mode_quit_idle":  {"sequence": [{"remove": {"component_groups": ["mode:idle"]}}]},
      "api:mode_attack_lv1":{
        "add": { "component_groups": [ "mode:searching_melee_attack", "mode:attack_lv1" ] }
      },
      "api:mode_quit_attack_lv1":{"sequence": [{"remove": {"component_groups": ["mode:attack_lv1", "mode:searching_melee_attack"]}}]},
      "api:mode_attack_lv2":{
        "add": { "component_groups": [ "mode:searching_melee_attack", "mode:attack_lv2" ] }
      },
      "api:mode_quit_attack_lv2":{"sequence": [{"remove": {"component_groups": ["mode:attack_lv2", "mode:searching_melee_attack"]}}]},
      // 弹幕攻击模式：坐下状态的组件
      "api:mode_danmaku_attack_sit": {
        "add": {"component_groups": ["mode:danmaku_attack_sit", "mode:searching_danmaku_attack"]}
      },
      // 弹幕攻击模式：站起状态的组件
      "api:mode_danmaku_attack_stand": {
        "add": {"component_groups": ["mode:danmaku_attack", "mode:searching_danmaku_attack"]}
      },
      "api:mode_quit_danmaku_attack"  :{"sequence": [{"remove": {"component_groups": ["mode:danmaku_attack", "mode:danmaku_attack_sit", "mode:searching_danmaku_attack"]}}]},
      // 耕地模式：站起状态时添加组件
      "api:mode_farm": { "add": {"component_groups": ["mode:farm"]} },
      "api:mode_quit_farm"  :{"sequence": [{"remove": {"component_groups": ["mode:farm"]}}]},
      // 甘蔗模式：站起状态时添加组件
      "api:mode_sugar_cane": { "add": {"component_groups": ["mode:sugar_cane"]} },
      "api:mode_quit_sugar_cane": {"sequence": [{"remove": {"component_groups": ["mode:sugar_cane"]}, "set_property":{"thlm:work": 4}}]},
      // 瓜类模式：站起状态时添加组件
      "api:mode_melon": { "add": {"component_groups": ["mode:melon"]} },
      "api:mode_quit_melon": { "sequence": [{"remove": {"component_groups": ["mode:melon"]}, "set_property":{"thlm:work": 5}}]},
      // 可可模式：站起状态时添加组件
      "api:mode_cocoa": {"add": {"component_groups": ["mode:cocoa"]} },
      "api:mode_quit_cocoa": {"sequence": [{"remove": {"component_groups": ["mode:cocoa"]}, "set_property":{"thlm:work": 6}}]},

      //// 拾物模式 ////
      "api:mode_pick": {
        "add": {"component_groups": ["mode:pick"]},
        "remove": {"component_groups": ["mode:pick_sit"]}
      },
      "api:mode_pick_sit": {
        "add": {"component_groups": ["mode:pick_sit"]},
        "remove": {"component_groups": ["mode:pick"]}
      },
      "api:mode_quit_pick":{ "remove" : {"component_groups": ["mode:pick", "mode:pick_sit"] } },

      //// 背包类型 ////
      "api:backpack_default" :{ "add":{"component_groups":["backpack:default"]}, "set_property":{"thlm:backpack_type": 0}},
      "api:backpack_small"   :{ "add":{"component_groups":["backpack:small"  ]}, "set_property":{"thlm:backpack_type": 1}},
      "api:backpack_middle"  :{ "add":{"component_groups":["backpack:middle" ]}, "set_property":{"thlm:backpack_type": 2}},
      "api:backpack_big"     :{ "add":{"component_groups":["backpack:big"    ]}, "set_property":{"thlm:backpack_type": 3}},
      "api:backpack_invisible"     :{ "set_property":{"thlm:backpack_invisible": true } },
      "api:backpack_quit_invisible":{ "set_property":{"thlm:backpack_invisible": false} },

      ///// 环境变化 /////
      "environment:temperature_mild":{
        "set_property":{"environment:temperature": 0}
      },
      "environment:temperature_warm":{
        "set_property":{"environment:temperature": 1},
        "queue_command":{ "command": "playsound mob.thlmm.maid.hot @a ~~~"}
      },
      "environment:temperature_cold":{
        "set_property":{"environment:temperature": 2},
        "queue_command":{ "command": "playsound mob.thlmm.maid.cold @a ~~~"}
      },

      "environment:weather_clear":{ "set_property":{"environment:weather": 0} },
      "environment:weather_rain":{
        "set_property":{"environment:weather": 1},
        "queue_command": {"command": "playsound mob.thlmm.maid.rain @a ~~~"}
      },
      "environment:weather_snow":{
        "set_property":{"environment:weather": 2},
        "queue_command": {"command": "playsound mob.thlmm.maid.snow @a ~~~"}
      },

      "environment:morning":{ "set_property":{"environment:daytime": 1}, "queue_command":{ "command": ["playsound mob.thlmm.maid.morning @a ~~~"]}},
      "environment:night"  :{ "set_property":{"environment:daytime": 0}, "queue_command":{ "command": ["playsound mob.thlmm.maid.night @a ~~~"]}},
    }
  }
}