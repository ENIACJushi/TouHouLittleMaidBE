import { Entity, EntityMovementComponent } from "@minecraft/server";
import { Level } from "./Level";

/**
 * 移速锁定/恢复（行为对齐 EntityMaid.Movement）
 * 移速唯一来源：Level.properties.movement（实体 JSON 仅注册 minecraft:movement 组件）
 * todo 未来还会在这里实现实体移速的切换
 */
export const Movement = {
  /**
   * 坐下时锁死移速并清除当前速度，避免仍被 AI 推走
   */
  lock(maid: Entity): void {
    try {
      let movement = maid.getComponent("minecraft:movement") as EntityMovementComponent | undefined;
      if (movement !== undefined) {
        movement.setCurrentValue(0);
      }
      maid.clearVelocity();
    }
    catch { }
  },
  /**
   * 站起时按当前等级恢复移速
   */
  unlock(maid: Entity): void {
    try {
      let movement = maid.getComponent("minecraft:movement") as EntityMovementComponent | undefined;
      if (movement === undefined) return;

      let level = Level.get(maid);
      let speed = (typeof level === "number" && level >= 1)
        ? Level.properties[level - 1]?.movement
        : undefined;

      if (typeof speed === "number") {
        movement.setCurrentValue(speed);
      }
      else {
        // 等级未初始化时使用 lv1 默认移速
        movement.setCurrentValue(Level.properties[0].movement);
      }
    } catch { }
  },
};
