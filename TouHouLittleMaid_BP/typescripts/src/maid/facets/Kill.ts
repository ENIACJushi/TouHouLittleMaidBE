import { Entity } from "@minecraft/server";
import { DP } from "../../libs/DynamicPropertyInterface";

/**
 * 击杀数读写（行为对齐 EntityMaid.Kill）
 */
export const Kill = {
  /**
   * 获取杀敌数
   */
  get(maid: Entity): number {
    let result = DP.getInt(maid, "kill");
    if (result === undefined) return 0;
    return result;
  },
  /**
   * 设置杀敌数
   */
  set(maid: Entity, amount: number): void {
    DP.setInt(maid, "kill", amount);
  },
};
