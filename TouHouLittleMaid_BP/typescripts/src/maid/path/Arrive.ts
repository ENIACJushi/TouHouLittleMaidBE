/**
 * 脚本代理段抵达判定：球形触及（头点）+ 视线锥。
 * 使用场景：Executor Gap / ScriptFollow；对齐实验设计 §5.3、代理运动实现方案 §1.3。
 *
 * 终点触及与 Seek pursue JSON 同源：世界距 = 碰撞半径 × reach_multiplier。
 * 途经：JSON `reach_multiplier=0`（贴紧）与脚本 `ARRIVE_VIA_R`（抖动容差）故意不同源。
 * 改终点触及：本文件 `SEEK_PURSUE_REACH_MULTIPLIER` ↔ Seek.js `slot:seek_pursue`
 * → `npm run build:maid`；`Seek.ts` 注释一并改。
 */
import { Entity, Vector3 } from "@minecraft/server";

/**
 * 女仆水平碰撞半径（格）= collision_box.width / 2。
 * 权威 JSON：`MaidGenerator/template.js` → `minecraft:collision_box.width`（现 0.6）。
 * 同步：改 width 时改本常量，并重算下方 ARRIVE_*_R（或改 Seek 的 reach_multiplier 保持世界距不变）。
 */
export const MAID_COLLISION_RADIUS = 0.3;

/**
 * 终点追逐 `reach_multiplier`（与 JSON 同值）。
 * 同步修改：`MaidGenerator/modules/Seek.js` → `slot:seek_pursue` → `reach_multiplier`。
 */
export const SEEK_PURSUE_REACH_MULTIPLIER = 10;

/**
 * 终点球形触及半径（格）= 碰撞半径 × SEEK_PURSUE_REACH_MULTIPLIER → 现 **3**。
 * 使用场景：ScriptFollow goal；Executor FollowAI 终点距离宽限；Gap 落地。
 * 同步：改世界距时优先改 `SEEK_PURSUE_REACH_MULTIPLIER`（并改 Seek.js），勿只改本导出。
 */
export const ARRIVE_GOAL_R =
  MAID_COLLISION_RADIUS * SEEK_PURSUE_REACH_MULTIPLIER;

/**
 * 途经 / 默认球形触及半径（格）→ 现 **0.75**（脚本抖动容差）。
 * 使用场景：ScriptFollow via、AI via nearSupport、默认 checkScriptArrive。
 * 与 JSON `slot:seek_pursue_via` 的 `reach_multiplier:0` **故意不同源**；勿强行对齐。
 */
export const ARRIVE_VIA_R = 0.75;

/**
 * 默认球形触及半径（= via）。
 * 使用场景：checkScriptArrive 未传 reachR；ScriptDrive 近距降速默认。
 */
export const ARRIVE_REACH_R = ARRIVE_VIA_R;

/**
 * 目视锥半角（度）：目标方向与 getViewDirection 夹角 ≤ 此值。
 * 使用场景：标定前临时门限；正式值标定后只改此处。
 * 注意：与 JSON `melee_attack.melee_fov`（默认 90）不是同一参数，勿混改。
 */
export const ARRIVE_LOOK_HALF_DEG = 40;

/**
 * 从头位点（或给定 from）到目标的直线距离是否 ≤ 触及半径。
 * 使用场景：抵达判定距离腿（球形）。
 */
export function withinReachDistance(
  from: Vector3,
  target: Vector3,
  reach: number = ARRIVE_REACH_R
): boolean {
  const d = Math.hypot(from.x - target.x, from.y - target.y, from.z - target.z);
  return d <= reach;
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
 * 脚本段抵达：头点球形触及且视线锥（可选要求着地）。
 * 使用场景：Gap 落地 / ScriptFollow；返回 true 表示可结束本段。
 */
export function checkScriptArrive(
  maid: Entity,
  target: Vector3,
  options?: {
    /** 球形触及半径；缺省 ARRIVE_REACH_R（via）；goal / Gap 传 ARRIVE_GOAL_R */
    reachR?: number;
    lookHalfDeg?: number;
    requireOnGround?: boolean;
  }
): boolean {
  const reach = options?.reachR ?? ARRIVE_REACH_R;
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
  let head: Vector3;
  try {
    head = maid.getHeadLocation();
  } catch {
    return false;
  }
  if (!withinReachDistance(head, target, reach)) {
    return false;
  }
  return withinLookCone(maid, target, lookHalf);
}
