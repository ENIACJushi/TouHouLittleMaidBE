/**
 * 精准目标 Seek 门面（Task6 Phase 2）。
 * 使用场景：allocate 槽位 → mount 女仆 → stamp 目标；quit/release/resetTarget 释放。
 * NAT：默认严格 must_reach=true（原版寻路）；脚本段 mountSoft（false）。
 * 当前档：动态属性 `slot_seek`（不占实体属性、不同步客户端）。
 * 路点 TTL：spawn 后 ttl_start，持有方 ttl_renew；重启残留见 recoverResidual / purgeOrphanMarkers。
 */
import { Entity, world } from "@minecraft/server";
import { DP } from "../../libs/DynamicPropertyInterface";
import { Logger } from "../../controller/Logger";
import { slotDpKey } from "../slots/names";
import { IntSlotDef } from "../slots/registry";
import {
  clearIntSlot,
  getIntSlot,
  isIntTokenInRange,
  setIntSlot,
} from "../slots/runtime";

const TAG = "EntityMaid.Seek";

/**
 * 动态属性：当前 NAT 是否为宽松档（must_reach false）。
 * 使用场景：ensureSeek 从脚本段切回原版时强制 remount 严格档。
 */
const DP_NAT_SOFT = "seek_nat_soft";

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
 * 从动态属性读当前 Seek 档；未挂载 / 非法返回 undefined。
 * 使用场景：mount / quit / getIndex；权威来源 `slot_seek`。
 */
function readSeekIndex(maid: Entity): number | undefined {
  const v = getIntSlot(maid, SEEK_SLOT);
  if (v === undefined || !isIntTokenInRange(SEEK_SLOT, v)) {
    return undefined;
  }
  return v;
}

/**
 * 写入当前 Seek 档 DP（不触发实体事件）。
 * 使用场景：mountStrict / mountSoft 只切组件组时与脚本记录对齐。
 */
function writeSeekIndex(maid: Entity, seekId: number): void {
  DP.setInt(maid, slotDpKey(SEEK_SLOT.id), seekId);
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
   * 挂载严格 NAT（`slot:seek_<id>`，must_reach=true）。
   * 使用场景：Path FollowAI / 原版追逐段；同档若在 soft 上则强制切回严格。
   * @returns 是否成功
   */
  mount(maid: Entity, seekId: number): boolean {
    if (!isIntTokenInRange(SEEK_SLOT, seekId)) {
      Logger.warn(TAG, `mount: 非法 seekId=${seekId}`);
      return false;
    }
    // 同档时 setIntSlot 会短路，软档须走 mountStrict
    if (readSeekIndex(maid) === seekId) {
      return Seek.mountStrict(maid, seekId);
    }
    const ok = setIntSlot(maid, SEEK_SLOT, seekId);
    if (ok) {
      try {
        DP.setBoolean(maid, DP_NAT_SOFT, false);
      } catch {
        /* ignore */
      }
    }
    return ok;
  },

  /**
   * 强制切回严格 NAT（同档也会再 trigger；卸 soft）。
   * 使用场景：ScriptFollow 结束 → ensureSeek；setIntSlot 同档短路时用本 API。
   */
  mountStrict(maid: Entity, seekId: number): boolean {
    if (!isIntTokenInRange(SEEK_SLOT, seekId)) {
      Logger.warn(TAG, `mountStrict: 非法 seekId=${seekId}`);
      return false;
    }
    try {
      maid.triggerEvent(`slot:seek_${seekId}`);
      writeSeekIndex(maid, seekId);
      DP.setBoolean(maid, DP_NAT_SOFT, false);
      return true;
    } catch (e) {
      Logger.warn(TAG, `mountStrict(${seekId}) failed: ${String(e)}`);
      return false;
    }
  },

  /**
   * 切宽松 NAT（`slot:seek_<id>_soft`，must_reach=false）。
   * 使用场景：脚本冲量 / ScriptFollow；须已挂载同档（DP `slot_seek`）。
   */
  mountSoft(maid: Entity, seekId?: number): boolean {
    const id = seekId ?? readSeekIndex(maid);
    if (id === undefined || !isIntTokenInRange(SEEK_SLOT, id)) {
      Logger.warn(TAG, `mountSoft: 无有效 seekId`);
      return false;
    }
    try {
      maid.triggerEvent(`slot:seek_${id}_soft`);
      writeSeekIndex(maid, id);
      DP.setBoolean(maid, DP_NAT_SOFT, true);
      return true;
    } catch (e) {
      Logger.warn(TAG, `mountSoft(${id}) failed: ${String(e)}`);
      return false;
    }
  },

  /**
   * 当前是否宽松 NAT。
   * 使用场景：ensureSeek 决定是否 mountStrict。
   */
  isNatSoft(maid: Entity): boolean {
    try {
      return DP.getBoolean(maid, DP_NAT_SOFT) === true;
    } catch {
      return false;
    }
  },

  /**
   * 卸下当前 Seek 档（严格+soft NAT）；不自动卸追逐，请配合 `quitPursue`。
   */
  quit(maid: Entity): void {
    clearIntSlot(maid, SEEK_SLOT);
    try {
      DP.setBoolean(maid, DP_NAT_SOFT, false);
    } catch {
      /* ignore */
    }
  },

  /**
   * 终点追逐事件名（melee reach_multiplier=10 → 世界距 3，与 Arrive.ARRIVE_GOAL_R 对齐）。
   * 使用场景：Path.follow 终点；命中 seek_marker → Executor 判抵达。
   * 改触及：Seek.js `slot:seek_pursue` + Arrive.SEEK_PURSUE_REACH_MULTIPLIER → build:maid。
   */
  PURSUE_DEFAULT: "slot:seek_pursue",

  /**
   * 途经追逐事件名（melee reach_multiplier=0，贴紧；切段靠脚本距离）。
   * 使用场景：Path.follow 中间路点；与 Arrive.ARRIVE_VIA_R 故意不同源。
   */
  PURSUE_VIA: "slot:seek_pursue_via",

  /**
   * 脚本代理目视事件名（仅 look_at_target / look，无 move）。
   * 使用场景：冲量代理段；与追逐互斥。
   */
  LOOK: "slot:seek_look",

  /**
   * 挂载追逐组件（与 Seek 档分离；默认同 `PURSUE_DEFAULT`）。
   * 使用场景：mount(seekId) 之后再调；途经传 `PURSUE_VIA`。事件内会互斥卸另一组与目视组。
   */
  mountPursue(maid: Entity, pursueEvent: string = "slot:seek_pursue"): void {
    try {
      maid.triggerEvent(pursueEvent);
    } catch (e) {
      Logger.warn(TAG, `mountPursue(${pursueEvent}) failed: ${String(e)}`);
    }
  },

  /**
   * 卸下追逐组件（默认 `slot:seek_pursue_quit`，同时卸终点+途经两组）。
   */
  quitPursue(maid: Entity, pursueQuitEvent: string = "slot:seek_pursue_quit"): void {
    try {
      maid.triggerEvent(pursueQuitEvent);
    } catch (e) {
      Logger.warn(TAG, `quitPursue(${pursueQuitEvent}) failed: ${String(e)}`);
    }
  },

  /**
   * 挂载脚本代理目视组（仅转头；事件内会卸追逐）。
   * 使用场景：mount(seekId) 之后、冲量驱动期间。
   */
  mountLook(maid: Entity): void {
    try {
      maid.triggerEvent(Seek.LOOK);
    } catch (e) {
      Logger.warn(TAG, `mountLook failed: ${String(e)}`);
    }
  },

  /**
   * 卸下脚本代理目视组。
   * 使用场景：代理 teardown；切回原版追逐前由 mountPursue 互斥卸也可。
   */
  quitLook(maid: Entity): void {
    try {
      maid.triggerEvent(`${Seek.LOOK}_quit`);
    } catch (e) {
      Logger.warn(TAG, `quitLook failed: ${String(e)}`);
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

  /**
   * 启动路点 TTL 倒计时（组件组 `ttl`）。
   * 使用场景：ensureMarker 刚 spawn；与 seek_marker.json 的 ttl_start 对齐。
   */
  startMarkerTtl(marker: Entity): void {
    try {
      if (marker.isValid) {
        marker.triggerEvent("ttl_start");
      }
    } catch (e) {
      Logger.warn(TAG, `startMarkerTtl failed: ${String(e)}`);
    }
  },

  /**
   * 重置路点 TTL（remove+add `ttl`）。
   * 使用场景：Executor 持有 marker 期间周期性续命，避免倒计时自毁。
   */
  renewMarkerTtl(marker: Entity): void {
    try {
      if (marker.isValid) {
        marker.triggerEvent("ttl_renew");
      }
    } catch (e) {
      Logger.warn(TAG, `renewMarkerTtl failed: ${String(e)}`);
    }
  },

  /**
   * 女仆加载时清理 Seek / 追逐 / 目视残留（退档时 teardown 未跑）。
   * 使用场景：MaidLifeCycleEvents.onLoad；调用方应跳过正在 Path.follow 的女仆。
   */
  recoverResidual(maid: Entity): void {
    try {
      Seek.quitPursue(maid);
      Seek.quitLook(maid);
      if (Seek.getIndex(maid) >= SEEK_SLOT.min) {
        Seek.resetTarget(maid);
        Seek.quit(maid);
      }
    } catch (e) {
      Logger.warn(TAG, `recoverResidual failed: ${String(e)}`);
    }
  },

  /**
   * 扫当前已加载维度，移除全部 seek_marker（脚本启动时 sessions 必空）。
   * 使用场景：MaidLifeCycleEvents.scanLoadedMaids；清理重启前残留路点。
   */
  purgeOrphanMarkers(): void {
    const dimensionIds = ["overworld", "nether", "the_end"];
    let removed = 0;
    for (const dimensionId of dimensionIds) {
      try {
        const dim = world.getDimension(dimensionId);
        for (const ent of dim.getEntities({ type: SEEK_MARKER_TYPE })) {
          try {
            if (ent.isValid) {
              // 即将 remove，不必再 release（setProperty 无后续读者）
              ent.remove();
              removed++;
            }
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* 维度未加载等 */
      }
    }
    if (removed > 0) {
      Logger.info(TAG, `purgeOrphanMarkers removed=${removed}`);
    }
  },
};
