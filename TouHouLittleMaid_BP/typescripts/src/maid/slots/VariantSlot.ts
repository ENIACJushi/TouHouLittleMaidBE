/**
 * 模型 variant 槽位具名 API（引擎事件仍为历史 skin:<n> / skin:<n>_quit）。
 * 使用场景：facets/Skin.setIndex 委托于此，补上互斥卸载；不改 slot: 前缀以免双写 200 档。
 */
import { Entity, EntityVariantComponent } from "@minecraft/server";
import { VARIANT_SLOT } from "./registry";
import { clearIntSlot, isIntTokenInRange, setIntSlot, SKIN_LEGACY_EVENTS } from "./runtime";

/**
 * 从引擎 variant 组件读取当前模型编号
 */
function readVariantIndex(maid: Entity): number | undefined {
  const comp = maid.getComponent("minecraft:variant") as EntityVariantComponent | undefined;
  if (comp === undefined) {
    return undefined;
  }
  return comp.value;
}

/**
 * minecraft:variant 原子槽（事件名适配 skin:*）
 */
export const VariantSlot = {
  /** 槽位元数据（只读） */
  def: VARIANT_SLOT,

  /**
   * 获取当前模型编号（读引擎组件）
   */
  get(maid: Entity): number | undefined {
    return readVariantIndex(maid);
  },

  /**
   * 设置模型编号（0~200）；越界返回 false；会先 quit 旧 skin 组再 add
   */
  set(maid: Entity, index: number): boolean {
    return setIntSlot(maid, VARIANT_SLOT, index, {
      events: SKIN_LEGACY_EVENTS,
      readCurrent: readVariantIndex,
      trackDp: false,
    });
  },

  /**
   * 卸下当前 skin 组件组（若当前档合法）
   */
  clear(maid: Entity): void {
    clearIntSlot(maid, VARIANT_SLOT, {
      events: SKIN_LEGACY_EVENTS,
      readCurrent: readVariantIndex,
      trackDp: false,
    });
  },

  /**
   * 是否在合法区间内
   */
  isValid(index: number): boolean {
    return isIntTokenInRange(VARIANT_SLOT, index);
  },
};
