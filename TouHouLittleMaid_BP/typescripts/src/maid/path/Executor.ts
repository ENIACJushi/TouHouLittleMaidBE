/**
 * 路径执行器状态机（Task7 Phase2）。
 * 使用场景：Path.follow；Walk/Jump1/Fall 用 Seek+marker；SprintGap 用冲量。
 *
 * 路点策略：
 * - 同一方向的连续 Walk 抽稀（步长 VIA_STEP），换向的拐角、Jump1/Fall/段尾保留；
 * - **单 marker 实体**：会话内 spawn 一次，换路点只 teleport（Seek 一次锁定，不反复 reset）；
 * - 途经平视 + pursue_via；via→via 抵达后 quit+重挂 via melee 刷新追逐；
 * - 终点 marker 在支撑格上方若干格的中心（耕地 1 格即作物；甘蔗 2 格即要砍的那节）；
 * - Gap Prep：Seek 追逐走上跳沿；Impulse 起切脚本代理段（见下）；
 * - Gap 冲量段（`ScriptDrive`）：`enterScriptProxy`；一次 `faceOnce`；落地 `checkScriptArrive`；
 * - Gap 腾空：用当前速度积分落点（按起跳 FIT 缩放），曼哈顿误差大于阈值则每 tick xz 冲量修正，落地停修；
 * - AI 途经：脚本距离 nearSupport（ARRIVE_VIA_R）即 advance（避免贴脸互推）。
 * - AI 终点：近战命中本会话 seek_marker 即 Done；近窗宽限后仍未打中 → ScriptFollow（目视+球形触及，不用纯距离完成）。
 * - AI→脚本回退：无正确目标 / 无进展 / 终点无近战 / 整段超时 → `ScriptFollow`（近抵达窗内同样可切）；
 *   FollowAI 挂严格 NAT（`must_reach:true`），脚本代理挂宽松 NAT（`must_reach:false`）。
 *
 * Fail：quit + release + free + UnreachableCache（cancel 不写 ban）。
 * 外力终止：坐下 / 抱起 / 睡觉 → Path.cancel（Pose 边沿 + tickAll 兜底；start 拒绝）。
 * 路点 TTL：spawn 后 startMarkerTtl；tickAll 周期性 renew；无效则按当前步重 spawn。
 */
import {
  Entity,
  EntityHitEntityAfterEvent,
  system,
  Vector3,
  world,
} from "@minecraft/server";
import { config } from "../../controller/Config";
import { Logger } from "../../controller/Logger";
import { Pose, setCancelFollowHook } from "../facets/Pose";
import { Seek, SEEK_MARKER_TYPE } from "../facets/Seek";
import {
  ARRIVE_GOAL_R,
  ARRIVE_VIA_R,
  checkScriptArrive,
} from "./Arrive";
import {
  resolveImpulseEx,
  feetOfSupport,
  predictHorizontalRange,
  horizontalRangePerHx,
} from "./ImpulseTable";
import {
  applyJump1Impulse,
  CardinalDir,
  defaultDriveParams,
  DriveParams,
  enterScriptProxy,
  faceOnce,
  JUMP1_ALONG_MAX_FACTOR,
  JUMP1_ALONG_MIN_FACTOR,
  PLAYER_JUMP_HY,
  readDefMovement,
  restoreMaidMovement,
  tickWalkDrive,
} from "./ScriptDrive";
import {
  PathEdge,
  PathFollowCompleteInfo,
  PathFollowCompleteReason,
  StandNode,
} from "./types";
import { unreachableCache } from "./UnreachableCache";

/**
 * Executor.start 可选参数。
 * 使用场景：Path.follow 把 onComplete 透传进来。
 */
export type ExecutorStartOptions = {
  /**
   * follow 结束回调；session 拆除后下一 tick 调用。
   * 使用场景：Farm 到位 acquire；勿在回调内同步再进同一 maid 的 tick 路径。
   */
  onComplete?: (info: PathFollowCompleteInfo) => void;
  /**
   * 终点实体在落脚点上方第几格。默认 1，和耕地的作物格一致。
   * 使用场景：甘蔗要砍的是土上方第二格，传 2。
   */
  goalBlocksAbove?: number;
};

const TAG = "Path.Executor";
/** Gap 落点诊断前缀（纯 console，便于 content 抓取） */
const GAP_LOG = "PATHGAP";

/** 途经路点调试粒子（红色） */
const PARTICLE_VIA = "touhou_little_maid:path_waypoint_via";
/** 终点路点调试粒子（绿色） */
const PARTICLE_GOAL = "touhou_little_maid:path_waypoint_goal";
/**
 * follow 轨迹粒子（蓝色，留存约 10s）。
 * 使用场景：path_go / Path.follow 每 tick 在女仆脚位采样。
 */
const PARTICLE_TRAIL = "touhou_little_maid:path_trail";

/** 同时处于 InFlight（冲量飞行）的女仆上限 */
export const IN_FLIGHT_MAX = 4;

/**
 * 连续 Walk 抽稀步长：每隔这么多格留一个途经点（段尾必留）。
 * 使用场景：省略原版可走完的中间格，且不超过 follow_range 安全余量。
 */
const VIA_STEP = 16;

/**
 * 进入终点水平距离后，若一直未近战命中，再等多久（游戏 tick）改切 ScriptFollow。
 * 使用场景：给近战留时间；不再用「纯距离」判抵达（无目视不自然）。60 tick ≈ 原 3s@20TPS。
 */
const GOAL_MELEE_GRACE_TICKS = 60;
/**
 * AI nearSupport 竖直容差（格）；与球形触及无关。
 * 使用场景：FollowAI via/goal 水平圈配套。
 */
const ARRIVE_V = 1.6;
/**
 * 途经 marker 相对脚位的眼高偏移（女仆 collision height≈1.5）。
 * 使用场景：中间路点平视，避免低头盯脚边。
 */
const EYE_OFFSET_FROM_FEET = 1.2;
/**
 * Gap marker 水平偏置用碰撞半径（与 Arrive.MAID_COLLISION_RADIUS 同值）。
 * 同步：改 collision width 时改 Arrive.MAID_COLLISION_RADIUS 与 template.js，并改此处。
 */
const MAID_COLLISION_RADIUS = 0.3;
/**
 * Gap marker 相对对岸脚位再抬高的高度（格）。
 * 使用场景：配合水平偏置，躲开落点实体体积。
 */
const GAP_MARKER_UP = 1.5;

/**
 * 单 AI 路点硬超时（游戏 tick，最后兜底 → ScriptFollow）。
 * 使用场景：tickFollowAI；240 tick ≈ 原 12s@20TPS。
 */
const AI_EDGE_TIMEOUT_TICKS = 240;
/**
 * 本 AI 步从未拿到正确 marker 目标：连续空满这么多游戏 tick → 切脚本。
 * 使用场景：起索敌 / 选不中；略长于 NAT scan_interval(10)。
 */
const AI_NO_TARGET_FIRST_HOLD_TICKS = 15;
/**
 * 本 AI 步曾有正确目标后又丢：连续空满这么多游戏 tick → 切脚本。
 * 使用场景：中途丢 target；0 = 观测到空窗当拍即切（仍受近抵达窗保护）。
 */
const AI_NO_TARGET_LOST_HOLD_TICKS = 0;
/**
 * 水平距无实质靠近连续超过此时长（游戏 tick）→ 切脚本（卡死但仍可能有 target）。
 * 使用场景：人为堵路 / 原版绕不过；不必等满 AI_EDGE_TIMEOUT。50 tick ≈ 原 2.5s@20TPS。
 */
const AI_STALL_HOLD_TICKS = 50;
/** 判定「有进展」：相对窗口起点水平距至少缩短这么多（格） */
const AI_STALL_IMPROVE_H = 0.25;
/**
 * Gap 腾空硬超时（游戏 tick）。
 * 使用场景：tickInFlight；30 tick ≈ 原 1.5s@20TPS。
 */
const FLIGHT_TIMEOUT_TICKS = 30;
/**
 * Gap Prep 硬超时（游戏 tick）。
 * 使用场景：tickPrepGap；60 tick ≈ 原 3s@20TPS。
 */
const PREP_TIMEOUT_TICKS = 60;
/**
 * 腾空预计落点与目标的曼哈顿距离阈值（格）；超过则本 tick 做 xz 修正。
 * 使用场景：tickInFlight / tryAirCorrect。
 */
const AIR_CORRECT_MANHATTAN = 0.1;
/**
 * 把当前速度积成落点时用的生物腾空一步。
 * 使用场景：tryAirCorrect。总射程会再缩放到起跳 FIT，这里只提供弧线形状。
 */
const AIR_GRAVITY = 0.08;
const AIR_DRAG_Y = 0.98;
const AIR_DRAG_H = 0.91;
/** 飞行阶段 1.5 秒，积分不超过两秒。 */
const AIR_SIM_TICKS = 40;

type Phase =
  | "Idle"
  | "FollowAI"
  | "ScriptFollow"
  | "PrepGap"
  | "Impulse"
  | "InFlight"
  | "Done"
  | "Fail";

/**
 * AI 超时后的脚本回退状态。
 * 使用场景：phase=ScriptFollow；冲量走完当前 AI 路点。
 */
type ScriptFollowState = {
  params: DriveParams;
  dir: CardinalDir;
  /**
   * 本路点统一目标点（via 眼高 / goal 作物体心），与 FollowAI marker stamp 相同。
   * 使用场景：冲量巡航、锥形抵达、朝向；水平距取 xz。
   */
  goalFeet: Vector3;
  /** 目标支撑顶面 y（Jump1 窗） */
  goalSupportY: number;
  jumped: boolean;
  jumpedAtTick: number | undefined;
  jumpAttempts: number;
  tickCount: number;
};

/**
 * 路点角色：途经平视 / 终点对准。
 * 使用场景：FollowStep.ai；决定 marker 高度与追逐组。
 */
type WaypointRole = "via" | "goal";

/**
 * 执行层步骤（由 A* 边抽稀得到，不改规划边模型）。
 * 使用场景：Session.steps；AI 段 stamp，Gap 段冲量。
 */
type FollowStep =
  | {
      kind: "ai";
      /** 路点对应支撑格 */
      support: StandNode;
      role: WaypointRole;
    }
  | {
      kind: "gap";
      edge: PathEdge;
    };

/**
 * Gap 腾空修正状态：起飞快照。落点按当前速度积分，hx/hy 只用来把积分缩放到起跳 FIT。
 * 使用场景：InFlight 每 tick 预计落点并 xz 修正。
 */
type GapAirState = {
  /** 起跳时脚位 */
  from: Vector3;
  /** 目标对岸脚位（格心） */
  toFeet: Vector3;
  /** 起跳水平冲量。读不到速度时仍作「总射程 − 已飞距离」的退路 */
  hx: number;
  /** 起跳竖直冲量（修正不改 hy） */
  hy: number;
  /** 起跳水平方向（单位向量）。读不到速度时沿这个方向估剩余射程 */
  dirX: number;
  dirZ: number;
};

/**
 * 单女仆跟随会话。
 * 使用场景：sessions map；tick 驱动。
 */
type Session = {
  maidId: string;
  /** 启动时实体引用；每 tick 查 isValid */
  maid: Entity;
  /**
   * 启动时所在维度 id；Fail 写 ban 用。
   * 使用场景：teardown 时实体可能已失效，不能再读 maid.dimension。
   */
  dimId: string;
  steps: FollowStep[];
  index: number;
  seekId: number;
  marker: Entity | undefined;
  /** 当前追逐角色；仅 via→goal（或反之）时切换组件组 */
  pursueRole: WaypointRole | undefined;
  phase: Phase;
  /**
   * 当前 phase 起始的 system.currentTick（超时判定用，非墙钟）。
   * 使用场景：FollowAI / ScriptFollow / PrepGap / InFlight 硬超时。
   */
  phaseAtTick: number;
  dest: StandNode;
  failReason?: string;
  /** Gap 腾空中才有；落地 / 失败清除 */
  gapAir?: GapAirState;
  /**
   * 结束回调（可选）；teardown 后延后调用。
   * 使用场景：Farm / 测试订阅到位，而非轮询 isFollowing。
   */
  onComplete?: (info: PathFollowCompleteInfo) => void;
  /**
   * 终点实体在落脚点上方第几格。缺省按 1。
   * 使用场景：甘蔗为 2，实体落在要砍的那节里。
   */
  goalBlocksAbove: number;
  /**
   * 第一次进入终点水平距离的 system.currentTick。离开范围就清掉。
   * 使用场景：终点 FollowAI；满 GOAL_MELEE_GRACE_TICKS 仍未命中 → ScriptFollow（不用距离完成）。
   */
  goalRangeSinceTick?: number;
  /**
   * AI 超时切入的脚本回退；离开 ScriptFollow 时清空。
   * 使用场景：tickScriptFollow。
   */
  scriptFollow?: ScriptFollowState;
  /**
   * 无正确 marker 目标空窗起始的 system.currentTick；有目标则清空。
   * 使用场景：tickFollowAI `ai_no_target`。
   */
  aiNoTargetSinceTick?: number;
  /**
   * 本 AI 步是否曾挂上正确 marker 目标（决定空窗用首次 FIRST 还是丢目标 LOST 阈值）。
   * 使用场景：tickFollowAI `ai_no_target`；beginStep / 切入 ScriptFollow 时清空。
   */
  aiHadSeekTarget?: boolean;
  /**
   * 无进展窗口：起点水平距与起始 `system.currentTick`。
   * 使用场景：tickFollowAI `ai_stall`。
   */
  aiStallRefH?: number;
  aiStallSinceTick?: number;
  /**
   * 本会话 entityHitEntity 回调（subscribe 时用 entities:[maid] 限定攻击方；已验证有效）。
   * 使用场景：AI 路点抵达；teardown 时 unsubscribe。
   */
  hitHandler?: (ev: EntityHitEntityAfterEvent) => void;
  /**
   * 上次对 marker 执行 ttl_renew 的 system.currentTick。
   * 使用场景：keepaliveMarker；与 seek_marker 12s TTL 配合续命。
   */
  markerRenewAtTick?: number;
};

/**
 * marker TTL 续命间隔（游戏 tick）。
 * 使用场景：keepaliveMarker；160 tick ≈ 8s，相对实体 12s 倒计时仍有裕度。
 */
const MARKER_TTL_RENEW_TICKS = 160;

/**
 * 脚本回退单路点超时（游戏 tick）。
 * 使用场景：tickScriptFollow；200 tick ≈ 原 10s@20TPS。
 */
const SCRIPT_FOLLOW_TIMEOUT_TICKS = 200;
/** 脚本回退最多 Jump1 次数 */
const SCRIPT_JUMP_MAX = 2;
const SCRIPT_JUMP_RETRY_TICKS = 12;
/**
 * 脚本回退爬升：距目标脚位水平距落在此闭区间才允许 Jump1（格）。
 * 使用场景：太远尚在平走过近则已可贴上台；非失败用例拟合。
 */
const SCRIPT_JUMP_HDIST_MIN = 0.9;
const SCRIPT_JUMP_HDIST_MAX = 2.2;

const sessions = new Map<string, Session>();
let tickHandle: number | undefined;
let inFlightCount = 0;

function f3(n: number): string {
  return n.toFixed(3);
}

/** Gap 诊断：只走 console.log */
function logGap(line: string): void {
  console.log(`${GAP_LOG}|${line}`);
}

/**
 * 脚位（支撑顶面中心）：Gap 起跳/落地与距离判定用。
 */
function feetOf(support: StandNode): Vector3 {
  return {
    x: support.x + 0.5,
    y: support.y + 1,
    z: support.z + 0.5,
  };
}

/**
 * 终点 marker 在支撑格上方第 blocksAbove 格的体心。
 * 耕地是 1（作物格）。甘蔗要砍的是再高一格，所以是 2。
 * 使用场景：goal 路点 stamp；脚位贴耕地顶面时引擎易丢锁。
 */
function goalMarkerOf(support: StandNode, blocksAbove: number): Vector3 {
  return {
    x: support.x + 0.5,
    y: support.y + blocksAbove + 0.5,
    z: support.z + 0.5,
  };
}

/**
 * 眼高位：途经路点 stamp，让头部趋向平视。
 */
function eyeOf(support: StandNode): Vector3 {
  const feet = feetOf(support);
  return { x: feet.x, y: feet.y + EYE_OFFSET_FROM_FEET, z: feet.z };
}

/**
 * AI 路点统一 stamp / 朝向 / 脚本抵达点（与 FollowAI、粒子、ScriptFollow 一致）。
 * via → 眼高；goal → 支撑上方第 goalBlocksAbove 格体心。
 * 使用场景：beginStep、enterScriptFollow、路点粒子。
 */
function aiStampPos(
  support: StandNode,
  role: WaypointRole,
  goalBlocksAbove: number
): Vector3 {
  return role === "goal"
    ? goalMarkerOf(support, goalBlocksAbove)
    : eyeOf(support);
}

/**
 * Gap 对岸 Seek marker 位置：对岸脚位沿跳向偏出女仆碰撞半径，再抬高。
 * 使用场景：beginStep Gap；避免 marker 落在落地躯干内导致冲量欠冲。
 */
function gapMarkerPos(edge: PathEdge): Vector3 {
  const from = feetOf(edge.from);
  const to = feetOf(edge.to);
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.sqrt(dx * dx + dz * dz) || 1;
  return {
    x: to.x + (dx / len) * MAID_COLLISION_RADIUS,
    y: to.y + GAP_MARKER_UP,
    z: to.z + (dz / len) * MAID_COLLISION_RADIUS,
  };
}

function horizDist(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * 按当前速度积分，直到脚位落回目标高度。
 * 使用场景：tryAirCorrect 估计落点；速度已被顶掉时落点就在当前位置附近。
 */
function simulateLanding(
  loc: Vector3,
  vel: Vector3,
  targetY: number
): { x: number; z: number } {
  let x = loc.x;
  let y = loc.y;
  let z = loc.z;
  let vx = vel.x;
  let vy = vel.y;
  let vz = vel.z;
  if (y <= targetY && vy <= 0) {
    return { x, z };
  }
  for (let i = 0; i < AIR_SIM_TICKS; i++) {
    const px = x;
    const py = y;
    const pz = z;
    x += vx;
    y += vy;
    z += vz;
    vy = (vy - AIR_GRAVITY) * AIR_DRAG_Y;
    vx *= AIR_DRAG_H;
    vz *= AIR_DRAG_H;
    if (py >= targetY && y <= targetY) {
      const span = py - y;
      const t = span > 1e-6 ? (py - targetY) / span : 1;
      return { x: px + (x - px) * t, z: pz + (z - pz) * t };
    }
  }
  return { x, z };
}

/**
 * 起跳冲量的积分射程相对 FIT 的比例。
 * 使用场景：把「当前速度积分」缩放到和起跳拟合同一把尺，正常跨沟不会一离地就修正。
 */
function launchFitScale(hx: number, hy: number): number {
  const sim = simulateLanding(
    { x: 0, y: 0, z: 0 },
    { x: hx, y: hy, z: 0 },
    0
  );
  const simH = Math.hypot(sim.x, sim.z);
  if (simH < 1e-4) {
    return 1;
  }
  return predictHorizontalRange(hx, hy) / simH;
}

/**
 * 腾空中按当前速度预计落点，曼哈顿误差过大则 xz 冲量修正。
 * 使用场景：tickInFlight（未落地时每 tick）；无单次/全程 Δhx 上限。
 * 读不到速度时仍用「起跳 FIT 总射程 − 已飞距离」。
 */
function tryAirCorrect(session: Session): void {
  const air = session.gapAir;
  if (!air) {
    return;
  }
  const maid = session.maid;
  const loc = maid.location;
  const { from, toFeet } = air;
  const alreadyH = Math.hypot(loc.x - from.x, loc.z - from.z);
  let predLandX: number;
  let predLandZ: number;
  let velX = 0;
  let velY = 0;
  let velZ = 0;
  let usedVelocity = false;
  try {
    const vel = maid.getVelocity();
    velX = vel.x;
    velY = vel.y;
    velZ = vel.z;
    const scale = launchFitScale(air.hx, air.hy);
    const raw = simulateLanding(loc, vel, toFeet.y);
    predLandX = loc.x + (raw.x - loc.x) * scale;
    predLandZ = loc.z + (raw.z - loc.z) * scale;
    usedVelocity = true;
  } catch {
    const predH = predictHorizontalRange(air.hx, air.hy);
    const remainPred = predH - alreadyH;
    predLandX = loc.x + air.dirX * remainPred;
    predLandZ = loc.z + air.dirZ * remainPred;
  }
  const remainPred = Math.hypot(predLandX - loc.x, predLandZ - loc.z);
  const manh =
    Math.abs(predLandX - toFeet.x) + Math.abs(predLandZ - toFeet.z);
  if (manh <= AIR_CORRECT_MANHATTAN) {
    return;
  }

  const wantX = toFeet.x - loc.x;
  const wantZ = toFeet.z - loc.z;
  const predRemainX = predLandX - loc.x;
  const predRemainZ = predLandZ - loc.z;
  const errX = wantX - predRemainX;
  const errZ = wantZ - predRemainZ;
  const errH = Math.hypot(errX, errZ);
  if (errH < 1e-6) {
    return;
  }
  const den = horizontalRangePerHx(air.hy);
  if (Math.abs(den) < 1e-6) {
    return;
  }
  // 误差水平距 / ∂H∂hx → Δhx；方向沿「目标剩余 − 预计剩余」
  const dHx = errH / den;
  const ix = (errX / errH) * dHx;
  const iz = (errZ / errH) * dHx;
  try {
    maid.applyImpulse({ x: ix, y: 0, z: iz });
  } catch (e) {
    Logger.warn(TAG, `tryAirCorrect impulse failed: ${String(e)}`);
    return;
  }

  logGap(
    [
      "AIR_CORRECT",
      `i=${session.index}`,
      `manh=${f3(manh)}`,
      `pred=${f3(predLandX)},${f3(predLandZ)}`,
      `toFeet=${f3(toFeet.x)},${f3(toFeet.z)}`,
      `alreadyH=${f3(alreadyH)}`,
      `remainPred=${f3(remainPred)}`,
      `vel=${usedVelocity ? `${f3(velX)},${f3(velY)},${f3(velZ)}` : "-"}`,
      `dHx=${f3(dHx)}`,
      `v=${f3(ix)},0,${f3(iz)}`,
    ].join(",")
  );
}

/**
 * 清掉水平速度，保留竖直分量。
 * 使用场景：Gap 落地刹停，防惯性滑出对岸垫。
 */
function clearHorizontalVelocity(maid: Entity): void {
  try {
    const v = maid.getVelocity();
    if (Math.abs(v.x) < 1e-6 && Math.abs(v.z) < 1e-6) {
      return;
    }
    maid.applyImpulse({ x: -v.x, y: 0, z: -v.z });
  } catch (e) {
    try {
      maid.clearVelocity();
    } catch {
      Logger.warn(TAG, `clearHorizontalVelocity failed: ${String(e)}`);
    }
  }
}

/**
 * 是否靠近支撑格脚位。
 * 使用场景：AI via 抵达；Gap 起跳/落地。
 * @param horizMax 水平容差
 */
function nearSupport(
  maid: Entity,
  support: StandNode,
  horizMax: number
): boolean {
  const target = feetOf(support);
  const loc = maid.location;
  if (horizDist(loc, target) > horizMax) {
    return false;
  }
  return Math.abs(loc.y - target.y) <= ARRIVE_V;
}

function pursueEventFor(role: WaypointRole): string {
  return role === "goal" ? Seek.PURSUE_DEFAULT : Seek.PURSUE_VIA;
}

/**
 * 平走的水平方向。斜向和正向分开记，拐角不能抽掉。
 * 使用场景：只合并同一方向的连续平走。
 */
function walkDir(edge: PathEdge): string {
  return `${edge.to.x - edge.from.x},${edge.to.z - edge.from.z}`;
}

/**
 * 同一方向的连续 Walk 边中保留哪些 `to` 下标（0-based）；段尾必留。
 * 使用场景：buildFollowSteps 抽稀。换方向必须留下拐角。
 */
function sparsifyWalkIndices(walkCount: number): number[] {
  if (walkCount <= 0) {
    return [];
  }
  const keep = new Set<number>();
  for (let k = VIA_STEP - 1; k < walkCount - 1; k += VIA_STEP) {
    keep.add(k);
  }
  keep.add(walkCount - 1);
  return [...keep].sort((a, b) => a - b);
}

/**
 * 将 A* 边转为执行步骤：Walk 抽稀；Jump1/Fall 全留；SprintGap 独立。
 * 仅整条路径最后一个 AI 路点为 goal，其余 AI 为 via。
 */
function buildFollowSteps(edges: PathEdge[]): FollowStep[] {
  const steps: FollowStep[] = [];
  let i = 0;
  while (i < edges.length) {
    const edge = edges[i];
    if (edge.kind === "SprintGap") {
      steps.push({ kind: "gap", edge });
      i++;
      continue;
    }
    if (edge.kind === "Walk") {
      let j = i;
      const dir = walkDir(edge);
      while (
        j < edges.length &&
        edges[j].kind === "Walk" &&
        walkDir(edges[j]) === dir
      ) {
        j++;
      }
      const walkEdges = edges.slice(i, j);
      for (const ki of sparsifyWalkIndices(walkEdges.length)) {
        const globalEdgeIndex = i + ki;
        const role: WaypointRole =
          globalEdgeIndex === edges.length - 1 ? "goal" : "via";
        steps.push({
          kind: "ai",
          support: walkEdges[ki].to,
          role,
        });
      }
      i = j;
      continue;
    }
    // Jump1 / Fall：不抽稀
    const role: WaypointRole = i === edges.length - 1 ? "goal" : "via";
    steps.push({ kind: "ai", support: edge.to, role });
    i++;
  }
  return steps;
}

function ensureTicker(): void {
  if (tickHandle !== undefined) {
    return;
  }
  tickHandle = system.runInterval(() => {
    tickAll();
  }, 2);
}

/**
 * 无会话时卸 ticker。
 */
function stopTickerIfIdle(): void {
  if (sessions.size > 0) {
    return;
  }
  if (tickHandle !== undefined) {
    system.clearRun(tickHandle);
    tickHandle = undefined;
  }
}

/**
 * 为会话注册近战命中：仅该女仆作为 damagingEntity 时回调。
 * 使用场景：start；options.entities 避免全图 entityHitEntity。
 * 已验证：entityHitEntity 的 EntityEventOptions.entities 滤的是攻击方（damagingEntity），
 * 不是 hitEntity；传入本会话女仆即可只收其近战命中。
 */
function bindHitListener(session: Session): void {
  if (session.hitHandler) {
    return;
  }
  const maidId = session.maidId;
  const handler = (ev: EntityHitEntityAfterEvent) => {
    onSeekMarkerHit(session, ev);
  };
  session.hitHandler = handler;
  try {
    // entities = 攻击方女仆（已实测，非被击中方）
    world.afterEvents.entityHitEntity.subscribe(handler, {
      entities: [session.maid],
    });
  } catch (e) {
    session.hitHandler = undefined;
    Logger.warn(TAG, `bindHitListener maid=${maidId}: ${String(e)}`);
  }
}

/**
 * 卸本会话命中订阅。
 * 使用场景：teardown。
 */
function unbindHitListener(session: Session): void {
  const handler = session.hitHandler;
  session.hitHandler = undefined;
  if (!handler) {
    return;
  }
  try {
    world.afterEvents.entityHitEntity.unsubscribe(handler);
  } catch {
    /* ignore */
  }
}

/**
 * 近战命中 seek_marker：仅终点（goal）FollowAI 下命中己方 marker 则 advance/Done。
 * 使用场景：bindHitListener 回调；途经 via 仍由 tickFollowAI 距离判定，忽略命中。
 */
function onSeekMarkerHit(
  session: Session,
  ev: EntityHitEntityAfterEvent
): void {
  // 订阅可能在 teardown 后仍入队一帧
  if (!sessions.has(session.maidId) || session.phase !== "FollowAI") {
    return;
  }
  const hit = ev.hitEntity;
  if (!hit?.isValid || hit.typeId !== SEEK_MARKER_TYPE) {
    return;
  }
  const marker = session.marker;
  if (!marker?.isValid || marker.id !== hit.id) {
    return;
  }
  const cur = session.steps[session.index];
  // 途经不靠攻击切段，避免贴脸互推；仅终点用命中
  if (!cur || cur.kind !== "ai" || cur.role !== "goal") {
    return;
  }
  const maidId = session.maidId;
  const markerId = hit.id;
  // 下一 tick 推进，避免与引擎攻击回调重入
  system.run(() => {
    const s = sessions.get(maidId);
    if (!s || s.phase !== "FollowAI") {
      return;
    }
    if (!s.marker?.isValid || s.marker.id !== markerId) {
      return;
    }
    const step = s.steps[s.index];
    if (!step || step.kind !== "ai" || step.role !== "goal") {
      return;
    }
    advance(s);
  });
}

/**
 * 销毁会话 marker（仅 teardown）。
 * 使用场景：Done/Fail/Cancel；换路点不调用。
 */
function destroyMarker(session: Session): void {
  const m = session.marker;
  session.marker = undefined;
  if (!m) {
    return;
  }
  try {
    if (m.isValid) {
      // 即将 remove，不必再 release（stamp 属性随实体消失）
      m.remove();
    }
  } catch {
    /* ignore */
  }
}

/**
 * 当前步应对齐的 marker 世界坐标。
 * 使用场景：keepaliveMarker 重 spawn；与 beginStep 一致。
 */
function markerPosForCurrentStep(session: Session): Vector3 | undefined {
  const step = session.steps[session.index];
  if (!step) {
    return undefined;
  }
  if (step.kind === "gap") {
    return gapMarkerPos(step.edge);
  }
  return aiStampPos(step.support, step.role, session.goalBlocksAbove);
}

/**
 * 确保会话内唯一 marker：无则 spawn+stamp+TTL，有则 teleport。
 * 使用场景：每个 AI 路点 / Gap 对岸指示。
 */
function ensureMarker(session: Session, pos: Vector3): boolean {
  const maid = session.maid;
  const existing = session.marker;
  if (existing?.isValid) {
    try {
      existing.teleport(pos);
      return true;
    } catch {
      destroyMarker(session);
    }
  }
  try {
    const marker = maid.dimension.spawnEntity(
      Seek.MARKER_TYPE as never,
      pos
    );
    Seek.stamp(marker, session.seekId);
    Seek.startMarkerTtl(marker);
    session.markerRenewAtTick = system.currentTick;
    // thlmt:visible 默认 false；仅生成时按「显示路点」开一次即可
    if (config.path_show_waypoints.value) {
      marker.setProperty("thlmt:visible", true);
    }
    session.marker = marker;
    return true;
  } catch (e) {
    Logger.warn(TAG, `ensureMarker spawn failed: ${String(e)}`);
    return false;
  }
}

/**
 * 持有中续命 / TTL 竞态后重 spawn。
 * 使用场景：tickAll；会话仍在且需要路点时。
 */
function keepaliveMarker(session: Session): void {
  if (
    session.phase === "Idle" ||
    session.phase === "Done" ||
    session.phase === "Fail"
  ) {
    return;
  }
  const marker = session.marker;
  if (marker?.isValid) {
    const last = session.markerRenewAtTick ?? 0;
    if (system.currentTick - last >= MARKER_TTL_RENEW_TICKS) {
      Seek.renewMarkerTtl(marker);
      session.markerRenewAtTick = system.currentTick;
    }
    return;
  }
  const pos = markerPosForCurrentStep(session);
  if (!pos) {
    return;
  }
  if (!ensureMarker(session, pos)) {
    Logger.warn(
      TAG,
      `keepaliveMarker respawn failed maid=${session.maidId} phase=${session.phase}`
    );
  }
}

/**
 * 挂 Seek（若未挂）并按角色切换追逐；不因换点 resetTarget。
 * 使用场景：AI 段；via→goal 切追逐组；via→via 也 quit+重挂 via melee，避免抵达后短暂丢目标。
 */
function ensureSeek(session: Session, role: WaypointRole): boolean {
  const maid = session.maid;
  if (Seek.getIndex(maid) !== session.seekId) {
    // 默认严格 NAT（must_reach true）
    if (!Seek.mount(maid, session.seekId)) {
      return false;
    }
    Seek.mountPursue(maid, pursueEventFor(role));
    session.pursueRole = role;
    return true;
  }
  // 脚本段用过 soft：同档 setIntSlot 会短路，须强制切回严格
  if (Seek.isNatSoft(maid)) {
    if (!Seek.mountStrict(maid, session.seekId)) {
      return false;
    }
  }
  if (session.pursueRole !== role) {
    Seek.mountPursue(maid, pursueEventFor(role));
    session.pursueRole = role;
    return true;
  }
  // 途经→途经：事件里「已有 via 组再 add」常不刷新；先卸再挂重载 melee_attack
  if (role === "via") {
    Seek.quitPursue(maid);
    Seek.mountPursue(maid, Seek.PURSUE_VIA);
  }
  return true;
}

/** 这次寻路还没结束的女仆。回家传送要等抵达、取消或走路失败。 */
const homeReturnSuppress = new Set<string>();

/**
 * 从这次开始寻路起，不执行回家传送。
 * 使用场景：Path.follow / 耕地出发找路；平走、跳、跨沟和滞空都算在内。
 */
export function suppressHomeReturn(maidId: string): void {
  homeReturnSuppress.add(maidId);
}

/**
 * 这次寻路结束，恢复回家传送。
 * 使用场景：抵达、取消、走路失败，或这次没有真正出发。
 */
export function allowHomeReturn(maidId: string): void {
  homeReturnSuppress.delete(maidId);
}

/**
 * 这次寻路是否还没结束。
 * 使用场景：tryReturnHome。会话还在时也算，避免只清了集合却还在走。
 */
export function isHomeReturnSuppressed(maidId: string): boolean {
  return homeReturnSuppress.has(maidId) || sessions.has(maidId);
}
/** teardown：卸 Seek 档及追逐/目视（见 Seek.quit）。 */
function quitSeekWithPursue(maid: Entity): void {
  Seek.quit(maid);
}

/**
 * teardown 的 reason 字符串 → 回调粗分枚举。
 * 使用场景：onComplete；cancel / done 特判，其余一律 fail。
 */
function toCompleteReason(reason: string): PathFollowCompleteReason {
  if (reason === "done") {
    return "done";
  }
  if (reason === "cancel") {
    return "cancel";
  }
  return "fail";
}

/**
 * 已经排进下一帧、但还没调用的 onComplete 次数。
 * 使用场景：这一帧 isFollowing 已是 false，心跳不要抢先收割。
 */
const pendingComplete = new Map<string, number>();

/** 记下一次尚未执行的完成通知。 */
function markPendingComplete(maidId: string): void {
  pendingComplete.set(maidId, (pendingComplete.get(maidId) ?? 0) + 1);
}

/** 完成通知已返回（含抛错）。 */
function clearPendingComplete(maidId: string): void {
  const left = (pendingComplete.get(maidId) ?? 1) - 1;
  if (left <= 0) {
    pendingComplete.delete(maidId);
  } else {
    pendingComplete.set(maidId, left);
  }
}

/**
 * 在 session 已从 map 拆除后，下一 tick 安全调用 onComplete。
 * 使用场景：避免 Farm.assignNext 与当前 Executor tick 重入。
 */
function scheduleComplete(
  session: Session,
  reason: string
): void {
  const cb = session.onComplete;
  if (!cb) {
    return;
  }
  const info: PathFollowCompleteInfo = {
    reason: toCompleteReason(reason),
    detail: reason,
    dest: { ...session.dest },
    maidId: session.maidId,
  };
  markPendingComplete(session.maidId);
  system.run(() => {
    try {
      cb(info);
    } catch (e) {
      Logger.warn(TAG, `onComplete: ${String(e)}`);
    } finally {
      clearPendingComplete(session.maidId);
    }
  });
}

/**
 * 释放 Seek / 移速 / marker；可选写入不可达缓存；推送 onComplete。
 */
function teardown(
  session: Session,
  reason: string,
  opts: { ban: boolean; log: string }
): void {
  session.failReason = reason;
  session.phase = reason === "done" ? "Done" : "Fail";
  destroyMarker(session);
  const maid = session.maid;
  try {
    if (maid.isValid) {
      quitSeekWithPursue(maid);
      restoreMaidMovement(maid);
    }
  } catch {
    /* ignore */
  }
  Seek.free(session.seekId);
  if (opts.ban) {
    unreachableCache.add(session.dimId, session.dest, session.maidId);
  }
  unbindHitListener(session);
  sessions.delete(session.maidId);
  allowHomeReturn(session.maidId);
  Logger.info(TAG, `${opts.log} maid=${session.maidId} reason=${reason}`);
  stopTickerIfIdle();
  scheduleComplete(session, reason);
}

function failSession(session: Session, reason: string): void {
  if (session.phase === "InFlight") {
    inFlightCount = Math.max(0, inFlightCount - 1);
  }
  session.gapAir = undefined;
  teardown(session, reason, { ban: true, log: "Fail" });
}

function succeedSession(session: Session): void {
  teardown(session, "done", { ban: false, log: "Done" });
}

function advance(session: Session): void {
  // 不销毁 marker：下一步 beginStep 原地 teleport
  session.index++;
  if (session.index >= session.steps.length) {
    succeedSession(session);
    return;
  }
  beginStep(session);
}

function beginStep(session: Session): void {
  const maid = session.maid;
  if (!maid.isValid) {
    failSession(session, "maid_invalid");
    return;
  }
  const step = session.steps[session.index];
  session.phaseAtTick = system.currentTick;
  session.scriptFollow = undefined;
  session.aiNoTargetSinceTick = undefined;
  session.aiHadSeekTarget = undefined;
  session.aiStallRefH = undefined;
  session.aiStallSinceTick = undefined;
  if (step.kind === "gap") {
    session.phase = "PrepGap";
    try {
      // Gap：marker 沿跳向偏出碰撞半径并抬高，避免与落地重叠
      const gapRole: WaypointRole = "via";
      if (!ensureMarker(session, gapMarkerPos(step.edge))) {
        failSession(session, "spawn_marker");
        return;
      }
      if (!ensureSeek(session, gapRole)) {
        failSession(session, "seek_mount");
      }
    } catch {
      /* ignore */
    }
    return;
  }
  session.phase = "FollowAI";
  session.goalRangeSinceTick = undefined;
  const stampPos = aiStampPos(step.support, step.role, session.goalBlocksAbove);
  if (!ensureMarker(session, stampPos)) {
    failSession(session, "spawn_marker");
    return;
  }
  // via→goal：抵达末途经后进入终点步时切换追逐；途经之间不重锁
  if (!ensureSeek(session, step.role)) {
    failSession(session, "seek_mount");
  }
}

/**
 * 指向目标的 cardinal（取主轴）。
 * 使用场景：ScriptFollow 巡航方向。
 */
function cardinalToward(from: Vector3, to: Vector3): CardinalDir {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  if (Math.abs(dx) >= Math.abs(dz)) {
    return { dx: dx === 0 ? 1 : dx > 0 ? 1 : -1, dz: 0 };
  }
  return { dx: 0, dz: dz === 0 ? 1 : dz > 0 ? 1 : -1 };
}

/**
 * 女仆当前 AI 目标是否为本会话 marker（stamp 正确且仍有效）。
 * 使用场景：§5.2 选不中 / 丢目标观测。
 */
function hasSeekMarkerTarget(maid: Entity, marker: Entity | undefined): boolean {
  if (!marker?.isValid) {
    return false;
  }
  try {
    const t = maid.target;
    return t !== undefined && t.isValid && t.id === marker.id;
  } catch {
    return false;
  }
}

/**
 * 切脚本冲量回退（不立刻 Fail）。
 * 使用场景：tickFollowAI；reason=ai_no_target|ai_stall|ai_goal_no_melee|ai_timeout。
 */
function enterScriptFollow(session: Session, reason: string): void {
  const step = session.steps[session.index];
  if (step.kind !== "ai") {
    failSession(session, reason);
    return;
  }
  const maid = session.maid;
  // 与 FollowAI stamp 同一点：via 眼高 / goal 作物体心（勿改脚位，避免切换后 marker 跳变）
  const stamp = aiStampPos(step.support, step.role, session.goalBlocksAbove);
  // 须在 disableAutonomous 前读定义移速
  const defMov = readDefMovement(maid);
  const params = defaultDriveParams(defMov);
  enterScriptProxy(maid, { marker: session.marker, lookAtFeet: stamp });
  session.pursueRole = undefined;
  faceOnce(maid, stamp);
  session.aiNoTargetSinceTick = undefined;
  session.aiHadSeekTarget = undefined;
  session.aiStallRefH = undefined;
  session.aiStallSinceTick = undefined;
  session.goalRangeSinceTick = undefined;
  session.scriptFollow = {
    params,
    dir: cardinalToward(maid.location, stamp),
    goalFeet: stamp,
    goalSupportY: step.support.y,
    jumped: false,
    jumpedAtTick: undefined,
    jumpAttempts: 0,
    tickCount: 0,
  };
  session.phase = "ScriptFollow";
  session.phaseAtTick = system.currentTick;
  Logger.info(
    TAG,
    `ScriptFollow enter maid=${session.maidId} i=${session.index} role=${step.role} reason=${reason} cruise=${params.targetCruise.toFixed(3)}`
  );
}

/**
 * FollowAI：无正确目标 / 无进展 → 提早 ScriptFollow；仍保留硬超时兜底。
 * 使用场景：tickFollowAI 每拍。
 */
function shouldEarlyScriptFollow(session: Session): string | undefined {
  const maid = session.maid;
  const step = session.steps[session.index];
  if (step.kind !== "ai") {
    return undefined;
  }
  const loc = maid.location;
  const goalFeet = feetOf(step.support);
  const hDist = Math.hypot(loc.x - goalFeet.x, loc.z - goalFeet.z);

  // 近抵达窗内也允许切脚本：终点旁原版打不着 / 无 target 时不能再被「近了就不判」挡住
  // 1) 无正确目标：首次空 ≥15 tick；曾有 target 再丢 ≥ LOST（现为 0）
  if (hasSeekMarkerTarget(maid, session.marker)) {
    session.aiHadSeekTarget = true;
    session.aiNoTargetSinceTick = undefined;
  } else {
    const tick = system.currentTick;
    const sinceTick = session.aiNoTargetSinceTick ?? tick;
    session.aiNoTargetSinceTick = sinceTick;
    const hold = session.aiHadSeekTarget
      ? AI_NO_TARGET_LOST_HOLD_TICKS
      : AI_NO_TARGET_FIRST_HOLD_TICKS;
    if (tick - sinceTick >= hold) {
      return "ai_no_target";
    }
  }

  // 2) 水平距无实质靠近：连续 ≥50 游戏 tick 未缩短 ≥0.25 格
  // 已贴在终点旁（h 很小）时用 stall 表示「近了但原版无进展」
  const tick = system.currentTick;
  if (session.aiStallRefH === undefined || session.aiStallSinceTick === undefined) {
    session.aiStallRefH = hDist;
    session.aiStallSinceTick = tick;
  } else if (hDist <= session.aiStallRefH - AI_STALL_IMPROVE_H) {
    session.aiStallRefH = hDist;
    session.aiStallSinceTick = tick;
  } else if (tick - session.aiStallSinceTick >= AI_STALL_HOLD_TICKS) {
    return "ai_stall";
  }

  return undefined;
}

function tickFollowAI(session: Session): void {
  const maid = session.maid;
  const step = session.steps[session.index];
  if (step.kind !== "ai") {
    return;
  }
  if (system.currentTick - session.phaseAtTick > AI_EDGE_TIMEOUT_TICKS) {
    enterScriptFollow(session, "ai_timeout");
    return;
  }
  const early = shouldEarlyScriptFollow(session);
  if (early) {
    enterScriptFollow(session, early);
    return;
  }
  // 途经：距离抵达（恢复旧逻辑）
  if (step.role === "via" && nearSupport(maid, step.support, ARRIVE_VIA_R)) {
    advance(session);
    return;
  }
  // 终点：近战命中仍走 onSeekMarkerHit；进水平圈后宽限结束仍未打中 → 脚本（目视+球形触及）
  if (step.role !== "goal") {
    return;
  }
  if (!nearSupport(maid, step.support, ARRIVE_GOAL_R)) {
    session.goalRangeSinceTick = undefined;
    return;
  }
  const tick = system.currentTick;
  const since = session.goalRangeSinceTick ?? tick;
  session.goalRangeSinceTick = since;
  if (tick - since >= GOAL_MELEE_GRACE_TICKS) {
    enterScriptFollow(session, "ai_goal_no_melee");
  }
}

/**
 * 脚本回退：巡航 + 可选 Jump1；抵达 checkScriptArrive。
 * 使用场景：AI 超时后；空中不补水平。
 */
function tickScriptFollow(session: Session): void {
  const sf = session.scriptFollow;
  const step = session.steps[session.index];
  if (!sf || step.kind !== "ai") {
    failSession(session, "script_follow_bad_state");
    return;
  }
  const maid = session.maid;
  if (system.currentTick - session.phaseAtTick > SCRIPT_FOLLOW_TIMEOUT_TICKS) {
    restoreMaidMovement(maid);
    session.scriptFollow = undefined;
    failSession(session, "script_follow_timeout");
    return;
  }
  sf.tickCount += 1;

  const reachR = step.role === "goal" ? ARRIVE_GOAL_R : ARRIVE_VIA_R;
  if (
    checkScriptArrive(maid, sf.goalFeet, {
      reachR,
      requireOnGround: true,
    })
  ) {
    restoreMaidMovement(maid);
    session.scriptFollow = undefined;
    Logger.info(
      TAG,
      `ScriptFollow done maid=${session.maidId} i=${session.index} ticks=${sf.tickCount}`
    );
    advance(session);
    return;
  }

  let onGround = false;
  try {
    onGround = maid.isOnGround;
  } catch {
    onGround = false;
  }
  if (!onGround) {
    return;
  }

  let vx = 0;
  let vz = 0;
  try {
    const v = maid.getVelocity();
    vx = v.x;
    vz = v.z;
  } catch {
    /* keep */
  }
  const alongVel = vx * sf.dir.dx + vz * sf.dir.dz;
  const loc = maid.location;
  const hDist = Math.hypot(loc.x - sf.goalFeet.x, loc.z - sf.goalFeet.z);

  // 需爬升：低台、水平距在窗内、巡航带内 → Jump1（空中不补）
  if (
    sf.jumpAttempts < SCRIPT_JUMP_MAX &&
    loc.y < sf.goalSupportY + 0.9 &&
    hDist >= SCRIPT_JUMP_HDIST_MIN &&
    hDist <= SCRIPT_JUMP_HDIST_MAX
  ) {
    if (
      sf.jumped &&
      sf.jumpedAtTick !== undefined &&
      sf.tickCount - sf.jumpedAtTick >= SCRIPT_JUMP_RETRY_TICKS
    ) {
      sf.jumped = false;
    }
    const alongMin = sf.params.targetCruise * JUMP1_ALONG_MIN_FACTOR;
    const alongMax = sf.params.targetCruise * JUMP1_ALONG_MAX_FACTOR;
    if (!sf.jumped && alongVel >= alongMin && alongVel <= alongMax) {
      const toSupport = {
        x: step.support.x,
        y: step.support.y,
        z: step.support.z,
      };
      const fromSupport = {
        x: Math.floor(loc.x),
        y: Math.floor(loc.y) - 1,
        z: Math.floor(loc.z),
      };
      const info = applyJump1Impulse(maid, {
        toSupport,
        fromSupport,
        hy: PLAYER_JUMP_HY,
        hySrc: "player_default",
      });
      if (info) {
        sf.jumped = true;
        sf.jumpedAtTick = sf.tickCount;
        sf.jumpAttempts += 1;
      }
      return;
    }
  }

  // 方向可随相对位置刷新（拐弯后回退）
  sf.dir = cardinalToward(loc, sf.goalFeet);
  tickWalkDrive(maid, sf.dir, sf.goalFeet, sf.params, {
    arriveH: reachR,
  });
}

function tickPrepGap(session: Session): void {
  const maid = session.maid;
  const step = session.steps[session.index];
  if (step.kind !== "gap") {
    return;
  }
  const edge = step.edge;
  if (system.currentTick - session.phaseAtTick > PREP_TIMEOUT_TICKS) {
    failSession(session, "prep_timeout");
    return;
  }
  // Gap 起跳格：用途经紧容差，确保站稳再冲量
  if (!nearSupport(maid, edge.from, ARRIVE_VIA_R)) {
    return;
  }
  let onGround = true;
  try {
    onGround = maid.isOnGround;
  } catch {
    onGround = true;
  }
  if (!onGround) {
    return;
  }
  if (inFlightCount >= IN_FLIGHT_MAX) {
    return;
  }
  // movement=0 不吃 applyImpulse；代理段可用 Movement.disableAutonomous（含 lock）
  session.phase = "Impulse";
  session.phaseAtTick = system.currentTick;
  doImpulse(session);
}

function doImpulse(session: Session): void {
  const maid = session.maid;
  const step = session.steps[session.index];
  if (step.kind !== "gap") {
    failSession(session, "impulse_not_gap");
    return;
  }
  const edge = step.edge;
  const dxBlocks = edge.to.x - edge.from.x;
  const dzBlocks = edge.to.z - edge.from.z;
  const plannedDist = Math.max(Math.abs(dxBlocks), Math.abs(dzBlocks));
  const plannedDy = edge.to.y - edge.from.y;
  const dbg = resolveImpulseEx(
    maid.location,
    edge.to,
    plannedDist,
    plannedDy,
    edge.from
  );
  if (!dbg) {
    failSession(session, "no_impulse");
    return;
  }
  const { vec: imp, toFeet } = dbg;
  const ddx = toFeet.x - maid.location.x;
  const ddz = toFeet.z - maid.location.z;
  const len = Math.sqrt(ddx * ddx + ddz * ddz) || 1;
  const vx = (ddx / len) * imp.hx;
  const vz = (ddz / len) * imp.hx;
  const pad = dbg.fromPadFeet;
  const padOff = pad
    ? Math.hypot(maid.location.x - pad.x, maid.location.z - pad.z)
    : NaN;
  logGap(
    [
      "IMPULSE",
      `i=${session.index}`,
      `plan=${dbg.plannedDist}:${dbg.plannedDy}`,
      `from=${f3(dbg.from.x)},${f3(dbg.from.y)},${f3(dbg.from.z)}`,
      pad
        ? `fromPad=${f3(pad.x)},${f3(pad.y)},${f3(pad.z)},padOffH=${f3(padOff)}`
        : "fromPad=-",
      `toFeet=${f3(toFeet.x)},${f3(toFeet.y)},${f3(toFeet.z)}`,
      `toBlock=${edge.to.x},${edge.to.y},${edge.to.z}`,
      `actualH=${f3(dbg.actualH)}`,
      `targetH=${f3(dbg.targetH)}`,
      `hx=${f3(imp.hx)}`,
      `hy=${f3(imp.hy)}`,
      `hyRaw=${f3(dbg.hyRaw)}`,
      `dir=${f3(ddx / len)},${f3(ddz / len)}`,
      `v=${f3(vx)},${f3(imp.hy)},${f3(vz)}`,
    ].join(",")
  );
  // 脚本代理段：禁走 + look-only；一次 facing（keepVelocity）后冲量
  enterScriptProxy(maid, { marker: session.marker, lookAtFeet: toFeet });
  session.pursueRole = undefined;
  faceOnce(maid, toFeet);
  try {
    maid.clearVelocity();
    maid.applyImpulse({ x: vx, y: imp.hy, z: vz });
  } catch (e) {
    failSession(session, `impulse:${String(e)}`);
    return;
  }
  // 腾空修正快照：FIT 预计落点相对此状态递推
  session.gapAir = {
    from: {
      x: maid.location.x,
      y: maid.location.y,
      z: maid.location.z,
    },
    toFeet: { x: toFeet.x, y: toFeet.y, z: toFeet.z },
    hx: imp.hx,
    hy: imp.hy,
    dirX: ddx / len,
    dirZ: ddz / len,
  };
  inFlightCount++;
  session.phase = "InFlight";
  session.phaseAtTick = system.currentTick;
}

function tickInFlight(session: Session): void {
  const maid = session.maid;
  const step = session.steps[session.index];
  if (step.kind !== "gap") {
    return;
  }
  const edge = step.edge;
  if (system.currentTick - session.phaseAtTick > FLIGHT_TIMEOUT_TICKS) {
    restoreMaidMovement(maid);
    session.gapAir = undefined;
    failSession(session, "flight_timeout");
    return;
  }
  let onGround = false;
  try {
    onGround = maid.isOnGround;
  } catch {
    onGround = false;
  }
  // 未落地：每 tick 按 FIT 预计落点做 xz 修正
  if (!onGround) {
    tryAirCorrect(session);
    return;
  }
  const toFeet = feetOfSupport(edge.to);
  // 头点球形：目标在脚位时竖直分量约 1.2～1.5，默认 via 半径 0.75 不够；用终点触及 3（与 pursue 对齐）
  if (
    onGround &&
    checkScriptArrive(maid, toFeet, {
      requireOnGround: true,
      reachR: ARRIVE_GOAL_R,
    })
  ) {
    const loc = maid.location;
    const errH = Math.hypot(loc.x - toFeet.x, loc.z - toFeet.z);
    const errV = loc.y - toFeet.y;
    const jumpDx = toFeet.x - (edge.from.x + 0.5);
    const jumpDz = toFeet.z - (edge.from.z + 0.5);
    const jumpLen = Math.hypot(jumpDx, jumpDz) || 1;
    const along =
      ((loc.x - toFeet.x) * jumpDx + (loc.z - toFeet.z) * jumpDz) / jumpLen;
    const lateral =
      ((loc.x - toFeet.x) * -jumpDz + (loc.z - toFeet.z) * jumpDx) / jumpLen;
    logGap(
      [
        "LAND",
        `i=${session.index}`,
        `land=${f3(loc.x)},${f3(loc.y)},${f3(loc.z)}`,
        `toFeet=${f3(toFeet.x)},${f3(toFeet.y)},${f3(toFeet.z)}`,
        `toBlock=${edge.to.x},${edge.to.y},${edge.to.z}`,
        `errH=${f3(errH)}`,
        `errV=${f3(errV)}`,
        `along=${f3(along)}`,
        `lateral=${f3(lateral)}`,
        `flightTicks=${system.currentTick - session.phaseAtTick}`,
        `arrive=reach_cone`,
      ].join(",")
    );
    // 落地刹住水平动量，避免滑出垫格（小碰撞箱后续更依赖此点）
    clearHorizontalVelocity(maid);
    session.gapAir = undefined;
    inFlightCount = Math.max(0, inFlightCount - 1);
    restoreMaidMovement(maid);
    // 下一段 beginStep 按需 teleport / 重挂追逐
    advance(session);
  }
}

/**
 * 世界设置「显示路点」开启时，对尚未完成的路点刷粒子（含 Gap 对岸）。
 * 使用场景：tickAll；途经红、终点绿；已走过的路点不再显示。
 */
function spawnWaypointParticles(session: Session): void {
  if (!config.path_show_waypoints.value) {
    return;
  }
  const maid = session.maid;
  if (!maid.isValid) {
    return;
  }
  const dim = maid.dimension;
  const last = session.steps.length - 1;
  for (let i = session.index; i < session.steps.length; i++) {
    const step = session.steps[i];
    let pos: Vector3;
    let isGoal = false;
    if (step.kind === "ai") {
      isGoal = step.role === "goal";
      pos = aiStampPos(step.support, step.role, session.goalBlocksAbove);
    } else {
      // Gap：粒子与 Seek marker 同偏置，便于对照
      isGoal = i === last;
      pos = gapMarkerPos(step.edge);
    }
    const particleId = isGoal ? PARTICLE_GOAL : PARTICLE_VIA;
    try {
      dim.spawnParticle(particleId as never, pos);
    } catch {
      /* 粒子缺失或维度异常时忽略 */
    }
  }
}

/**
 * 每 tick 在女仆当前位置刷蓝色轨迹点（留存约 10s）。
 * 使用场景：path_show_trail 开启时；path_go / follow 落点可视化。
 */
function spawnTrailParticle(session: Session): void {
  if (!config.path_show_trail.value) {
    return;
  }
  const maid = session.maid;
  if (!maid.isValid) {
    return;
  }
  try {
    const loc = maid.location;
    maid.dimension.spawnParticle(PARTICLE_TRAIL as never, {
      x: loc.x,
      y: loc.y + 0.1,
      z: loc.z,
    });
  } catch {
    /* 粒子缺失或维度异常时忽略 */
  }
}

function tickAll(): void {
  for (const session of [...sessions.values()]) {
    if (!session.maid.isValid) {
      failSession(session, "maid_invalid");
      continue;
    }
    // 坐下 / 抱起 / 睡觉：外力终止（与 Pose.set* 边沿 cancel 互补）
    if (Pose.blocksFollow(session.maid)) {
      Executor.cancel(session.maid);
      continue;
    }
    keepaliveMarker(session);
    spawnTrailParticle(session);
    spawnWaypointParticles(session);
    switch (session.phase) {
      case "FollowAI":
        tickFollowAI(session);
        break;
      case "ScriptFollow":
        tickScriptFollow(session);
        break;
      case "PrepGap":
        tickPrepGap(session);
        break;
      case "Impulse":
        doImpulse(session);
        break;
      case "InFlight":
        tickInFlight(session);
        break;
      default:
        break;
    }
  }
}

/**
 * 路径执行器 API。
 * 使用场景：Path.follow / Path.cancel。
 */
export const Executor = {
  /**
   * 开始跟随已规划路径；同女仆已有会话则先 cancel。
   * @returns 是否成功启动
   */
  start(
    maid: Entity,
    edges: PathEdge[],
    dest: StandNode,
    options?: ExecutorStartOptions
  ): boolean {
    if (!maid.isValid) {
      return false;
    }
    if (Pose.blocksFollow(maid)) {
      Logger.info(
        TAG,
        `start refused maid=${maid.id} reason=pose_blocks_follow`
      );
      return false;
    }
    suppressHomeReturn(maid.id);
    Executor.cancel(maid);
    suppressHomeReturn(maid.id);
    const built = buildFollowSteps(edges);
    // 已经站在终点格时没有边。仍挂终点追逐，让她先转向打路点，而不是立刻当抵达。
    const steps: FollowStep[] =
      built.length > 0
        ? built
        : [{ kind: "ai", support: dest, role: "goal" }];
    const seekId = Seek.allocate();
    if (seekId === undefined) {
      allowHomeReturn(maid.id);
      Logger.warn(TAG, "start: seek 池满");
      return false;
    }
    // Seek/marker 在首个 beginStep 挂上（含以 Gap 开头）
    const session: Session = {
      maidId: maid.id,
      maid,
      dimId: maid.dimension.id,
      steps,
      index: 0,
      seekId,
      marker: undefined,
      pursueRole: undefined,
      phase: "Idle",
      phaseAtTick: system.currentTick,
      dest,
      onComplete: options?.onComplete,
      goalBlocksAbove: options?.goalBlocksAbove ?? 1,
    };
    sessions.set(maid.id, session);
    ensureTicker();
    bindHitListener(session);
    beginStep(session);
    return sessions.has(maid.id);
  },

  /**
   * 取消跟随并释锁（不写不可达 ban）。
   */
  cancel(maid: Entity): void {
    const session = sessions.get(maid.id);
    if (!session) {
      return;
    }
    if (session.phase === "InFlight") {
      inFlightCount = Math.max(0, inFlightCount - 1);
    }
    teardown(session, "cancel", { ban: false, log: "Cancel" });
  },

  isFollowing(maid: Entity): boolean {
    return sessions.has(maid.id);
  },

  /**
   * 完成通知已排进下一帧，尚未调用。
   * 使用场景：耕地心跳。跟随已经结束，但 onComplete 还没收割。
   */
  hasPendingComplete(maid: Entity): boolean {
    return (pendingComplete.get(maid.id) ?? 0) > 0;
  },

  activeCount(): number {
    return sessions.size;
  },
};

// 姿态边沿 cancel：坐下 / 抱起 / 睡觉 → 终止 follow（避免 Pose 静态依赖本模块）
setCancelFollowHook((maid) => {
  Executor.cancel(maid);
});
