import { Entity, system } from "@minecraft/server";
import { DP } from "../../libs/DynamicPropertyInterface";
import { Slots } from "../slots/main";
import { Movement } from "./Movement";
import { Pose } from "./Pose";

/** 单级属性表（含槽位组合用的攻击/生命/抗击退） */
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
};

/**
 * 等级与对应属性（行为对齐 EntityMaid.Level）
 * basic 段已改走槽位组合；tame 段仍用 api:lv_N_tame。
 */
export const Level = {
  max: 2,
  properties: [
    {// lv.1（对齐原 thlmm:lv1_basic）
      "danmaku": 15,// 弹幕伤害
      "heal": [3, 6] as [number, number], // 单次回血量（3秒一次）
      "movement": 0.25, // 移速（脚本写入，JSON 不定义）
      "attack": 12,
      "health": 64,
      "knockback": 10,
    },
    {// lv.2（对齐原 thlmm:lv2_basic）
      "danmaku": 24,
      "heal": [5, 8] as [number, number],
      "movement": 0.3,
      "attack": 16,
      "health": 70,
      "knockback": 20,
    },
    {// lv.3（预留，暂与 lv.2 同档）
      "danmaku": 24,
      "heal": [5, 8] as [number, number],
      "movement": 0.3,
      "attack": 16,
      "health": 70,
      "knockback": 20,
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
    let oldLevel = this.get(maid);
    // tame 捆包仍走 api；basic 改由 eventBasic 清旧捆包并挂槽位
    if (oldLevel !== undefined && maid.getComponent("minecraft:is_tamed") !== undefined) {
      maid.triggerEvent(`api:lv_${oldLevel}_tame_quit`);
    }

    system.runTimeout(() => {
      this.eventBasic(maid, level);
      if (maid.getComponent("minecraft:is_tamed") !== undefined) {
        this.eventTamed(maid, level);
      }
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
   * 卸下历史 api:lv_*_basic 捆包（与原子槽互斥；含 become_maid 初始挂载的 lv1_basic）
   */
  quitLegacyBasic(maid: Entity): void {
    for (let lv = 1; lv <= this.max; lv++) {
      maid.triggerEvent(`api:lv_${lv}_basic_quit`);
    }
  },
  /**
   * 按等级挂载 basic 属性：attack / health / knockback 槽位组合
   */
  eventBasic(maid: Entity, level: number): void {
    const props = this.properties[level - 1];
    if (props === undefined) {
      return;
    }
    this.quitLegacyBasic(maid);
    Slots.attack.set(maid, props.attack);
    Slots.health.set(maid, props.health);
    Slots.knockback.set(maid, props.knockback);
  },
  /**
   * 触发驯服事件（damage_sensor 捆包，仍走 api）
   */
  eventTamed(maid: Entity, level: number): void {
    maid.triggerEvent(`api:lv_${level}_tame`);
  },
  /**
   * 属性值获取
   * @param key danmaku | heal | movement | attack | health | knockback
   */
  getProperty(maid: Entity, key: keyof LevelProperty): number | [number, number] {
    return this.properties[this.get(maid)! - 1][key];
  },
};
