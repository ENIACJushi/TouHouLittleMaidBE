import {MaidCoupledEvents} from "./MaidCoupledEvents";
import {maidInteractEvents} from "./MaidInteractEvents";
import {MaidLifeCycleEvents} from "./MaidLifeCycleEvents";
import {MaidScheduleEvents} from "./MaidScheduleEvents";
import { Work } from "../facets/Work";
import { MaidTarget } from "../work/MaidTarget";
import type { EntityHitEntityAfterEvent } from "@minecraft/server";
import { onMaidInvalid } from "./MaidPresence";

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

// 工作模式变更后：先放下旧农作任务，再为新模式索敌。facets/Work 不依赖 work 模块。
Work.setOnWorkChanged((maid, prev, next) => {
  if (prev !== next) {
    MaidTarget.leaveWork(maid, prev);
  }
  MaidTarget.search(maid, 15);
});
onMaidInvalid((info) => {
  MaidTarget.onMaidInvalid(info.id);
});
