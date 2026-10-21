/**
 * 脚本冲量驱动核（Task7）。
 * 使用场景：MovementProxy 探针；Executor Gap 冲量段 / AI 失败回退。
 * 不含探针地形、采样日志与 tune 自适应。
 */
import { Entity, EntityMovementComponent, Vector3 } from "@minecraft/server";
import { Logger } from "../../controller/Logger";
import { Level } from "../facets/Level";
import { Movement } from "../facets/Movement";
import { Seek } from "../facets/Seek";
import { ARRIVE_REACH_H } from "./Arrive";
import {
  hxForHorizontalRange,
  resolveImpulseEx,
} from "./ImpulseTable";

const TAG = "Path.ScriptDrive";

/** PATHMOV@lv1 锁定巡航 getVelocity */
export const PATHMOV_CRUISE_VXZ = 0.135;
/** PATHMOV 标定用定义移速（Level.properties[0].movement） */
export const PATHMOV_DEF_MOVEMENT = 0.25;
/** 目标巡航 = 定义移速 × 本比值 */
export const CRUISE_PER_MOVEMENT = PATHMOV_CRUISE_VXZ / PATHMOV_DEF_MOVEMENT;

/**
 * 玩家站定起跳起飞 vy（path_pjump / 采集日志11）。
 * 使用场景：Jump1 竖直冲量默认；有现场采样时可覆盖。
 */
export const PLAYER_JUMP_HY = 0.42;

/** 近距开始按距离降速（对齐采集 hDist≈0.85） */
export const SCRIPT_DECEL_H = 0.85;

/** Jump1 水平 plannedDist / plannedDy（Gap 桶） */
export const JUMP1_PLANNED_DIST = 2;
export const JUMP1_PLANNED_DY = 1;
/** 起跳瞄准水平射程下限（格） */
export const JUMP1_MIN_TARGET_H = 1.35;
/** 巡航带：along ∈ [0.55, 1.45]×cruise 才允许起跳 */
export const JUMP1_ALONG_MIN_FACTOR = 0.55;
export const JUMP1_ALONG_MAX_FACTOR = 1.45;

/**
 * 水平 cardinal 单位方向。
 * 使用场景：tickWalkDrive / Jump1 沿跑道。
 */
export type CardinalDir = { dx: number; dz: number };

/**
 * 着地冲量控制器参数。
 * 使用场景：探针会话 / Executor 脚本回退。
 */
export type DriveParams = {
  /** 实体 minecraft:movement 定义移速 */
  defMovement: number;
  /** 着地目标水平巡航 getVelocity */
  targetCruise: number;
  /** 指令速 / 显示目标速（抵消地面摩擦） */
  frictionScale: number;
  /** 单 tick 加速限幅 */
  maxDvAccel: number;
  /** 单 tick 制动限幅 */
  maxDvBrake: number;
};

/**
 * Jump1 一次冲量结果（供日志）。
 * 使用场景：探针 CTRL,jump；Executor 诊断。
 */
export type Jump1ImpulseInfo = {
  hx: number;
  hy: number;
  hySrc: string;
  actualH: number;
  targetH: number;
  ix: number;
  iz: number;
  toFeet: Vector3;
};

/**
 * 由定义移速推导默认驱动参（未 tune 时的起点）。
 * 使用场景：run 无会话参；Executor 回退种子。
 */
export function defaultDriveParams(defMovement: number): DriveParams {
  const targetCruise = defMovement * CRUISE_PER_MOVEMENT;
  return {
    defMovement,
    targetCruise,
    // 日志3：无放大稳态≈0.093@0.135 目标 → 比值作初值；tune 可改写
    frictionScale: PATHMOV_CRUISE_VXZ / 0.093,
    maxDvAccel: Math.max(0.03, targetCruise * 0.33),
    maxDvBrake: Math.max(0.06, targetCruise * 0.6),
  };
}

/**
 * 读取女仆定义移速（优先 Level 表；其次 movement 当前值且 >0）。
 * 使用场景：拼 DriveParams；须在 disableAutonomous/lock 前调用。
 */
export function readDefMovement(maid: Entity): number {
  try {
    const lv = Level.get(maid);
    if (typeof lv === "number" && lv >= 1) {
      const m = Level.properties[lv - 1]?.movement;
      if (typeof m === "number" && m > 0) {
        return m;
      }
    }
  } catch {
    /* fallthrough */
  }
  try {
    const mov = maid.getComponent(
      "minecraft:movement"
    ) as EntityMovementComponent | undefined;
    const v = mov?.currentValue;
    if (typeof v === "number" && v > 0.01) {
      return v;
    }
  } catch {
    /* fallthrough */
  }
  return PATHMOV_DEF_MOVEMENT;
}

/**
 * 冲量前一次朝向（keepVelocity）；之后由 mountLook 控头。
 * 使用场景：脚本段起跑 / Gap 起跳前。
 */
export function faceOnce(maid: Entity, lookAt: Vector3): void {
  try {
    maid.teleport(maid.location, {
      facingLocation: lookAt,
      keepVelocity: true,
    });
  } catch (e) {
    Logger.warn(TAG, `faceOnce failed: ${String(e)}`);
  }
}

/**
 * 切入脚本代理：禁走 + 宽松 NAT（must_reach false）+ 卸追逐挂目视。
 * 使用场景：Gap 冲量前；AI 回退；探针冲量段（Seek 已 mount 后）。
 */
export function enterScriptProxy(
  maid: Entity,
  options?: {
    marker?: Entity;
    /** 与抵达判定对齐的脚位点；有则 teleport marker */
    lookAtFeet?: Vector3;
  }
): void {
  try {
    Movement.disableAutonomous(maid);
  } catch {
    /* ignore */
  }
  try {
    // 脚本段：无通路也能盯着 stamp 目标（§5.2 soft）
    Seek.mountSoft(maid);
    Seek.quitPursue(maid);
    Seek.mountLook(maid);
  } catch (e) {
    Logger.warn(TAG, `enterScriptProxy seek: ${String(e)}`);
  }
  const feet = options?.lookAtFeet;
  const marker = options?.marker;
  if (feet && marker?.isValid) {
    try {
      marker.teleport(feet);
    } catch {
      /* ignore */
    }
  }
}

/**
 * 恢复原版站立移速：脚本禁走中则 enableAutonomous，否则 unlock。
 * 使用场景：脚本段结束 / teardown / 飞行超时。
 */
export function restoreMaidMovement(maid: Entity): void {
  try {
    if (Movement.isScriptMoveActive(maid)) {
      Movement.enableAutonomous(maid);
    } else {
      Movement.unlock(maid);
    }
  } catch {
    /* ignore */
  }
}

/**
 * 着地：沿 cardinal 追巡航，近距降速，每 tick 抵侧向；空中调用方应先 return。
 * 使用场景：探针 drive；Executor ScriptFollow。
 * @returns 是否施加了冲量
 */
export function tickWalkDrive(
  maid: Entity,
  dir: CardinalDir,
  goalFeet: Vector3,
  params: DriveParams,
  options?: {
    arriveH?: number;
    decelH?: number;
  }
): boolean {
  const arriveH = options?.arriveH ?? ARRIVE_REACH_H;
  const decelH = options?.decelH ?? SCRIPT_DECEL_H;
  let vx = 0;
  let vz = 0;
  try {
    const v = maid.getVelocity();
    vx = v.x;
    vz = v.z;
  } catch {
    /* keep 0 */
  }
  const along = vx * dir.dx + vz * dir.dz;
  const latX = vx - along * dir.dx;
  const latZ = vz - along * dir.dz;
  const loc = maid.location;
  const hDist = Math.hypot(loc.x - goalFeet.x, loc.z - goalFeet.z);

  if (hDist <= arriveH) {
    if (Math.hypot(latX, latZ) > 1e-4) {
      try {
        maid.applyImpulse({ x: -latX, y: 0, z: -latZ });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  let displayTarget = params.targetCruise;
  if (hDist < decelH) {
    displayTarget =
      params.targetCruise *
      Math.max(0, (hDist - arriveH) / (decelH - arriveH));
  }
  const cmdTarget = displayTarget * params.frictionScale;
  let delta = cmdTarget - along;
  if (delta > params.maxDvAccel) {
    delta = params.maxDvAccel;
  } else if (delta < -params.maxDvBrake) {
    delta = -params.maxDvBrake;
  }
  const ix = dir.dx * delta - latX;
  const iz = dir.dz * delta - latZ;
  if (Math.hypot(ix, iz) < 1e-4) {
    return false;
  }
  try {
    maid.applyImpulse({ x: ix, y: 0, z: iz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Jump1 起跳窗：仍在低台、水平速在巡航带、沿跑道距台沿在窗内。
 * 使用场景：探针 shouldJump；Executor 回退爬升。
 */
export function inJump1Window(options: {
  maidY: number;
  goalSupportY: number;
  alongPos: number;
  edgeAlong: number;
  triggerBefore: number;
  alongVel: number;
  targetCruise: number;
}): boolean {
  if (options.maidY >= options.goalSupportY + 0.9) {
    return false;
  }
  const alongMin = options.targetCruise * JUMP1_ALONG_MIN_FACTOR;
  const alongMax = options.targetCruise * JUMP1_ALONG_MAX_FACTOR;
  if (options.alongVel < alongMin || options.alongVel > alongMax) {
    return false;
  }
  const edge = options.edgeAlong;
  return (
    options.alongPos >= edge - options.triggerBefore &&
    options.alongPos < edge + 0.15
  );
}

/**
 * 计算并施加 Jump1：hy=玩家起飞（可覆盖），hx=Gap 距反解。
 * 使用场景：探针 doGapStyleJump；Executor 脚本爬升。
 * @returns 冲量信息；失败返回 undefined
 */
export function applyJump1Impulse(
  maid: Entity,
  options: {
    toSupport: { x: number; y: number; z: number };
    fromSupport: { x: number; y: number; z: number };
    /** 覆盖默认 PLAYER_JUMP_HY */
    hy?: number;
    hySrc?: string;
    plannedDist?: number;
    plannedDy?: number;
    minTargetH?: number;
  }
): Jump1ImpulseInfo | undefined {
  const plannedDist = options.plannedDist ?? JUMP1_PLANNED_DIST;
  const plannedDy = options.plannedDy ?? JUMP1_PLANNED_DY;
  const dbg = resolveImpulseEx(
    maid.location,
    options.toSupport,
    plannedDist,
    plannedDy,
    options.fromSupport
  );
  if (!dbg) {
    return undefined;
  }
  const hy = options.hy ?? PLAYER_JUMP_HY;
  const hySrc = options.hySrc ?? "player_default";
  const minH = options.minTargetH ?? JUMP1_MIN_TARGET_H;
  const targetH = Math.max(dbg.actualH, minH);
  const hx = hxForHorizontalRange(targetH, hy);
  const ddx = dbg.toFeet.x - maid.location.x;
  const ddz = dbg.toFeet.z - maid.location.z;
  const len = Math.hypot(ddx, ddz);
  if (len < 1e-4) {
    return undefined;
  }
  const ix = (ddx / len) * hx;
  const iz = (ddz / len) * hx;
  try {
    maid.clearVelocity();
    maid.applyImpulse({ x: ix, y: hy, z: iz });
  } catch (e) {
    Logger.warn(TAG, `applyJump1Impulse failed: ${String(e)}`);
    return undefined;
  }
  return {
    hx,
    hy,
    hySrc,
    actualH: dbg.actualH,
    targetH,
    ix,
    iz,
    toFeet: dbg.toFeet,
  };
}
