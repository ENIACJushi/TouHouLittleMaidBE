import { Entity, system } from "@minecraft/server";
import { DP } from "../../libs/DynamicPropertyInterface";
import { Movement } from "./Movement";
import { Owner } from "./Owner";
import { Skin } from "./Skin";
import { Work } from "./Work";

/**
 * 初始化女仆动态属性（在刚生成时调用）
 */
export function initDynamicProperties(maid: Entity): void {
  // 可以丢失的量 仅用动态属性存储
  // if(maid.getDynamicProperty("temp_pick") === undefined) maid.setDynamicProperty("temp_pick", false);

  // 有持久化存储需求的变量 使用标签辅助存储
  if (DP.getVector(maid, "home") === undefined) DP.setVector(maid, "home", { x: 0, y: 0, z: 0 });
  if (DP.getInt(maid, "home_dim") === undefined) DP.setInt(maid, "home_dim", 0);
  if (DP.getInt(maid, "level") === undefined) DP.setInt(maid, "level", 1);
  if (DP.getInt(maid, "kill") === undefined) DP.setInt(maid, "kill", 0);
  if (DP.getBoolean(maid, "pick") === undefined) DP.setBoolean(maid, "pick", true);
}

/**
 * 初始化女仆实体为女仆
 * @param reborn 是否是重生的女仆
 */
export function initMaid(maid: Entity, reborn: boolean = false): void {
  if (maid.getDynamicProperty("spawn_set") !== undefined) return;

  // 添加女仆属性
  maid.triggerEvent(reborn ? "become_maid_reborn" : "become_maid");

  // 首次生成
  if (!reborn) {
    // 设置动态属性
    initDynamicProperties(maid);
    system.runTimeout(() => {
      if (Work.get(maid) < 0) return;
      // JSON 仅注册 movement 组件，按等级写入实际移速
      Movement.unlock(maid);
      // 选择随机皮肤
      if (!Owner.has(maid)) {
        Skin.setRandom(maid);
      }
    }, 1);
  }
  maid.setDynamicProperty("spawn_set", true);
}

/** 与 EntityMaid.init_maid 同名别名，便于 Task 6 转发 */
export const init_maid = initMaid;
