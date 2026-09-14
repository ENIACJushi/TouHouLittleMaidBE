import { Entity, EntityHitEntityAfterEvent, system } from "@minecraft/server";
import { pointInArea_3D } from "../../libs/ScarletToolKit";
import { EntityMaid } from "../EntityMaid";
import { Work } from "../facets/Work";
import { Cocoa } from "./Cocoa";
import { Farm } from "./Farm";
import { Melon } from "./Melon";
import { SugarCane } from "./SugarCane";
import { WorkHandler } from "./types";

/**
 * 模式 → handler 映射（行为对齐旧 MaidTarget 分发）
 */
const workHandlers: Partial<Record<number, WorkHandler>> = {
  [Work.farm]: {
    search(maid, range = 6, force = false) {
      Farm.search(maid, range, force);
    },
    step(maid) {
      const target = maid.target;
      if (target !== undefined) Farm.acquire(target, maid);
    },
  },
  [Work.sugar_cane]: {
    search(maid, range = 6) {
      SugarCane.search(maid, range);
    },
    acquire(event) {
      SugarCane.acquire(event.hitEntity, event.damagingEntity);
    },
  },
  [Work.melon]: {
    search(maid, range = 6) {
      Melon.search(maid, range);
    },
    step(maid) {
      const target = maid.target;
      if (target !== undefined) Melon.acquire(target, maid);
    },
    acquire(event) {
      Melon.acquire(event.hitEntity, event.damagingEntity);
    },
  },
  [Work.cocoa]: {
    search(maid, range = 6) {
      Cocoa.search(maid, range);
    },
    step(maid) {
      const target = maid.target;
      if (target !== undefined) Cocoa.acquire(target, maid);
    },
  },
};

/**
 * 工作目标门面：search / stepEvent / targetAcquire
 * 行为与旧 maid/MaidTarget.js 一致，不引入全局调度。
 */
export class MaidTarget {
  /**
   * 标志物取得（命中目标实体）
   */
  static targetAcquire(event: EntityHitEntityAfterEvent): void {
    const target = event.hitEntity;
    switch (target.typeId.substring(6)) {
      case "sugar_cane":
        workHandlers[Work.sugar_cane]?.acquire?.(event);
        break;
      case "melon":
        workHandlers[Work.melon]?.acquire?.(event);
        break;
      default:
        break;
    }
  }

  /**
   * 寻找目标点
   */
  static search(maid: Entity, range = 6, force = false): void {
    const handler = workHandlers[EntityMaid.Work.get(maid)];
    handler?.search(maid, range, force);
  }

  /**
   * 因为不能穿墙攻击，使用脚本定时获取目标
   * 竖直方向最大高度差为 5 格；事件每 3 秒触发一次
   */
  static stepEvent(maid: Entity, work: number): void {
    for (let i = 0; i < 3; i++) {
      system.runTimeout(() => {
        try {
          if (maid === undefined) return;
          const target = maid.target;
          if (target !== undefined) {
            if (
              pointInArea_3D(
                target.location.x,
                target.location.y,
                target.location.z,
                maid.location.x - 2,
                maid.location.y - 5,
                maid.location.z - 2,
                maid.location.x + 2,
                maid.location.y + 5,
                maid.location.z + 2
              )
            ) {
              workHandlers[work]?.step?.(maid);
            }
            target.triggerEvent("cooldown");
          }
        } catch {
          /* 实体可能已失效 */
        }
      }, i * 20);
    }
  }
}
