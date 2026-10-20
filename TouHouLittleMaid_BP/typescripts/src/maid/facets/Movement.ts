import { Entity, EntityMovementComponent } from "@minecraft/server";
import { DP } from "../../libs/DynamicPropertyInterface";
import { Level } from "./Level";

/**
 * 动态属性：脚本代理禁走是否生效。
 * 使用场景：中途退档时组件组可能残留；女仆再次 onLoad 时按此旗恢复。
 */
const DP_SCRIPT_MOVE = "script_move";

/**
 * 移速锁定/恢复（行为对齐 EntityMaid.Movement）
 * 移速唯一来源：Level.properties.movement（实体 JSON 仅注册 minecraft:movement 组件）
 * todo 未来还会在这里实现实体移速的切换
 */
export const Movement = {
  /**
   * 坐下时锁死移速并清除当前速度，避免仍被 AI 推走。
   * 注：movement=0 不会吃掉 applyImpulse 水平分量；冲量代理可安全与 lock 并用。
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

  /**
   * 是否处于脚本代理禁走（含退档残留旗）。
   * 使用场景：onLoad 残留清理判定。
   */
  isScriptMoveActive(maid: Entity): boolean {
    try {
      return DP.getBoolean(maid, DP_SCRIPT_MOVE) === true;
    } catch {
      return false;
    }
  },

  /**
   * 禁用原版自主移动（对齐坐下）：切脚本移动组 + lock，并打残留旗。
   * - 实体组 `api:script_move_on`：`can_walk:false`、闲逛/骑乘寻路倍率归零
   * - `lock`：movement 钳 0 并清当前速度（冲量仍可施加）
   * 使用场景：脚本冲量代理（MovementProxy / Path 代理段）。
   */
  disableAutonomous(maid: Entity): void {
    try {
      DP.setBoolean(maid, DP_SCRIPT_MOVE, true);
    } catch { }
    try {
      maid.triggerEvent("api:script_move_on");
    } catch { }
    this.lock(maid);
  },

  /**
   * 恢复原版站立寻路与等级移速，并清除残留旗。
   * 使用场景：代理正常结束 / teardown / onLoad 残留恢复。
   */
  enableAutonomous(maid: Entity): void {
    try {
      maid.triggerEvent("api:script_move_off");
    } catch { }
    this.unlock(maid);
    try {
      DP.setBoolean(maid, DP_SCRIPT_MOVE, false);
    } catch { }
  },

  /**
   * 女仆加载时清理代理禁走残留（退档时 teardown 未跑）。
   * 使用场景：MaidLifeCycleEvents.onLoad；仅当 DP 旗为 true 时恢复，避免误伤坐下态。
   */
  recoverScriptMoveResidual(maid: Entity): void {
    if (!this.isScriptMoveActive(maid)) {
      return;
    }
    this.enableAutonomous(maid);
  },
};
