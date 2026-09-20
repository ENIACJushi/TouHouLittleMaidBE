/**
 * 槽位运行时：校验范围、维护当前档、先 quit 再 mount。
 * 使用场景：Slots.* 具名 API 的内部实现；不直接暴露给包外业务拼事件名。
 */
import { Entity } from "@minecraft/server";
import { DP } from "../../libs/DynamicPropertyInterface";
import { IntSlotDef } from "./registry";
import { slotDpKey, slotMountEvent, slotQuitEvent } from "./names";

/**
 * 判断 token 是否落在整型槽闭区间内
 */
export function isIntTokenInRange(def: IntSlotDef, token: number): boolean {
  return Number.isInteger(token) && token >= def.min && token <= def.max;
}

/**
 * 读取实体上某整型槽的当前档；未挂载过则返回 undefined
 */
export function getIntSlot(maid: Entity, def: IntSlotDef): number | undefined {
  return DP.getInt(maid, slotDpKey(def.id));
}

/**
 * 装载整型槽到指定档：同值 no-op；越界返回 false；成功返回 true
 */
export function setIntSlot(maid: Entity, def: IntSlotDef, token: number): boolean {
  if (!isIntTokenInRange(def, token)) {
    return false;
  }
  const old = getIntSlot(maid, def);
  if (old === token) {
    return true;
  }
  if (old !== undefined && isIntTokenInRange(def, old)) {
    maid.triggerEvent(slotQuitEvent(def.id, old));
  }
  maid.triggerEvent(slotMountEvent(def.id, token));
  DP.setInt(maid, slotDpKey(def.id), token);
  return true;
}

/**
 * 卸载整型槽当前档并清除 DP 记录；无当前档则 no-op
 */
export function clearIntSlot(maid: Entity, def: IntSlotDef): void {
  const old = getIntSlot(maid, def);
  if (old !== undefined && isIntTokenInRange(def, old)) {
    maid.triggerEvent(slotQuitEvent(def.id, old));
  }
  DP.setInt(maid, slotDpKey(def.id), undefined);
}
