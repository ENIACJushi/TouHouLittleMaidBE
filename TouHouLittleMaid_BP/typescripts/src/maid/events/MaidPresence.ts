/**
 * 已观测女仆的失效通知。
 * 使用场景：死亡、拍照收走、魂符收回时立刻通知。
 * 其余情况看 thlmm:t：这个事件每 3 秒由女仆自己发出，超过 10 秒没再到就当作失效。
 * 农作解占用等后续再订阅，这里不改工作状态。
 */
import { Entity, system } from "@minecraft/server";
import { Logger } from "../../controller/Logger";

const TAG = "MaidPresence";
const MAID_TYPE_ID = "thlmm:maid";

/**
 * 女仆定时器是 3 秒一次。10 秒里本来至少能接到两次，一次没接到不算失效。
 * 使用场景：thlmm:t 中断后的兜底。
 */
const BEAT_TIMEOUT_MS = 10_000;

/**
 * 和超时同一档：10 秒看一次已记下的时间，不读世界。
 * 使用场景：发现哪名女仆的 thlmm:t 断了。最晚再晚一个间隔才通知。
 */
const WATCH_INTERVAL_TICKS = BEAT_TIMEOUT_MS / 50;

/** 已知会把女仆从世界上拿走的原因。missing 是 thlmm:t 超时。 */
export type MaidInvalidReason = "death" | "photo" | "smart_slab" | "missing";

/** 失效时还能确定的内容。实体多半已经不能再读。 */
export type MaidInvalidInfo = {
  id: string;
  reason: MaidInvalidReason;
};

export type MaidInvalidListener = (info: MaidInvalidInfo) => void;

const lastBeat = new Map<string, number>();
/** 已经通知过、且之后没有再接到 thlmm:t 的 id。避免死亡和超时各报一次。 */
const closed = new Set<string>();
const listeners = new Set<MaidInvalidListener>();

let watchHandle: number | undefined;

/**
 * 记下这名女仆刚刚发出了 thlmm:t。
 * 使用场景：日程定时事件。没发过这个事件的实体（例如没有基础计时器的雕塑）不进入名单。
 */
export function noteMaidBeat(maid: Entity): void {
  try {
    if (!maid.isValid || maid.typeId !== MAID_TYPE_ID) {
      return;
    }
  } catch {
    return;
  }
  closed.delete(maid.id);
  lastBeat.set(maid.id, Date.now());
}

/**
 * 通知这名女仆已从世界上失效。同一 id 在再次接到 thlmm:t 前只通知一次。
 * 使用场景：死亡、拍照、魂符收回，以及定时事件超时。
 */
export function invalidateMaid(id: string, reason: MaidInvalidReason): void {
  if (closed.has(id)) {
    return;
  }
  closed.add(id);
  lastBeat.delete(id);
  Logger.debug(TAG, `失效 ${id} (${reason})`);
  const info: MaidInvalidInfo = { id, reason };
  for (const listener of listeners) {
    try {
      listener(info);
    } catch (e) {
      Logger.warn(TAG, `失效监听失败: ${String(e)}`);
    }
  }
}

/**
 * 订阅女仆失效。返回退订函数。
 * 使用场景：以后解农作占用。现在还没有订阅者。
 */
export function onMaidInvalid(listener: MaidInvalidListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * 开始核对 thlmm:t 是否还在跳。重复调用不会再挂一次。
 * 使用场景：实体事件注册完成时。
 */
export function startMaidPresenceWatch(): void {
  if (watchHandle !== undefined) {
    return;
  }
  watchHandle = system.runInterval(() => {
    const now = Date.now();
    for (const [id, at] of lastBeat) {
      if (now - at >= BEAT_TIMEOUT_MS) {
        invalidateMaid(id, "missing");
      }
    }
  }, WATCH_INTERVAL_TICKS);
}
