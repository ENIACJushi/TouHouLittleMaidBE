/**
 * 路径执行器状态机（Task7 Phase2）。
 * 使用场景：Path.follow；Walk/Jump1/Fall 用 Seek+marker；SprintGap 用冲量。
 *
 * 路点策略：
 * - 连续 Walk 抽稀（步长 VIA_STEP），Jump1/Fall/段尾保留；
 * - **单 marker 实体**：会话内 spawn 一次，换路点只 teleport（Seek 一次锁定，不反复 reset）；
 * - 途经平视 + pursue_via；**抵达末途经之后、走向终点时**再切 goal 追逐与脚位；
 * - Gap 仅临时卸 Seek（保留 marker），落地后按下一步角色再挂回；
 * - 触及范围内即视为到达。
 *
 * Fail：quit + release + free + UnreachableCache（cancel 不写 ban）。
 */
import { Entity, system, Vector3 } from "@minecraft/server";
import { config } from "../../controller/Config";
import { Logger } from "../../controller/Logger";
import { Movement } from "../facets/Movement";
import { Seek } from "../facets/Seek";
import { resolveImpulse, feetOfSupport } from "./ImpulseTable";
import { PathEdge, StandNode } from "./types";
import { unreachableCache } from "./UnreachableCache";

const TAG = "Path.Executor";

/** 途经路点调试粒子（红色） */
const PARTICLE_VIA = "touhou_little_maid:path_waypoint_via";
/** 终点路点调试粒子（绿色） */
const PARTICLE_GOAL = "touhou_little_maid:path_waypoint_goal";

/** 同时处于 InFlight（冲量飞行）的女仆上限 */
export const IN_FLIGHT_MAX = 4;

/**
 * 连续 Walk 抽稀步长：每隔这么多格留一个途经点（段尾必留）。
 * 使用场景：省略原版可走完的中间格，且不超过 follow_range 安全余量。
 */
const VIA_STEP = 16;

/** 途经到达水平容差（触及≈0，略放宽抖动） */
const ARRIVE_VIA_H = 0.75;
/**
 * 终点到达水平容差：对齐 slot:seek_pursue 的 attack_radius(2.1)。
 * 使用场景：引擎因触及停下时脚本仍判 Done。
 */
const ARRIVE_GOAL_H = 2.0;
/** 到达竖直容差 */
const ARRIVE_V = 1.6;
/**
 * 途经 marker 相对脚位的眼高偏移（女仆 collision height≈1.5）。
 * 使用场景：中间路点平视，避免低头盯脚边。
 */
const EYE_OFFSET_FROM_FEET = 1.2;

const AI_EDGE_TIMEOUT_MS = 12_000;
const FLIGHT_TIMEOUT_MS = 1_500;
const PREP_TIMEOUT_MS = 3_000;

type Phase =
  | "Idle"
  | "FollowAI"
  | "PrepGap"
  | "Impulse"
  | "InFlight"
  | "Done"
  | "Fail";

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
 * 单女仆跟随会话。
 * 使用场景：sessions map；tick 驱动。
 */
type Session = {
  maidId: string;
  /** 启动时实体引用；每 tick 查 isValid */
  maid: Entity;
  steps: FollowStep[];
  index: number;
  seekId: number;
  marker: Entity | undefined;
  /** 当前追逐角色；仅 via→goal（或反之）时切换组件组 */
  pursueRole: WaypointRole | undefined;
  phase: Phase;
  phaseAt: number;
  dest: StandNode;
  failReason?: string;
};

const sessions = new Map<string, Session>();
let tickHandle: number | undefined;
let inFlightCount = 0;

function now(): number {
  return Date.now();
}

/**
 * 脚位（支撑顶面中心）：终点路点 / Gap 到达判定用。
 */
function feetOf(support: StandNode): Vector3 {
  return {
    x: support.x + 0.5,
    y: support.y + 1,
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

function horizDist(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * 是否到达支撑格（相对脚位测距）。
 * @param horizMax 水平容差：途经 / 终点不同
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

function arriveHorizFor(role: WaypointRole): number {
  return role === "goal" ? ARRIVE_GOAL_H : ARRIVE_VIA_H;
}

function pursueEventFor(role: WaypointRole): string {
  return role === "goal" ? Seek.PURSUE_DEFAULT : Seek.PURSUE_VIA;
}

/**
 * 连续 Walk 边中保留哪些 `to` 下标（0-based）；段尾必留。
 * 使用场景：buildFollowSteps 抽稀。
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
      while (j < edges.length && edges[j].kind === "Walk") {
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
      Seek.release(m);
      m.remove();
    }
  } catch {
    /* ignore */
  }
}

/**
 * 确保会话内唯一 marker：无则 spawn+stamp，有则 teleport。
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
    session.marker = marker;
    return true;
  } catch (e) {
    Logger.warn(TAG, `ensureMarker spawn failed: ${String(e)}`);
    return false;
  }
}

/**
 * 挂 Seek（若未挂）并按角色切换追逐；不因换点 resetTarget。
 * 使用场景：AI 段；via→goal 仅在此切换追逐组。
 */
function ensureSeek(session: Session, role: WaypointRole): boolean {
  const maid = session.maid;
  if (Seek.getIndex(maid) !== session.seekId) {
    if (!Seek.mount(maid, session.seekId)) {
      return false;
    }
    Seek.mountPursue(maid, pursueEventFor(role));
    session.pursueRole = role;
    return true;
  }
  if (session.pursueRole !== role) {
    Seek.mountPursue(maid, pursueEventFor(role));
    session.pursueRole = role;
  }
  return true;
}

/** 卸追逐 + Seek 档（保留 marker 实体） */
function quitSeekWithPursue(maid: Entity): void {
  Seek.quitPursue(maid);
  Seek.quit(maid);
}

/**
 * 释放 Seek / 移速 / marker；可选写入不可达缓存。
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
      Movement.unlock(maid);
    }
  } catch {
    /* ignore */
  }
  Seek.free(session.seekId);
  if (opts.ban) {
    unreachableCache.add(session.dest, session.maidId);
  }
  sessions.delete(session.maidId);
  Logger.info(TAG, `${opts.log} maid=${session.maidId} reason=${reason}`);
  stopTickerIfIdle();
}

function failSession(session: Session, reason: string): void {
  if (session.phase === "InFlight") {
    inFlightCount = Math.max(0, inFlightCount - 1);
  }
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
  session.phaseAt = now();
  if (step.kind === "gap") {
    session.phase = "PrepGap";
    try {
      // 冲量前卸 Seek，避免 AI 抢速度；marker 保留并挪到对岸便于指示
      quitSeekWithPursue(maid);
      session.pursueRole = undefined;
      ensureMarker(session, eyeOf(step.edge.to));
    } catch {
      /* ignore */
    }
    return;
  }
  session.phase = "FollowAI";
  const stampPos =
    step.role === "goal" ? feetOf(step.support) : eyeOf(step.support);
  if (!ensureMarker(session, stampPos)) {
    failSession(session, "spawn_marker");
    return;
  }
  // via→goal：抵达末途经后进入终点步时切换追逐；途经之间不重锁
  if (!ensureSeek(session, step.role)) {
    failSession(session, "seek_mount");
  }
}

function tickFollowAI(session: Session): void {
  const maid = session.maid;
  const step = session.steps[session.index];
  if (step.kind !== "ai") {
    return;
  }
  if (now() - session.phaseAt > AI_EDGE_TIMEOUT_MS) {
    failSession(session, "ai_timeout");
    return;
  }
  if (nearSupport(maid, step.support, arriveHorizFor(step.role))) {
    advance(session);
  }
}

function tickPrepGap(session: Session): void {
  const maid = session.maid;
  const step = session.steps[session.index];
  if (step.kind !== "gap") {
    return;
  }
  const edge = step.edge;
  if (now() - session.phaseAt > PREP_TIMEOUT_MS) {
    failSession(session, "prep_timeout");
    return;
  }
  // Gap 起跳格：用途经紧容差，确保站稳再冲量
  if (!nearSupport(maid, edge.from, ARRIVE_VIA_H)) {
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
  // 勿 Movement.lock：移速钳为 0 会吃掉 applyImpulse 水平分量
  session.phase = "Impulse";
  session.phaseAt = now();
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
  // 以标定表为参考，按「当前脚位 → 对岸脚位」实际距离缩放
  const imp = resolveImpulse(maid.location, edge.to, plannedDist, plannedDy);
  if (!imp) {
    failSession(session, "no_impulse");
    return;
  }
  const toFeet = feetOfSupport(edge.to);
  const ddx = toFeet.x - maid.location.x;
  const ddz = toFeet.z - maid.location.z;
  const len = Math.sqrt(ddx * ddx + ddz * ddz) || 1;
  const vx = (ddx / len) * imp.hx;
  const vz = (ddz / len) * imp.hx;
  try {
    maid.clearVelocity();
    maid.applyImpulse({ x: vx, y: imp.hy, z: vz });
  } catch (e) {
    failSession(session, `impulse:${String(e)}`);
    return;
  }
  inFlightCount++;
  session.phase = "InFlight";
  session.phaseAt = now();
}

function tickInFlight(session: Session): void {
  const maid = session.maid;
  const step = session.steps[session.index];
  if (step.kind !== "gap") {
    return;
  }
  const edge = step.edge;
  if (now() - session.phaseAt > FLIGHT_TIMEOUT_MS) {
    Movement.unlock(maid);
    failSession(session, "flight_timeout");
    return;
  }
  let onGround = false;
  try {
    onGround = maid.isOnGround;
  } catch {
    onGround = false;
  }
  if (onGround && nearSupport(maid, edge.to, ARRIVE_VIA_H)) {
    inFlightCount = Math.max(0, inFlightCount - 1);
    Movement.unlock(maid);
    // 下一段 beginStep 会按需 ensureSeek；Gap 期间 pursueRole 已清
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
      pos = isGoal ? feetOf(step.support) : eyeOf(step.support);
    } else {
      // Gap：对岸支撑为途经/终点标记
      isGoal = i === last;
      pos = isGoal ? feetOf(step.edge.to) : eyeOf(step.edge.to);
    }
    const particleId = isGoal ? PARTICLE_GOAL : PARTICLE_VIA;
    try {
      dim.spawnParticle(particleId as never, pos);
    } catch {
      /* 粒子缺失或维度异常时忽略 */
    }
  }
}

function tickAll(): void {
  for (const session of [...sessions.values()]) {
    if (!session.maid.isValid) {
      failSession(session, "maid_invalid");
      continue;
    }
    spawnWaypointParticles(session);
    switch (session.phase) {
      case "FollowAI":
        tickFollowAI(session);
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
  start(maid: Entity, edges: PathEdge[], dest: StandNode): boolean {
    if (!maid.isValid) {
      return false;
    }
    if (edges.length === 0) {
      return true;
    }
    Executor.cancel(maid);
    const steps = buildFollowSteps(edges);
    if (steps.length === 0) {
      return true;
    }
    const seekId = Seek.allocate();
    if (seekId === undefined) {
      Logger.warn(TAG, "start: seek 池满");
      return false;
    }
    // Seek/marker 在首个 AI beginStep 时挂上；若以 Gap 开头则先卸空跑 Prep
    const session: Session = {
      maidId: maid.id,
      maid,
      steps,
      index: 0,
      seekId,
      marker: undefined,
      pursueRole: undefined,
      phase: "Idle",
      phaseAt: now(),
      dest,
    };
    sessions.set(maid.id, session);
    ensureTicker();
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

  activeCount(): number {
    return sessions.size;
  },
};
