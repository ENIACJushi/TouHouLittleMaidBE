import { Entity } from "@minecraft/server";
import { DP } from "../../libs/DynamicPropertyInterface";
import { Vector } from "../../libs/VectorMC";

/**
 * 雕塑状态：缩放与占位尺寸
 */
export const Statues = {
  /**
   * 设置缩放比例
   */
  setScale(maid: Entity, scale: number): void {
    maid.setProperty("thlm:scale", scale);
  },
  /**
   * 获取缩放比例
   */
  getScale(maid: Entity): number {
    return maid.getProperty("thlm:scale") as number;
  },
  /**
   * 设置占位方块尺寸
   */
  setSpace(maid: Entity, space: Vector | { x: number; y: number; z: number }): void {
    DP.setVector(maid, "space", space);
  },
  /**
   * 获取占位方块尺寸
   */
  getSpace(maid: Entity): Vector | { x: number; y: number; z: number } | undefined {
    return DP.getVector(maid, "space");
  },
};
