/**
 * 路径执行器状态机（Task7 Phase2）。
 * 使用场景：Path.follow；Walk/Jump1/Fall 用 Seek+marker；SprintGap 用冲量。
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

const ARRIVE_H = 1.25;
const ARRIVE_V = 1.6;
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
 * 单女仆跟随会话。
 * 使用场景：sessions map；tick 驱动。
 */
type Session = {
  maidId: string;
  /** 启动时实体引用；每 tick 查 isValid */
  maid: Entity;
  edges: PathEdge[];
  index: number;
  seekId: number;
  marker: Entity | undefined;
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

function feetOf(support: StandNode): Vector3 {
  return {
    x: support.x + 0.5,
    y: support.y + 1,
    z: support.z + 0.5,
  };
}

function horizDist(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function nearSupport(maid: Entity, support: StandNode): boolean {
  const target = feetOf(support);
  const loc = maid.location;
  if (horizDist(loc, target) > ARRIVE_H) {
    return false;
  }
  return Math.abs(loc.y - target.y) <= ARRIVE_V;
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

/** 挂 Seek 档 + 默认追逐（脚本分两次，追逐可换实现） */
function mountSeekWithPursue(maid: Entity, seekId: number): boolean {
  if (!Seek.mount(maid, seekId)) {
    return false;
  }
  Seek.mountPursue(maid);
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
  if (session.index >= session.edges.length) {
    succeedSession(session);
    return;
  }
  beginEdge(session);
}

function beginEdge(session: Session): void {
  const maid = session.maid;
  if (!maid.isValid) {
    failSession(session, "maid_invalid");
    return;
  }
  const edge = session.edges[session.index];
  session.phaseAt = now();
  if (edge.kind === "SprintGap") {
    session.phase = "PrepGap";
    try {
      quitSeekWithPursue(maid);
      Seek.resetTarget(maid);
    } catch {
      /* ignore */
    }
    return;
  }
  session.phase = "FollowAI";
  const feet = feetOf(edge.to);
  try {
    const marker = maid.dimension.spawnEntity(
      Seek.MARKER_TYPE as never,
      feet
    );
    Seek.stamp(marker, session.seekId);
    if (Seek.getIndex(maid) !== session.seekId) {
      mountSeekWithPursue(maid, session.seekId);
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
  const edge = session.edges[session.index];
  if (now() - session.phaseAt > AI_EDGE_TIMEOUT_MS) {
    failSession(session, "ai_timeout");
    return;
  }
  if (nearSupport(maid, edge.to)) {
    advance(session);
  }
}

function tickPrepGap(session: Session): void {
  const maid = session.maid;
  const edge = session.edges[session.index];
  if (now() - session.phaseAt > PREP_TIMEOUT_MS) {
    failSession(session, "prep_timeout");
    return;
  }
  if (!nearSupport(maid, edge.from)) {
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
  const edge = session.edges[session.index];
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
  const edge = session.edges[session.index];
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
  if (onGround && nearSupport(maid, edge.to)) {
    inFlightCount = Math.max(0, inFlightCount - 1);
    Movement.unlock(maid);
    try {
      mountSeekWithPursue(maid, session.seekId);
    } catch {
      /* ignore */
    }
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
    const seekId = Seek.allocate();
    if (seekId === undefined) {
      Logger.warn(TAG, "start: seek 池满");
      return false;
    }
    if (!mountSeekWithPursue(maid, seekId)) {
      Seek.free(seekId);
      return false;
    }
    const session: Session = {
      maidId: maid.id,
      maid,
      edges,
      index: 0,
      seekId,
      marker: undefined,
      phase: "Idle",
      phaseAt: now(),
      dest,
    };
    sessions.set(maid.id, session);
    ensureTicker();
    beginEdge(session);
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
