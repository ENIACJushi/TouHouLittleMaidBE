/**
 * @deprecated
 * 这种传统的事件管理模式可能并不适合mc 或者说本模组的事件需求
 *  大部分的事件都只需要一个响应，并且通常是一旦注册就不会解除的，不需要这种注册机制来管理
 *  如果要让事件响应更清晰，应该是把各种事件的响应分别组织在不同的文件里
 */
import { MaidEvents } from "./MaidEvents";


export class MaidEventManager {
  private eventCallbacks: Map<string, EventData[]> = new Map<string, EventData[]>();

  constructor() {

  }

  private registerNativeEvents() {

  }

  /**
   * 注册事件
   * @param eventName 事件名称
   * @param callback 回调
   * @param priority 优先级 高者先执行 不指定时默认排到已注册回调之后 所有不指定优先级的回调都会在有指定优先级的回调之后执行
   */
  public register<T extends keyof MaidEvents>(
    eventName: T, callback: (data?: MaidEvents[T])=>void, priority?: number): void {
    let eventList = this.eventCallbacks.get(eventName);
    if (eventList) {
      if (priority !== undefined) {
        for (let i = 0; i < eventList.length; i++) {
          let priorityI = eventList[i].priority;
          if (priorityI === undefined || priorityI < priority) {
            // 找到了无优先级或小于给定优先级的事件的事件，在其前方插入
            eventList.splice(i, 0, {callback, priority});
            return;
          }
        }
      }
      // 没给定优先级 或没有找到比给定优先级更小的回调，则在最后插入
      eventList.push({callback});
      return;
    }
    this.eventCallbacks.set(eventName, [{callback, priority}]);
  }

  public unregister<T extends keyof MaidEvents>(eventName: T, callback: (data?: MaidEvents[T])=>void): void {
    let eventList = this.eventCallbacks.get(eventName);
    if (!eventList) {
      return;
    }
    let index = eventList.findIndex(data => data.callback === callback);
    if (index >= 0) {
      eventList.splice(index, 1);
    }
  }

  public emit<T extends keyof MaidEvents>(eventName: T, data?: MaidEvents[T]): void {
    let eventList = this.eventCallbacks.get(eventName);
    if (!eventList || eventList.length === 0) {
      return;
    }
    eventList.forEach((eventData) => {
      eventData.callback(data);
    });
  }
}

interface EventData {
  callback: Function;
  priority?: number;
}