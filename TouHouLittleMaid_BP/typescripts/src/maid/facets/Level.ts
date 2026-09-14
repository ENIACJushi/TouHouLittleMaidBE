import { Entity, system } from "@minecraft/server";
import { DP } from "../../libs/DynamicPropertyInterface";
import { Movement } from "./Movement";
import { isSitting } from "./Anim";

/** 单级属性表 */
type LevelProperty = {
  danmaku: number;
  heal: [number, number];
  movement: number;
};

/**
 * 等级与对应属性（行为对齐 EntityMaid.Level）
 */
export const Level = {
  max: 2,
  properties: [
    {// lv.1
      "danmaku": 15,// 弹幕伤害
      "heal": [3, 6] as [number, number], // 单次回血量（3秒一次）
      "movement": 0.25, // 移速（脚本写入，JSON 不定义）
    },
    {// lv.2
      "danmaku": 24,
      "heal": [5, 8] as [number, number],
      "movement": 0.3,
    },
    {// lv.3（预留，暂与 lv.2 同速）
      "danmaku": 24,
      "heal": [5, 8] as [number, number],
      "movement": 0.3,
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
    if (oldLevel !== undefined) {
      maid.triggerEvent(`api:lv_${oldLevel}_basic_quit`);
    }
    if (maid.getComponent("minecraft:is_tamed") !== undefined) {
      maid.triggerEvent(`api:lv_${oldLevel}_tame_quit`);
    }

    system.runTimeout(() => {
      this.eventBasic(maid, level);
      if (maid.getComponent("minecraft:is_tamed") !== undefined) {
        this.eventTamed(maid, level);
      }
      // JSON 不再写等级移速，此处按姿态写入/锁定
      if (isSitting(maid)) {
        Movement.lock(maid);
      }
      else {
        Movement.unlock(maid);
      }
    }, 1);
    DP.setInt(maid, "level", level);
  },
  /**
   * 触发基础事件
   */
  eventBasic(maid: Entity, level: number): void {
    maid.triggerEvent(`api:lv_${level}_basic`);
  },
  /**
   * 触发驯服事件
   */
  eventTamed(maid: Entity, level: number): void {
    maid.triggerEvent(`api:lv_${level}_tame`);
  },
  /**
   * 属性值获取
   * @param key danmaku | heal | movement
   */
  getProperty(maid: Entity, key: keyof LevelProperty): number | [number, number] {
    return this.properties[this.get(maid)! - 1][key];
  },
};
