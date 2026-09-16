import {MaidCoupledEvents} from "./MaidCoupledEvents";
import {maidInteractEvents} from "./MaidInteractEvents";
import {MaidLifeCycleEvents} from "./MaidLifeCycleEvents";
import {MaidScheduleEvents} from "./MaidScheduleEvents";
import { Work } from "../facets/Work";
import { MaidTarget } from "../work/MaidTarget";
import type { EntityHitEntityAfterEvent } from "@minecraft/server";

export namespace MaidEvents {
  export const interact = maidInteractEvents;
  export const lifeCycle = new MaidLifeCycleEvents();
  export const schedule = new MaidScheduleEvents();
  export const coupled = new MaidCoupledEvents();

  /** 标记实体命中 → 工作 acquire（供 EntityEvents 等包外入口调用） */
  export function targetAcquire(event: EntityHitEntityAfterEvent): void {
    MaidTarget.targetAcquire(event);
  }
}

// 工作模式变更后索敌：在 events 层接线，保持 facets/Work 不依赖 work 模块
Work.setOnWorkChanged((maid) => MaidTarget.search(maid, 15));
