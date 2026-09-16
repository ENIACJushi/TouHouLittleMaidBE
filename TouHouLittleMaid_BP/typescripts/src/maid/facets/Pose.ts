import { Entity } from "@minecraft/server";
import { Movement } from "./Movement";
import { PackedState } from "./PackedState";

/**
 * 女仆姿态位：坐下 / 抱起 / 睡觉（压缩在 thlm:anim 低三位）
 * 各位独立读写；业务上的互斥由调用方优先级处理，此处不强制清其它位。
 */
export const Pose = {
  isSitting(maid: Entity): boolean {
    return PackedState.has(maid, PackedState.BIT_SIT);
  },

  /**
   * 设置坐下位（由实体事件 thlmm:j / thlmm:v 写入）
   * 同步锁定/恢复 minecraft:movement，避免坐下后仍寻路移动
   */
  setSitting(maid: Entity, value: boolean): void {
    PackedState.setBit(maid, PackedState.BIT_SIT, value);
    if (value) {
      Movement.lock(maid);
    }
    else {
      Movement.unlock(maid);
    }
  },

  isHug(maid: Entity): boolean {
    return PackedState.has(maid, PackedState.BIT_HUG);
  },

  setHug(maid: Entity, value: boolean): void {
    PackedState.setBit(maid, PackedState.BIT_HUG, value);
  },

  isSleeping(maid: Entity): boolean {
    return PackedState.has(maid, PackedState.BIT_SLEEP);
  },

  setSleeping(maid: Entity, value: boolean): void {
    PackedState.setBit(maid, PackedState.BIT_SLEEP, value);
  },

  /** 坐下（触发实体事件 thlmm:v） */
  sitDown(maid: Entity): void {
    maid.triggerEvent("thlmm:v");
  },

  /** 站起（触发实体事件 thlmm:w） */
  standUp(maid: Entity): void {
    maid.triggerEvent("thlmm:w");
  },
};
