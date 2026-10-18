import { Entity, EntityHitEntityAfterEvent, system, world } from "@minecraft/server";
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
      // Phase3：正常收尾走 Path.onComplete；脉冲仅兜底孤儿 job + 空闲补派
      Farm.onSchedulePulse(maid);
    },
  },
  [Work.sugar_cane]: {
    search(maid, range = 6) {
      SugarCane.search(maid, range);
    },
    step(maid) {
      SugarCane.onSchedulePulse(maid);
    },
  },
  [Work.melon]: {
    search(maid, range = 6) {
      Melon.search(maid, range);
    },
    step(maid) {
      Melon.onSchedulePulse(maid);
    },
  },
  [Work.cocoa]: {
    search(maid, range = 6) {
      Cocoa.search(maid, range);
    },
    step(maid) {
      Cocoa.onSchedulePulse(maid);
    },
  },
};

/**
 * 工作目标门面：search / stepEvent / targetAcquire
 * 行为与旧 maid/MaidTarget.js 一致，不引入全局调度。
 */
export class MaidTarget {
  /**
   * 命中 thlmt 标记。耕地、甘蔗、瓜、可可已不再靠标记收菜。
   */
  static targetAcquire(_event: EntityHitEntityAfterEvent): void {}

  /**
   * 寻找目标点
   */
  static search(maid: Entity, range = 6, force = false): void {
    const handler = workHandlers[EntityMaid.Work.get(maid)];
    handler?.search(maid, range, force);
  }

  /**
   * 离开某个脚本农作模式时解开占用并清掉任务。
   * 使用场景：Work.set 的模式变更回调，且前后模式不同。
   */
  static leaveWork(maid: Entity, prev: number): void {
    switch (prev) {
      case Work.farm:
        Farm.abandon(maid);
        break;
      case Work.sugar_cane:
        SugarCane.abandon(maid);
        break;
      case Work.melon:
        Melon.abandon(maid);
        break;
      case Work.cocoa:
        Cocoa.abandon(maid);
        break;
      default:
        break;
    }
  }

  /**
   * 女仆失效：人还在就当场清任务，人不在就先放开格子。
   * 使用场景：死亡、拍照、魂符收回、thlmm:t 超时。
   */
  static onMaidInvalid(id: string): void {
    let maid: Entity | undefined;
    try {
      maid = world.getEntity(id);
    } catch {
      maid = undefined;
    }
    if (maid?.isValid) {
      Farm.abandon(maid);
      SugarCane.abandon(maid);
      Melon.abandon(maid);
      Cocoa.abandon(maid);
      return;
    }
    Farm.markStale(id);
    SugarCane.markStale(id);
    Melon.markStale(id);
    Cocoa.markStale(id);
  }

  /**
   * 卸载后又收到 thlmm:t：清掉没写掉的农作任务。
   * 使用场景：日程定时事件里，先于本拍收割。
   */
  static settleReturned(maid: Entity): void {
    Farm.settle(maid);
    SugarCane.settle(maid);
    Melon.settle(maid);
    Cocoa.settle(maid);
  }

  /**
   * 因为不能穿墙攻击，使用脚本定时获取目标
   * 竖直方向最大高度差为 5 格；事件每 3 秒触发一次
   * 耕地、甘蔗、瓜、可可自管 Path.follow，只脉冲一次（避免三次全图扫描）
   */
  static stepEvent(maid: Entity, work: number): void {
    if (
      work === Work.farm ||
      work === Work.sugar_cane ||
      work === Work.melon ||
      work === Work.cocoa
    ) {
      system.runTimeout(() => {
        try {
          if (maid?.isValid) {
            workHandlers[work]?.step?.(maid);
          }
        } catch {
          /* 实体可能已失效 */
        }
      }, 1);
      return;
    }
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
