import { Entity } from "@minecraft/server";
import { Movement } from "./Movement";
import { PackedState } from "./PackedState";

/**
 * Path.cancel 注入点（由 Executor 模块加载时绑定）。
 * 使用场景：避免 Pose ↔ Path/Executor 静态环依赖。
 */
let cancelFollowHook: ((maid: Entity) => void) | undefined;

/**
 * 绑定「姿态阻断时取消 follow」回调。
 * 使用场景：Executor 模块初始化。
 */
export function setCancelFollowHook(fn: (maid: Entity) => void): void {
  cancelFollowHook = fn;
}

/** 进入阻断姿态时取消 follow（hook 未绑定时为空操作）。 */
function abortFollow(maid: Entity): void {
  try {
    cancelFollowHook?.(maid);
  } catch {
    /* ignore */
  }
}

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
   * 同步锁定/恢复 minecraft:movement，避免坐下后仍寻路移动；坐下时取消 Path.follow。
   */
  setSitting(maid: Entity, value: boolean): void {
    PackedState.setBit(maid, PackedState.BIT_SIT, value);
    if (value) {
      Movement.lock(maid);
      abortFollow(maid);
    }
    else {
      Movement.unlock(maid);
    }
  },

  isHug(maid: Entity): boolean {
    return PackedState.has(maid, PackedState.BIT_HUG);
  },

  /**
   * 设置抱起位；进入抱起时取消 Path.follow（通常已随 onSit 坐下取消，此处兜底）。
   */
  setHug(maid: Entity, value: boolean): void {
    PackedState.setBit(maid, PackedState.BIT_HUG, value);
    if (value) {
      abortFollow(maid);
    }
  },

  isSleeping(maid: Entity): boolean {
    return PackedState.has(maid, PackedState.BIT_SLEEP);
  },

  /**
   * 设置睡觉位；进入睡觉时取消 Path.follow（位已定义，业务写入时生效）。
   */
  setSleeping(maid: Entity, value: boolean): void {
    PackedState.setBit(maid, PackedState.BIT_SLEEP, value);
    if (value) {
      abortFollow(maid);
    }
  },

  /**
   * 是否处于应终止 / 拒绝 Path.follow 的姿态（坐下 / 抱起 / 睡觉）。
   * 使用场景：Executor.start / tickAll 兜底；与 setSitting/setHug/setSleeping 边沿 cancel 互补。
   */
  blocksFollow(maid: Entity): boolean {
    return this.isSitting(maid) || this.isHug(maid) || this.isSleeping(maid);
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
