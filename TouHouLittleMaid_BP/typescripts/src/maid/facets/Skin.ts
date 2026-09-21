import { Entity, EntityVariantComponent } from "@minecraft/server";
import { MaidSkin } from "../skin/MaidSkin";
import { VariantSlot } from "../slots/VariantSlot";

/**
 * 实体皮肤读写（行为对齐 EntityMaid.Skin）
 * 皮肤包注册逻辑仍在 MaidSkin；模型编号经 VariantSlot 互斥挂载（历史事件 skin:*）
 */
export const Skin = {
  /**
   * 设置模型包编号
   */
  setPack(maid: Entity, skinpack: number): void {
    maid.setProperty("thlm:skin_pack", skinpack);
  },
  /**
   * 设置模型编号（从 0 开始）；委托槽位运行时先卸旧组再装新组
   */
  setIndex(maid: Entity, index: number): void {
    VariantSlot.set(maid, index);
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
