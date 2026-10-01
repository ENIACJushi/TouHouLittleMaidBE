/**
 * 精准目标 Seek 门面（Task6 Phase 2）。
 * 使用场景：allocate 槽位 → mount 女仆 → stamp 目标；quit/release/resetTarget 释放。
 * 不接入 Farm / Work；验收走 SeekTest。
 */
import { Entity } from "@minecraft/server";
import { IntSlotDef } from "../slots/registry";
import { clearIntSlot, isIntTokenInRange, setIntSlot } from "../slots/runtime";
import { Logger } from "../../controller/Logger";

const TAG = "EntityMaid.Seek";

/** Seek 槽元数据：与 MaidGenerator Seek.js 的 0..255 对齐 */
const SEEK_SLOT: IntSlotDef = {
  id: "seek",
  kind: "int",
  min: 0,
  max: 255,
};

/** 目标未认领时的 thlmt:value */
export const SEEK_UNCLAIMED = -1;

/** 正式探针 / 目标点实体类型 */
export const SEEK_MARKER_TYPE = "thlmt:seek_marker";

/** 已分配尚未 free 的 seekId（进程内池；女仆消散不自动回收） */
const usedIds = new Set<number>();

/**
 * 从女仆属性读当前 Seek 档；未挂载（-1 / 非法）返回 undefined。
 */
function readSeekIndex(maid: Entity): number | undefined {
  const v = maid.getProperty("thlm:seek_index");
  if (typeof v !== "number" || !Number.isInteger(v) || v < SEEK_SLOT.min) {
    return undefined;
  }
  if (!isIntTokenInRange(SEEK_SLOT, v)) {
    return undefined;
  }
  return v;
}

/**
 * 精准目标控制系统脚本门面。
 */
export const Seek = {
  /** 容量（档位数） */
  CAPACITY: SEEK_SLOT.max - SEEK_SLOT.min + 1,
  /** 最小 seekId */
  MIN: SEEK_SLOT.min,
  /** 最大 seekId */
  MAX: SEEK_SLOT.max,
  /** 未认领 value */
  UNCLAIMED: SEEK_UNCLAIMED,
  /** 标记实体 typeId */
  MARKER_TYPE: SEEK_MARKER_TYPE,
  /** 槽位定义（只读） */
  def: SEEK_SLOT,

  /**
   * 分配一个空闲 seekId；耗尽返回 undefined。
   * 使用场景：绑定一对「女仆 Seek ↔ 目标 stamp」前先占坑。
   */
  allocate(): number | undefined {
    for (let id = SEEK_SLOT.min; id <= SEEK_SLOT.max; id++) {
      if (!usedIds.has(id)) {
        usedIds.add(id);
        return id;
      }
    }
    Logger.warn(TAG, "allocate: seekId 池已满");
    return undefined;
  },

  /**
   * 将 seekId 归还池中（不触发实体事件）。
   * 使用场景：业务结束或分配失败回滚；通常在 quit + release 之后调用。
   */
  free(seekId: number): void {
    if (!isIntTokenInRange(SEEK_SLOT, seekId)) {
      return;
    }
    usedIds.delete(seekId);
  },

  /**
   * 查询 id 是否仍被池占用。
   */
  isAllocated(seekId: number): boolean {
    return usedIds.has(seekId);
  },

  /**
   * 当前已分配数量（验收 / 诊断）。
   */
  allocatedCount(): number {
    return usedIds.size;
  },

  /**
   * 挂载 `slot:seek_<id>`（仅索敌 NAT）；若已有其它档会先 quit（含 reset_target）。
   * 追逐须另调 `mountPursue`（不与本事件绑定，便于换追逐实现）。
   * @returns 是否成功
   */
  mount(maid: Entity, seekId: number): boolean {
    if (!isIntTokenInRange(SEEK_SLOT, seekId)) {
      Logger.warn(TAG, `mount: 非法 seekId=${seekId}`);
      return false;
    }
    return setIntSlot(maid, SEEK_SLOT, seekId, {
      readCurrent: readSeekIndex,
      trackDp: false,
    });
  },

  /**
   * 卸下当前 Seek 档（NAT）；不自动卸追逐，请配合 `quitPursue`。
   */
  quit(maid: Entity): void {
    clearIntSlot(maid, SEEK_SLOT, {
      readCurrent: readSeekIndex,
      trackDp: false,
    });
  },

  /**
   * 默认追逐事件名（短距 ranged_attack）；后续可扩展其它 pursue 变体事件。
   * 使用场景：Path.follow Walk 段；业务可改挂其它 `slot:seek_pursue_*`。
   */
  PURSUE_DEFAULT: "slot:seek_pursue",

  /**
   * 挂载追逐组件（与 Seek 档分离；默认同 `PURSUE_DEFAULT`）。
   * 使用场景：mount(seekId) 之后再调；换实现时传其它事件 id。
   */
  mountPursue(maid: Entity, pursueEvent: string = "slot:seek_pursue"): void {
    try {
      maid.triggerEvent(pursueEvent);
    } catch (e) {
      Logger.warn(TAG, `mountPursue(${pursueEvent}) failed: ${String(e)}`);
    }
  },

  /**
   * 卸下追逐组件（默认 `slot:seek_pursue_quit`）。
   */
  quitPursue(maid: Entity, pursueQuitEvent: string = "slot:seek_pursue_quit"): void {
    try {
      maid.triggerEvent(pursueQuitEvent);
    } catch (e) {
      Logger.warn(TAG, `quitPursue(${pursueQuitEvent}) failed: ${String(e)}`);
    }
  },

  /**
   * 读取女仆当前 seekId；未挂载返回 -1。
   */
  getIndex(maid: Entity): number {
    return readSeekIndex(maid) ?? SEEK_UNCLAIMED;
  },

  /**
   * 在目标上盖锁：`thlmt:value = seekId`，仅挂同档 Seek 的女仆可索敌。
   */
  stamp(target: Entity, seekId: number): boolean {
    if (!isIntTokenInRange(SEEK_SLOT, seekId)) {
      Logger.warn(TAG, `stamp: 非法 seekId=${seekId}`);
      return false;
    }
    try {
      target.setProperty("thlmt:value", seekId);
      return true;
    } catch (e) {
      Logger.warn(TAG, `stamp failed: ${String(e)}`);
      return false;
    }
  },

  /**
   * 释放目标锁：`thlmt:value = -1`（不自动 reset 女仆仇恨；配合 quit/resetTarget）。
   */
  release(target: Entity): boolean {
    try {
      target.setProperty("thlmt:value", SEEK_UNCLAIMED);
      return true;
    } catch (e) {
      Logger.warn(TAG, `release failed: ${String(e)}`);
      return false;
    }
  },

  /**
   * 读取目标当前 value；无属性时返回 undefined。
   */
  getStamp(target: Entity): number | undefined {
    const v = target.getProperty("thlmt:value");
    return typeof v === "number" ? v : undefined;
  },

  /**
   * 仅清女仆仇恨，保留 Seek 组件组 → `api:reset_target`。
   */
  resetTarget(maid: Entity): void {
    maid.triggerEvent("api:reset_target");
  },
};
