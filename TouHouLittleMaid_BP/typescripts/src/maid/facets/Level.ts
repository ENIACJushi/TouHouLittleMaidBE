import { Entity, system } from "@minecraft/server";
import { DP } from "../../libs/DynamicPropertyInterface";
import { Slots } from "../slots/main";
import { Movement } from "./Movement";
import { Pose } from "./Pose";

/** 单级属性表（含槽位组合用的攻击/生命/抗击退，及脚本承伤乘子） */
type LevelProperty = {
  danmaku: number;
  heal: [number, number];
  movement: number;
  /** 近战伤害 → Slots.attack */
  attack: number;
  /** 最大生命 → Slots.health */
  health: number;
  /** 抗击退百分制 → Slots.knockback（如 10 表示 0.1） */
  knockback: number;
  /**
   * 驯服后承伤乘子（对齐原 JSON damage_multiplier）。
   * 使用场景：Damage 管线内置 level 修正器读取。
   */
  damageTaken: number;
};

/**
 * 等级与对应属性（行为对齐 EntityMaid.Level）
 * basic 走槽位；驯服承伤由 Damage.beforeHurt 处理（不再挂 api:lv_N_tame）。
 */
export const Level = {
  max: 2,
  properties: [
    {// lv.1（对齐原 thlmm:lv1_basic / lv1_tame）
      "danmaku": 15,// 弹幕伤害
      "heal": [3, 6] as [number, number], // 单次回血量（3秒一次）
      "movement": 0.25, // 移速（脚本写入，JSON 不定义）
      "attack": 12,
      "health": 64,
      "knockback": 10,
      "damageTaken": 0.9,
    },
    {// lv.2（对齐原 thlmm:lv2_basic / lv2_tame）
      "danmaku": 24,
      "heal": [5, 8] as [number, number],
      "movement": 0.3,
      "attack": 16,
      "health": 70,
      "knockback": 20,
      "damageTaken": 0.75,
    },
    {// lv.3（预留，暂与 lv.2 同档）
      "danmaku": 24,
      "heal": [5, 8] as [number, number],
      "movement": 0.3,
      "attack": 16,
      "health": 70,
      "knockback": 20,
      "damageTaken": 0.75,
    },
  ] as LevelProperty[],
  str: [
    "§l§aLv.1§r",
    "§l§bLv.2§r",
    "§l§cLv.3§r",
    "§l§dLv.4§r",
    "§l§eLv.5§r",
    "§l§bL§cv§d.§e6§r",
  ],
  /**
   * 获取等级
   */
  get(maid: Entity): number | undefined {
    return DP.getInt(maid, "level");
  },
  /**
   * 获取等级字符串
   */
  getStr(maid: Entity): string {
    return this.str[this.get(maid)! - 1];
  },
  /**
   * 设置等级
   */
  set(maid: Entity, level: number): void {
    system.runTimeout(() => {
      this.eventBasic(maid, level);
      // 驯服承伤改由 Damage 管线按当前等级读 damageTaken，无需 JSON 事件
      // JSON 不再写等级移速，此处按姿态写入/锁定
      if (Pose.isSitting(maid)) {
        Movement.lock(maid);
      }
      else {
        Movement.unlock(maid);
      }
    }, 1);
    DP.setInt(maid, "level", level);
  },
  /**
   * 按等级挂载 basic 属性：attack / health / knockback 槽位组合
   */
  eventBasic(maid: Entity, level: number): void {
    const props = this.properties[level - 1];
    if (props === undefined) {
      return;
    }
    Slots.attack.set(maid, props.attack);
    Slots.health.set(maid, props.health);
    Slots.knockback.set(maid, props.knockback);
  },
  /**
   * 驯服成功后的等级侧钩子（历史：挂 api:lv_N_tame）。
   * 现承伤由脚本 Damage 处理，此处保留为空操作以免旧调用方报错。
   * 使用场景：MaidLifeCycleEvents.onTamed。
   */
  eventTamed(_maid: Entity, _level: number): void {
    // no-op：Task5 后不再依赖 JSON damage_sensor
  },
  /**
   * 属性值获取
   * @param key danmaku | heal | movement | attack | health | knockback | damageTaken
   */
  getProperty(maid: Entity, key: keyof LevelProperty): number | [number, number] {
    return this.properties[this.get(maid)! - 1][key];
  },
};
