/**
 * 槽位运行时：校验/步进向下取档、维护当前档、先 quit 再 mount。
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

/** 读取步进，缺省 1 */
export function slotStep(def: IntSlotDef): number {
  return def.step ?? 1;
}

/**
 * 判断 token 是否为该槽的合法支持档（落在区间且对齐 step）
 */
export function isIntTokenInRange(def: IntSlotDef, token: number): boolean {
  const step = slotStep(def);
  return (
    Number.isInteger(token)
    && token >= def.min
    && token <= def.max
    && (token - def.min) % step === 0
  );
}

/**
 * 将任意请求值解析为「≤ 请求值的最高支持档」。
 * 低于 min、非有限数 → undefined；高于 max 时对齐到 ≤ max 的最高支持档。
 */
export function resolveIntTokenFloor(def: IntSlotDef, value: number): number | undefined {
  if (!Number.isFinite(value) || value < def.min) {
    return undefined;
  }
  const step = slotStep(def);
  const capped = Math.min(Math.floor(value), def.max);
  const k = Math.floor((capped - def.min) / step);
  const token = def.min + k * step;
  if (!isIntTokenInRange(def, token)) {
    return undefined;
  }
  return token;
}

/**
 * 读取实体上某整型槽的当前档（仅 DP）；未记录则 undefined
 */
export function getIntSlot(maid: Entity, def: IntSlotDef): number | undefined {
  return DP.getInt(maid, slotDpKey(def.id));
}

/**
 * 装载整型槽：先按步进向下取档，再 quit 旧档 / mount 新档；无法解析则 false
 */
export function setIntSlot(
  maid: Entity,
  def: IntSlotDef,
  requested: number,
  options?: SetIntSlotOptions,
): boolean {
  const token = resolveIntTokenFloor(def, requested);
  if (token === undefined) {
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
