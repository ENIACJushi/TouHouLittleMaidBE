import { Entity, EntityVariantComponent } from "@minecraft/server";
import { MaidSkin } from "../skin/MaidSkin";

/**
 * 实体皮肤读写（行为对齐 EntityMaid.Skin）
 * 皮肤包注册逻辑仍在 MaidSkin，本 facet 仅委托
 */
export const Skin = {
  /**
   * 设置模型包编号
   */
  setPack(maid: Entity, skinpack: number): void {
    maid.setProperty("thlm:skin_pack", skinpack);
  },
  /**
   * 设置模型编号（从 0 开始）
   */
  setIndex(maid: Entity, index: number): void {
    maid.triggerEvent(`skin:${index}`);
  },
  /**
   * 获取模型包编号
   */
  getPack(maid: Entity): number {
    return maid.getProperty("thlm:skin_pack") as number;
  },
  /**
   * 获取模型编号
   */
  getIndex(maid: Entity): number {
    return (maid.getComponent("minecraft:variant") as EntityVariantComponent).value;
  },
  /**
   * 随机设置一个皮肤
   */
  setRandom(maid: Entity): void {
    let target = MaidSkin.getRandom();
    this.setPack(maid, target.pack);
    this.setIndex(maid, target.seq);
  },
};
