/**
 * 脚本代理段抵达判定：触及距 + 视线锥。
 * 使用场景：MovementProxy / 后续 Executor 脚本段；对齐实验设计 §5.3、代理运动实现方案 §1.3。
 *
 * 阈值：水平触及与现 via `0.75` 对齐；目视半角为标定前临时门限（非失败用例特例）。
 */
import { Entity, Vector3 } from "@minecraft/server";

/** 水平触及距（格）；与 Executor ARRIVE_VIA_H 同量级 */
export const ARRIVE_REACH_H = 0.75;
/** 竖直容差（格） */
export const ARRIVE_REACH_V = 1.6;
/**
 * 目视锥半角（度）：目标方向与 getViewDirection 夹角 ≤ 此值。
 * 使用场景：标定前临时门限；正式值标定后只改此处。
 */
export const ARRIVE_LOOK_HALF_DEG = 40;

/**
 * 水平距离 + 竖直容差是否在触及范围内。
 * 使用场景：抵达判定距离腿。
 */
export function withinReachDistance(
  maidLoc: Vector3,
  target: Vector3,
  reachH: number = ARRIVE_REACH_H,
  reachV: number = ARRIVE_REACH_V
): boolean {
  const h = Math.hypot(maidLoc.x - target.x, maidLoc.z - target.z);
  if (h > reachH) {
    return false;
  }
  return Math.abs(maidLoc.y - target.y) <= reachV;
}

/**
 * 目标点是否落在女仆目视锥内（头位 → 目标 与 viewDirection 夹角）。
 * 使用场景：抵达判定视线腿；依赖 look_at_target 已挂载时更稳。
 */
export function withinLookCone(
  maid: Entity,
  target: Vector3,
  halfAngleDeg: number = ARRIVE_LOOK_HALF_DEG
): boolean {
  try {
    const head = maid.getHeadLocation();
    const view = maid.getViewDirection();
    const dx = target.x - head.x;
    const dy = target.y - head.y;
    const dz = target.z - head.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) {
      return true;
    }
    const dot = (view.x * dx + view.y * dy + view.z * dz) / len;
    const cosMin = Math.cos((halfAngleDeg * Math.PI) / 180);
    return dot >= cosMin;
  } catch {
    return false;
  }
}

/**
 * 脚本段抵达：触及距且视线锥（可选要求着地）。
 * 使用场景：代理探针 checkArrived；返回 true 表示可结束本段。
 */
export function checkScriptArrive(
  maid: Entity,
  target: Vector3,
  options?: {
    reachH?: number;
    reachV?: number;
    lookHalfDeg?: number;
    requireOnGround?: boolean;
  }
): boolean {
  const reachH = options?.reachH ?? ARRIVE_REACH_H;
  const reachV = options?.reachV ?? ARRIVE_REACH_V;
  const lookHalf = options?.lookHalfDeg ?? ARRIVE_LOOK_HALF_DEG;
  if (options?.requireOnGround) {
    try {
      if (!maid.isOnGround) {
        return false;
      }
    } catch {
      return false;
    }
  }
  if (!withinReachDistance(maid.location, target, reachH, reachV)) {
    return false;
  }
  return withinLookCone(maid, target, lookHalf);
}
