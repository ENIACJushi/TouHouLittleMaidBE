import { Entity, EntityHitEntityAfterEvent } from "@minecraft/server";

/**
 * 工作目标处理器接口（按工作模式分发 search / step / acquire）
 */
export interface WorkHandler {
  /** 寻找并放置目标；range/force 与旧 MaidTarget.search 一致 */
  search(maid: Entity, range?: number, force?: boolean): void;
  /** stepEvent 中目标在近距离时调用（可选） */
  step?(maid: Entity): void;
  /** 命中目标实体时调用（可选） */
  acquire?(event: EntityHitEntityAfterEvent): void;
}
