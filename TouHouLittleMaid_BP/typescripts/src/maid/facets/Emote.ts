import { Entity, system } from "@minecraft/server";
import { emote } from "../../../data/emote";
import { Backpack } from "./Backpack";

/** 按实体 id 分存的表情超时句柄（修复原全局单例 timeout 的等价 bug） */
const emoteTimeouts = new Map<string, number>();

/**
 * 表情（行为对齐 EntityMaid.Emote；timeout 改为 per-entity）
 */
export const Emote = {
  /**
   * 获取当前表情 ID
   */
  get(maid: Entity): number {
    return maid.getProperty("thlm:emote") as number;
  },
  /**
   * 设置表情 ID
   */
  set(maid: Entity, index: number): void {
    let entityId = maid.id;
    let prev = emoteTimeouts.get(entityId);
    if (prev !== undefined) {
      system.clearRun(prev);
      emoteTimeouts.delete(entityId);
    }
    let value = index;
    if (emote[index] !== undefined) {
      value += 1000 * emote[index][0];
      value += 1000000 * emote[index][1];
      let timeout = system.runTimeout(() => {
        emoteTimeouts.delete(entityId);
        Emote.set(maid, 0);
      }, emote[index][2]);
      emoteTimeouts.set(entityId, timeout);
    }
    maid.setProperty("thlm:emote", value);
  },
  /**
   * 清除表情
   */
  clear(maid: Entity): void {
    this.set(maid, 0);
  },
  // 背包 起始位置1
  backpack(maid: Entity): void {
    this.set(maid, 1 + Backpack.getType(maid));
  },
  /** 苹果 5 */
  apple(maid: Entity): void { this.set(maid, 5); },
  /** 蛋糕 6 */
  cake(maid: Entity): void { this.set(maid, 6); },
};
