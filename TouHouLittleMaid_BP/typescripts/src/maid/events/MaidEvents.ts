import {MaidCoupledEvents} from "./MaidCoupledEvents";
import {MaidInteractEvents} from "./MaidInteractEvents";
import {MaidLifeCycleEvents} from "./MaidLifeCycleEvents";
import {MaidScheduleEvents} from "./MaidScheduleEvents";

export namespace MaidEvents {
  export const interact = new MaidInteractEvents();
  export const lifeCycle = new MaidLifeCycleEvents();
  export const schedule = new MaidScheduleEvents();
  export const coupled = new MaidCoupledEvents();
}