/**
 * 路径执行器状态机（Task7 Phase2）。
 * 使用场景：Path.follow；Walk/Jump1/Fall 用 Seek+marker；SprintGap 用冲量。
 *
 * 路点策略：
 * - 连续 Walk 抽稀（步长 VIA_STEP），Jump1/Fall/段尾保留；
 * - 途经路点平视高度 + pursue_via（触及=0）；终点路点脚位 + 默认追逐；
 * - 触及范围内即视为到达（与追逐半径对齐）。
 *
 * Fail：quit + release + free + UnreachableCache（cancel 不写 ban）。
 */
import { Entity, system, Vector3 } from "@minecraft/server";
import { Logger } from "../../controller/Logger";
import { Movement } from "../facets/Movement";
import { Seek } from "../facets/Seek";
import { lookupImpulse } from "./ImpulseTable";
import { PathEdge, StandNode } from "./types";
import { unreachableCache } from "./UnreachableCache";

const TAG = "Path.Executor";

/** 同时处于 InFlight（冲量飞行）的女仆上限 */
export const IN_FLIGHT_MAX = 4;

/**
 * 连续 Walk 抽稀步长：每隔这么多格留一个途经点（段尾必留）。
 * 使用场景：省略原版可走完的中间格，且不超过 follow_range 安全余量。
 */
const VIA_STEP = 8;

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
  /** 当前已挂追逐角色；换角色时才 remountPursue */
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

function clearMarker(session: Session): void {
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
 * 按角色挂 Seek 档 + 对应追逐（途经 via / 终点 default）。
 * 使用场景：beginStep / Gap 落地后恢复。
 */
function mountSeekWithPursue(
  maid: Entity,
  seekId: number,
  role: WaypointRole,
  session?: Session
): boolean {
  if (!Seek.mount(maid, seekId)) {
    return false;
  }
  Seek.mountPursue(maid, pursueEventFor(role));
  if (session) {
    session.pursueRole = role;
  }
  return true;
}

/** 卸追逐 + Seek 档 */
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
  clearMarker(session);
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
  clearMarker(session);
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
      quitSeekWithPursue(maid);
      Seek.resetTarget(maid);
      session.pursueRole = undefined;
    } catch {
      /* ignore */
    }
    return;
  }
  session.phase = "FollowAI";
  const stampPos = step.role === "goal" ? feetOf(step.support) : eyeOf(step.support);
  try {
    const marker = maid.dimension.spawnEntity(
      Seek.MARKER_TYPE as never,
      stampPos
    );
    Seek.stamp(marker, session.seekId);
    const needRemount =
      Seek.getIndex(maid) !== session.seekId ||
      session.pursueRole !== step.role;
    if (needRemount) {
      mountSeekWithPursue(maid, session.seekId, step.role, session);
    }
    // 换路点后强制清恨再索敌（reselect + 新 stamp）
    Seek.resetTarget(maid);
    session.marker = marker;
  } catch (e) {
    failSession(session, `spawn_marker:${String(e)}`);
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
  Movement.lock(maid);
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
  const dx = edge.to.x - edge.from.x;
  const dz = edge.to.z - edge.from.z;
  const dist = Math.max(Math.abs(dx), Math.abs(dz));
  const dy = edge.to.y - edge.from.y;
  const imp = lookupImpulse(dist, dy);
  if (!imp) {
    failSession(session, "no_impulse");
    return;
  }
  const len = Math.sqrt(dx * dx + dz * dz) || 1;
  const vx = (dx / len) * imp.hx;
  const vz = (dz / len) * imp.hx;
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
    // 下一段 beginStep 会按 role 挂追逐；此处先清，避免残留
    session.pursueRole = undefined;
    advance(session);
  }
}

function tickAll(): void {
  for (const session of [...sessions.values()]) {
    if (!session.maid.isValid) {
      failSession(session, "maid_invalid");
      continue;
    }
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
    const firstRole: WaypointRole =
      steps[0].kind === "ai" ? steps[0].role : "via";
    if (!mountSeekWithPursue(maid, seekId, firstRole)) {
      Seek.free(seekId);
      return false;
    }
    const session: Session = {
      maidId: maid.id,
      maid,
      steps,
      index: 0,
      seekId,
      marker: undefined,
      pursueRole: firstRole,
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
