/**
 * 槽位运行时：校验范围、维护当前档、先 quit 再 mount。
 * 使用场景：Slots.* 具名 API；亦可传入自定义事件名以适配历史 skin:N 等。
 */
import { Entity } from "@minecraft/server";
import { DP } from "../../libs/DynamicPropertyInterface";
import { IntSlotDef } from "./registry";
import { slotDpKey, slotMountEvent, slotQuitEvent } from "./names";

/**
 * 装载/卸载事件名解析（默认 slot: 约定；历史皮肤等可覆写）
 */
export type SlotEventNames = {
  mount: (token: number) => string;
  quit: (token: number) => string;
};

/** setIntSlot 可选行为 */
export type SetIntSlotOptions = {
  /** 自定义事件名；默认 slot:<id>_<token> / _quit */
  events?: SlotEventNames;
  /**
   * 读取「引擎侧当前档」；提供时优先于 DP（如 variant 组件）。
   * 使用场景：Skin 等已有权威组件可读、DP 尚未写入的历史实体。
   */
  readCurrent?: (maid: Entity) => number | undefined;
  /** 是否用 DP 记录当前档，默认 true；Skin 可读 variant 时可关 */
  trackDp?: boolean;
};

/**
 * 默认事件名：slot:<id>_<token>
 */
export function defaultSlotEvents(id: string): SlotEventNames {
  return {
    mount: (token) => slotMountEvent(id, token),
    quit: (token) => slotQuitEvent(id, token),
  };
}

/**
 * 历史皮肤事件名：skin:<n> / skin:<n>_quit（不迁到 slot: 前缀）
 */
export const SKIN_LEGACY_EVENTS: SlotEventNames = {
  mount: (token) => `skin:${token}`,
  quit: (token) => `skin:${token}_quit`,
};

/**
 * 判断 token 是否落在整型槽闭区间内
 */
export function isIntTokenInRange(def: IntSlotDef, token: number): boolean {
  return Number.isInteger(token) && token >= def.min && token <= def.max;
}

/**
 * 读取实体上某整型槽的当前档（仅 DP）；未记录则 undefined
 */
export function getIntSlot(maid: Entity, def: IntSlotDef): number | undefined {
  return DP.getInt(maid, slotDpKey(def.id));
}

/**
 * 装载整型槽到指定档：同值 no-op；越界返回 false；成功返回 true
 */
export function setIntSlot(
  maid: Entity,
  def: IntSlotDef,
  token: number,
  options?: SetIntSlotOptions,
): boolean {
  if (!isIntTokenInRange(def, token)) {
    return false;
  }
  const trackDp = options?.trackDp !== false;
  const events = options?.events ?? defaultSlotEvents(def.id);
  const oldFromReader = options?.readCurrent?.(maid);
  const oldFromDp = trackDp ? getIntSlot(maid, def) : undefined;
  const old = oldFromReader ?? oldFromDp;

  if (old === token) {
    return true;
  }
  if (old !== undefined && isIntTokenInRange(def, old)) {
    maid.triggerEvent(events.quit(old));
  }
  maid.triggerEvent(events.mount(token));
  if (trackDp) {
    DP.setInt(maid, slotDpKey(def.id), token);
  }
  return true;
}

/**
 * 卸载整型槽当前档并清除 DP 记录；无当前档则 no-op
 */
export function clearIntSlot(
  maid: Entity,
  def: IntSlotDef,
  options?: SetIntSlotOptions,
): void {
  const trackDp = options?.trackDp !== false;
  const events = options?.events ?? defaultSlotEvents(def.id);
  const oldFromReader = options?.readCurrent?.(maid);
  const oldFromDp = trackDp ? getIntSlot(maid, def) : undefined;
  const old = oldFromReader ?? oldFromDp;
  if (old !== undefined && isIntTokenInRange(def, old)) {
    maid.triggerEvent(events.quit(old));
  }
  if (trackDp) {
    DP.setInt(maid, slotDpKey(def.id), undefined);
  }
}
