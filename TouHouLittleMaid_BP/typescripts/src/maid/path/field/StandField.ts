/**
 * 共享落脚点表和可达场。
 * 使用场景：反复寻路的工作共用这一份。耕地认领只比场编号，出发再沿可逆邻居找路。
 *
 * 维度 → 区块 → 坐标直查。叶子只记能不能站（在表里就表示能站）、可逆邻居、场编号。
 * 场牌只有可认领或暂停。建区块、合并、删边探测、出发找路各用各的一拍上限。
 */
import { Dimension, system } from "@minecraft/server";
import { StandableCache } from "../StandableCache";
import {
  COST_FALL_BASE,
  COST_FALL_PER_Y,
  COST_JUMP1,
  COST_SPRINT_GAP,
  COST_WALK,
  COST_WALK_DIAG,
} from "../constants";
import { BlockPos, PathEdge, PathResult, StandNode } from "../types";
import {
  FIELD_BUILD_NODES_PER_TICK,
  FIELD_CHUNK_IDLE_MS,
  FIELD_FIND_EXPAND_PER_TICK,
  FIELD_MERGE_WRITES_PER_TICK,
  FIELD_PROBE_VISITS_PER_TICK,
} from "./budgets";
import { ReversibleKind, ReversibleStep, reversibleSteps } from "./reversibleSteps";

/** 区块边长（格） */
const CHUNK = 16;

/**
 * 认领时两点的关系。
 * same：场牌可认领且编号相同。
 * different：两边都已建完，但不是同一场，或目标不能站。
 * unready：要用的那一层还没建完。
 * paused：场牌暂停，这场先不选，别的场还可以选。
 */
export type FieldClaim = "same" | "different" | "unready" | "paused";

/** 出发找路的三种结果 */
export type FieldFindResult =
  | { kind: "path"; nodes: StandNode[] }
  | { kind: "unreachable" }
  | { kind: "unknown" };

/** 调试或认领时看某一格现在的场 */
export type FieldLeafView = {
  x: number;
  y: number;
  z: number;
  fieldId: number;
  claimable: boolean;
  steps: ReversibleStep[];
};

type Leaf = {
  x: number;
  y: number;
  z: number;
  fieldId: number;
  steps: ReversibleStep[];
};

type Plaque = {
  /** 可认领。暂停或这块还没建完时为 false */
  claimable: boolean;
  /** 合并、探测未完成时加一，挡住认领 */
  busy: number;
  /** 还没建完的区块键。建完才允许新场被认领 */
  blocked: Set<string>;
  nodes: Set<string>;
};

type ChunkRec = {
  nodes: Map<string, Leaf>;
  /** 已经整层扫完的支撑高度 */
  scannedY: Set<number>;
  /** 还要扫的支撑高度 */
  pendingY: number[];
  /** 正在扫的那一层的游标 */
  cursor?: { y: number; x: number; z: number };
  lastUsed: number;
  /** 这块没建完之前，这些新场不能认领 */
  blockingFields: Set<number>;
  originX: number;
  originZ: number;
};

/** 把小场编号改成大场编号，一拍写不完就接着写 */
type WriteJob = {
  toId: number;
  keys: string[];
  /** 写完后尝试恢复的场 */
  release: number[];
};

type ProbeSide = {
  queue: string[];
  seen: Set<string>;
};

/** 从断边两端沿邻居看两边还能不能走到一起 */
type ProbeJob = {
  fieldId: number;
  a: ProbeSide;
  b: ProbeSide;
};

type DimRec = {
  chunks: Map<string, ChunkRec>;
  plaques: Map<number, Plaque>;
  nextId: number;
  writes: WriteJob[];
  probes: ProbeJob[];
  /** 同一拍同一个落脚点只重读一次 */
  reread: Set<string>;
  buildLeft: number;
  mergeLeft: number;
  probeLeft: number;
};

const dims = new Map<string, DimRec>();
/** 本游戏拍已经清过预算。同一拍里的第二次调用不能把额度清零重来 */
let budgetTick = -1;

function posKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

function samePos(a: BlockPos, b: BlockPos): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

function stepPosKey(step: BlockPos): string {
  return posKey(step.x, step.y, step.z);
}

function chunkCoords(x: number, z: number): { cx: number; cz: number } {
  return { cx: Math.floor(x / CHUNK), cz: Math.floor(z / CHUNK) };
}

function chunkMapKey(x: number, z: number): string {
  const { cx, cz } = chunkCoords(x, z);
  return `${cx},${cz}`;
}

function freshDim(): DimRec {
  return {
    chunks: new Map(),
    plaques: new Map(),
    nextId: 1,
    writes: [],
    probes: [],
    reread: new Set(),
    buildLeft: FIELD_BUILD_NODES_PER_TICK,
    mergeLeft: FIELD_MERGE_WRITES_PER_TICK,
    probeLeft: FIELD_PROBE_VISITS_PER_TICK,
  };
}

function dimOf(dim: Dimension): DimRec {
  let rec = dims.get(dim.id);
  if (!rec) {
    rec = freshDim();
    dims.set(dim.id, rec);
  }
  return rec;
}

function resetBudgets(rec: DimRec): void {
  rec.reread.clear();
  rec.buildLeft = FIELD_BUILD_NODES_PER_TICK;
  rec.mergeLeft = FIELD_MERGE_WRITES_PER_TICK;
  rec.probeLeft = FIELD_PROBE_VISITS_PER_TICK;
}

/**
 * 新的一拍才重置四份上限。同一拍里重复进入不会把已经用掉的额度补回来。
 * 使用场景：游戏拍开始，以及外部第一次碰到这张表。
 */
export function refreshFieldBudgets(): void {
  const tick = system.currentTick;
  if (tick === budgetTick) {
    return;
  }
  budgetTick = tick;
  for (const rec of dims.values()) {
    resetBudgets(rec);
  }
}

function yInWorld(dim: Dimension, y: number): boolean {
  try {
    const hr = dim.heightRange;
    return y >= hr.min && y <= hr.max - 1;
  } catch {
    return y >= -64 && y <= 319;
  }
}

function ensureChunk(rec: DimRec, x: number, z: number): ChunkRec {
  const key = chunkMapKey(x, z);
  let chunk = rec.chunks.get(key);
  if (!chunk) {
    const { cx, cz } = chunkCoords(x, z);
    chunk = {
      nodes: new Map(),
      scannedY: new Set(),
      pendingY: [],
      lastUsed: Date.now(),
      blockingFields: new Set(),
      originX: cx * CHUNK,
      originZ: cz * CHUNK,
    };
    rec.chunks.set(key, chunk);
  }
  return chunk;
}

function plaqueOf(rec: DimRec, id: number): Plaque {
  let plaque = rec.plaques.get(id);
  if (!plaque) {
    plaque = {
      claimable: false,
      busy: 0,
      blocked: new Set(),
      nodes: new Set(),
    };
    rec.plaques.set(id, plaque);
  }
  return plaque;
}

function refreshClaim(rec: DimRec, id: number): void {
  const plaque = rec.plaques.get(id);
  if (!plaque) {
    return;
  }
  plaque.claimable =
    plaque.busy === 0 && plaque.blocked.size === 0 && plaque.nodes.size > 0;
}

/**
 * 场牌是否暂停，只看当前还在进行的合并和探测。
 * 使用场景：任务入队、做完、作废之后，避免忙闲计数对不上。
 */
function syncBusy(rec: DimRec): void {
  const busy = new Set<number>();
  for (const job of rec.writes) {
    for (const id of job.release) {
      busy.add(id);
    }
  }
  for (const job of rec.probes) {
    busy.add(job.fieldId);
  }
  for (const [id, plaque] of rec.plaques) {
    plaque.busy = busy.has(id) ? 1 : 0;
    refreshClaim(rec, id);
  }
}

function findLeaf(rec: DimRec, x: number, y: number, z: number): Leaf | undefined {
  const chunk = rec.chunks.get(chunkMapKey(x, z));
  return chunk?.nodes.get(posKey(x, y, z));
}

function reverseKind(kind: ReversibleKind): ReversibleKind {
  if (kind === "Jump1") {
    return "Fall1";
  }
  if (kind === "Fall1") {
    return "Jump1";
  }
  return kind;
}

/**
 * 把叶子的邻居换成 next，并让对方记下反向的那一跳。
 * 使用场景：新建落脚点，以及重读后邻居有变化。
 */
function setSteps(rec: DimRec, leaf: Leaf, next: ReversibleStep[]): void {
  const self = posKey(leaf.x, leaf.y, leaf.z);
  for (const old of leaf.steps) {
    const other = findLeaf(rec, old.x, old.y, old.z);
    if (!other) {
      continue;
    }
    other.steps = other.steps.filter((step) => stepPosKey(step) !== self);
  }
  leaf.steps = next;
  for (const step of next) {
    const other = findLeaf(rec, step.x, step.y, step.z);
    if (!other) {
      continue;
    }
    const back = reverseKind(step.kind);
    const exists = other.steps.some(
      (item) => stepPosKey(item) === self && item.kind === back
    );
    if (!exists) {
      other.steps.push({ x: leaf.x, y: leaf.y, z: leaf.z, kind: back });
    }
  }
}

function dropJobs(rec: DimRec, fieldId: number): void {
  rec.writes = rec.writes.filter(
    (job) => job.toId !== fieldId && job.release.indexOf(fieldId) < 0
  );
  rec.probes = rec.probes.filter((job) => job.fieldId !== fieldId);
}

function allocField(rec: DimRec, chunk: ChunkRec, chunkKey: string): number {
  const id = rec.nextId;
  rec.nextId += 1;
  const plaque = plaqueOf(rec, id);
  plaque.blocked.add(chunkKey);
  chunk.blockingFields.add(id);
  plaque.claimable = false;
  return id;
}

function largerField(rec: DimRec, a: number, b: number): number {
  const sa = rec.plaques.get(a)?.nodes.size ?? 0;
  const sb = rec.plaques.get(b)?.nodes.size ?? 0;
  if (sa > sb) {
    return a;
  }
  if (sb > sa) {
    return b;
  }
  return Math.min(a, b);
}

function scheduleMerge(rec: DimRec, fromId: number, toId: number): void {
  if (fromId === toId) {
    return;
  }
  const from = rec.plaques.get(fromId);
  const to = rec.plaques.get(toId);
  if (!from || !to || from.nodes.size === 0) {
    return;
  }
  rec.writes.push({
    toId,
    keys: [...from.nodes],
    release: [fromId, toId],
  });
  syncBusy(rec);
}

function scheduleRecolor(rec: DimRec, fieldId: number, keys: string[]): void {
  if (keys.length === 0) {
    return;
  }
  const newId = rec.nextId;
  rec.nextId += 1;
  plaqueOf(rec, newId);
  rec.writes.push({
    toId: newId,
    keys,
    release: [fieldId, newId],
  });
  syncBusy(rec);
}

function startProbe(rec: DimRec, fieldId: number, aKey: string, bKey: string): void {
  if (aKey === bKey || !rec.plaques.has(fieldId)) {
    return;
  }
  dropJobs(rec, fieldId);
  rec.probes = rec.probes.filter((job) => job.fieldId !== fieldId);
  rec.probes.push({
    fieldId,
    a: { queue: [aKey], seen: new Set([aKey]) },
    b: { queue: [bKey], seen: new Set([bKey]) },
  });
  syncBusy(rec);
}

function stepsToExisting(rec: DimRec, cache: StandableCache, leaf: Leaf): ReversibleStep[] {
  const raw = reversibleSteps(cache, leaf);
  const out: ReversibleStep[] = [];
  for (const step of raw) {
    if (findLeaf(rec, step.x, step.y, step.z)) {
      out.push(step);
    }
  }
  return out;
}

function stepSetKey(step: ReversibleStep): string {
  return `${step.x},${step.y},${step.z},${step.kind}`;
}

/**
 * 重读这一格能不能站，以及可逆邻居（含斜向平走；跨沟仍只沿正方向）。
 * 使用场景：出发找路扩展到这个落脚点时。认领不调用。
 */
function rereadLeaf(dim: Dimension, rec: DimRec, leaf: Leaf): void {
  const key = posKey(leaf.x, leaf.y, leaf.z);
  if (rec.reread.has(key)) {
    return;
  }
  rec.reread.add(key);
  const cache = new StandableCache(dim);
  const stand = cache.tryStandNode(leaf.x, leaf.y, leaf.z);
  if (!stand) {
    removeLeaf(rec, leaf, true);
    return;
  }
  const next = stepsToExisting(rec, cache, leaf);
  const oldKeys = new Set(leaf.steps.map(stepSetKey));
  const nextKeys = new Set(next.map(stepSetKey));
  let added = false;
  let removed = false;
  for (const item of nextKeys) {
    if (!oldKeys.has(item)) {
      added = true;
    }
  }
  const removedSteps: ReversibleStep[] = [];
  for (const step of leaf.steps) {
    if (!nextKeys.has(stepSetKey(step))) {
      removed = true;
      removedSteps.push(step);
    }
  }
  if (!added && !removed) {
    return;
  }
  setSteps(rec, leaf, next);
  if (removed) {
    const other = removedSteps
      .map((step) => findLeaf(rec, step.x, step.y, step.z))
      .find((item) => item && item.fieldId === leaf.fieldId);
    if (other) {
      startProbe(rec, leaf.fieldId, key, posKey(other.x, other.y, other.z));
    }
    return;
  }
  for (const step of next) {
    if (oldKeys.has(stepSetKey(step))) {
      continue;
    }
    const other = findLeaf(rec, step.x, step.y, step.z);
    if (!other || other.fieldId === leaf.fieldId) {
      continue;
    }
    const keep = largerField(rec, leaf.fieldId, other.fieldId);
    const drop = keep === leaf.fieldId ? other.fieldId : leaf.fieldId;
    scheduleMerge(rec, drop, keep);
  }
}

/**
 * 落脚点消失。邻居因此少了一条步，按删边探测处理。
 * 使用场景：重读发现踏脚没了；区块丢掉时清掉块内的点。
 */
function removeLeaf(rec: DimRec, leaf: Leaf, probe: boolean): void {
  const key = posKey(leaf.x, leaf.y, leaf.z);
  const neighbors = leaf.steps
    .map((step) => findLeaf(rec, step.x, step.y, step.z))
    .filter((item): item is Leaf => !!item);
  setSteps(rec, leaf, []);
  const chunk = rec.chunks.get(chunkMapKey(leaf.x, leaf.z));
  chunk?.nodes.delete(key);
  const plaque = rec.plaques.get(leaf.fieldId);
  plaque?.nodes.delete(key);
  if (plaque && plaque.nodes.size === 0) {
    rec.plaques.delete(leaf.fieldId);
    dropJobs(rec, leaf.fieldId);
    syncBusy(rec);
    return;
  }
  const same = neighbors.filter((item) => item.fieldId === leaf.fieldId);
  if (probe && same.length >= 2) {
    startProbe(
      rec,
      leaf.fieldId,
      posKey(same[0].x, same[0].y, same[0].z),
      posKey(same[1].x, same[1].y, same[1].z)
    );
    return;
  }
  syncBusy(rec);
}

function createLeaf(
  dim: Dimension,
  rec: DimRec,
  chunk: ChunkRec,
  chunkKey: string,
  x: number,
  y: number,
  z: number,
  cache: StandableCache
): boolean {
  const key = posKey(x, y, z);
  if (chunk.nodes.has(key)) {
    return false;
  }
  // 脚会陷进上一格（耕地）时，支撑是上一格，不是这块土。
  if (cache.isSunkSupportBlock(x, y + 1, z)) {
    return false;
  }
  if (!cache.tryStandNode(x, y, z)) {
    return false;
  }
  const leaf: Leaf = { x, y, z, fieldId: 0, steps: [] };
  chunk.nodes.set(key, leaf);
  const steps = stepsToExisting(rec, cache, leaf);
  const fieldIds: number[] = [];
  for (const step of steps) {
    const other = findLeaf(rec, step.x, step.y, step.z);
    if (!other) {
      continue;
    }
    if (fieldIds.indexOf(other.fieldId) < 0) {
      fieldIds.push(other.fieldId);
    }
  }
  let fieldId: number;
  if (fieldIds.length === 0) {
    fieldId = allocField(rec, chunk, chunkKey);
  } else if (fieldIds.length === 1) {
    fieldId = fieldIds[0];
  } else {
    fieldId = fieldIds[0];
    for (const id of fieldIds) {
      fieldId = largerField(rec, fieldId, id);
    }
    for (const id of fieldIds) {
      if (id !== fieldId) {
        scheduleMerge(rec, id, fieldId);
      }
    }
  }
  leaf.fieldId = fieldId;
  plaqueOf(rec, fieldId).nodes.add(key);
  setSteps(rec, leaf, steps);
  refreshClaim(rec, fieldId);
  return true;
}

function finishChunkLayer(rec: DimRec, chunk: ChunkRec, chunkKey: string): void {
  for (const id of chunk.blockingFields) {
    const plaque = rec.plaques.get(id);
    if (!plaque) {
      continue;
    }
    plaque.blocked.delete(chunkKey);
    refreshClaim(rec, id);
  }
  chunk.blockingFields.clear();
  void chunkKey;
}

function scanChunk(dim: Dimension, rec: DimRec, chunk: ChunkRec): void {
  const chunkKey = `${chunk.originX / CHUNK},${chunk.originZ / CHUNK}`;
  const cache = new StandableCache(dim);
  let guard = CHUNK * CHUNK * Math.max(1, chunk.pendingY.length);
  while (guard > 0 && chunk.pendingY.length > 0 && rec.buildLeft > 0) {
    guard -= 1;
    const y = chunk.pendingY[0];
    if (!chunk.cursor || chunk.cursor.y !== y) {
      chunk.cursor = { y, x: chunk.originX, z: chunk.originZ };
    }
    const { x, z } = chunk.cursor;
    if (createLeaf(dim, rec, chunk, chunkKey, x, y, z, cache)) {
      rec.buildLeft -= 1;
    }
    chunk.cursor.z += 1;
    if (chunk.cursor.z >= chunk.originZ + CHUNK) {
      chunk.cursor.z = chunk.originZ;
      chunk.cursor.x += 1;
    }
    if (chunk.cursor.x >= chunk.originX + CHUNK) {
      chunk.scannedY.add(y);
      chunk.pendingY.shift();
      chunk.cursor = undefined;
      if (chunk.pendingY.length === 0) {
        finishChunkLayer(rec, chunk, chunkKey);
      }
    }
    chunk.lastUsed = Date.now();
  }
}

function requestLayers(dim: Dimension, rec: DimRec, x: number, y: number, z: number): void {
  const chunk = ensureChunk(rec, x, z);
  chunk.lastUsed = Date.now();
  for (const yy of [y - 1, y, y + 1]) {
    if (!yInWorld(dim, yy)) {
      continue;
    }
    if (chunk.scannedY.has(yy) || chunk.pendingY.indexOf(yy) >= 0) {
      continue;
    }
    chunk.pendingY.push(yy);
  }
  scanChunk(dim, rec, chunk);
}

function continueBuilds(dim: Dimension, rec: DimRec): void {
  for (const chunk of rec.chunks.values()) {
    if (chunk.pendingY.length === 0 || rec.buildLeft <= 0) {
      continue;
    }
    scanChunk(dim, rec, chunk);
  }
}

function runWrites(rec: DimRec): void {
  const job = rec.writes[0];
  if (!job || rec.mergeLeft <= 0) {
    return;
  }
  while (job.keys.length > 0 && rec.mergeLeft > 0) {
    const key = job.keys.pop();
    rec.mergeLeft -= 1;
    if (!key) {
      continue;
    }
    const parts = key.split(",");
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    const z = Number(parts[2]);
    const leaf = findLeaf(rec, x, y, z);
    if (!leaf || leaf.fieldId === job.toId) {
      continue;
    }
    const from = rec.plaques.get(leaf.fieldId);
    from?.nodes.delete(key);
    leaf.fieldId = job.toId;
    plaqueOf(rec, job.toId).nodes.add(key);
  }
  if (job.keys.length === 0) {
    rec.writes.shift();
    syncBusy(rec);
  }
}

function expandSide(
  rec: DimRec,
  fieldId: number,
  side: ProbeSide,
  other: ProbeSide
): "meet" | "walk" | "empty" {
  if (side.queue.length === 0) {
    return "empty";
  }
  const key = side.queue.shift();
  if (!key) {
    return "empty";
  }
  const parts = key.split(",");
  const leaf = findLeaf(rec, Number(parts[0]), Number(parts[1]), Number(parts[2]));
  if (!leaf || leaf.fieldId !== fieldId) {
    return "walk";
  }
  for (const step of leaf.steps) {
    const next = stepPosKey(step);
    if (other.seen.has(next)) {
      return "meet";
    }
    const otherLeaf = findLeaf(rec, step.x, step.y, step.z);
    if (!otherLeaf || otherLeaf.fieldId !== fieldId) {
      continue;
    }
    if (!side.seen.has(next)) {
      side.seen.add(next);
      side.queue.push(next);
    }
  }
  return "walk";
}

function runProbes(rec: DimRec): void {
  const job = rec.probes[0];
  if (!job || rec.probeLeft <= 0) {
    return;
  }
  while (rec.probeLeft > 0) {
    if (job.a.queue.length === 0 && job.b.queue.length === 0) {
      break;
    }
    if (job.a.queue.length > 0) {
      rec.probeLeft -= 1;
      const result = expandSide(rec, job.fieldId, job.a, job.b);
      if (result === "meet") {
        rec.probes.shift();
        syncBusy(rec);
        return;
      }
    }
    if (rec.probeLeft <= 0) {
      return;
    }
    if (job.b.queue.length > 0) {
      rec.probeLeft -= 1;
      const result = expandSide(rec, job.fieldId, job.b, job.a);
      if (result === "meet") {
        rec.probes.shift();
        syncBusy(rec);
        return;
      }
    }
    if (job.a.queue.length === 0 && job.b.seen.size > 0 && job.b.queue.length > 0) {
      rec.probes.shift();
      scheduleRecolor(rec, job.fieldId, [...job.a.seen]);
      return;
    }
    if (job.b.queue.length === 0 && job.a.seen.size > 0 && job.a.queue.length > 0) {
      rec.probes.shift();
      scheduleRecolor(rec, job.fieldId, [...job.b.seen]);
      return;
    }
    if (job.a.queue.length === 0 && job.b.queue.length === 0) {
      rec.probes.shift();
      const small = job.a.seen.size <= job.b.seen.size ? job.a.seen : job.b.seen;
      scheduleRecolor(rec, job.fieldId, [...small]);
      return;
    }
  }
}

function chunkOverlapsCircle(
  chunk: ChunkRec,
  circle: { minX: number; maxX: number; minZ: number; maxZ: number }
): boolean {
  const maxX = chunk.originX + CHUNK - 1;
  const maxZ = chunk.originZ + CHUNK - 1;
  return !(
    maxX < circle.minX ||
    chunk.originX > circle.maxX ||
    maxZ < circle.minZ ||
    chunk.originZ > circle.maxZ
  );
}

/**
 * 静置够久、并且不落在任何女仆活动圈里的区块，整块丢掉。
 * 使用场景：每拍维护。块外因此断掉的步走删边探测。
 */
function discardIdle(
  rec: DimRec,
  circles: ReadonlyArray<{
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  }>
): void {
  const now = Date.now();
  const drop: string[] = [];
  for (const [key, chunk] of rec.chunks) {
    if (now - chunk.lastUsed < FIELD_CHUNK_IDLE_MS) {
      continue;
    }
    let covered = false;
    for (const circle of circles) {
      if (chunkOverlapsCircle(chunk, circle)) {
        covered = true;
        break;
      }
    }
    if (!covered) {
      drop.push(key);
    }
  }
  for (const key of drop) {
    const chunk = rec.chunks.get(key);
    if (!chunk) {
      continue;
    }
    const boundary = new Map<number, string[]>();
    const leaves = [...chunk.nodes.values()];
    for (const leaf of leaves) {
      for (const step of leaf.steps) {
        const other = findLeaf(rec, step.x, step.y, step.z);
        if (!other || chunk.nodes.has(posKey(other.x, other.y, other.z))) {
          continue;
        }
        const list = boundary.get(other.fieldId) ?? [];
        const otherKey = posKey(other.x, other.y, other.z);
        if (list.indexOf(otherKey) < 0) {
          list.push(otherKey);
        }
        boundary.set(other.fieldId, list);
      }
    }
    for (const leaf of leaves) {
      removeLeaf(rec, leaf, false);
    }
    rec.chunks.delete(key);
    for (const [fieldId, keys] of boundary) {
      if (keys.length >= 2 && rec.plaques.has(fieldId)) {
        startProbe(rec, fieldId, keys[0], keys[1]);
      }
    }
  }
}

function leafView(rec: DimRec, leaf: Leaf): FieldLeafView {
  const plaque = rec.plaques.get(leaf.fieldId);
  return {
    x: leaf.x,
    y: leaf.y,
    z: leaf.z,
    fieldId: leaf.fieldId,
    claimable: plaque?.claimable === true,
    steps: leaf.steps.map((step) => ({ ...step })),
  };
}

/**
 * 用到这一格时才建它所在区块的相邻三层高度。
 * 使用场景：调试命令、以后的出发找路。预算用尽就停，下一拍继续。
 */
export function ensureStandHeight(dim: Dimension, x: number, y: number, z: number): void {
  refreshFieldBudgets();
  const rec = dimOf(dim);
  requestLayers(dim, rec, Math.floor(x), Math.floor(y), Math.floor(z));
}

/**
 * 只读已经写下的场编号和场牌，不重读方块。
 * 使用场景：认领。人在空中、水里、沟里时脚下没有叶子，返回 undefined。
 */
export function peekStandField(
  dim: Dimension,
  x: number,
  y: number,
  z: number
): FieldLeafView | undefined {
  const rec = dims.get(dim.id);
  if (!rec) {
    return undefined;
  }
  const leaf = findLeaf(rec, Math.floor(x), Math.floor(y), Math.floor(z));
  if (!leaf) {
    return undefined;
  }
  const chunk = rec.chunks.get(chunkMapKey(leaf.x, leaf.z));
  if (chunk) {
    chunk.lastUsed = Date.now();
  }
  return leafView(rec, leaf);
}

/**
 * 两点场牌都可认领且编号相同。
 * 使用场景：以后认领目标。不沿路重读，也不把路找出来。
 */
export function sameClaimableField(
  dim: Dimension,
  a: BlockPos,
  b: BlockPos
): boolean {
  return classifyFieldClaim(dim, a, b) === "same";
}

/**
 * 这一层是否已经扫完。没扫完不能把「还没有叶子」当成走不到。
 * 使用场景：classifyFieldClaim。
 */
function layerReady(rec: DimRec, x: number, y: number, z: number): boolean {
  const chunk = rec.chunks.get(chunkMapKey(x, z));
  if (!chunk || chunk.pendingY.length > 0) {
    return false;
  }
  return chunk.scannedY.has(y);
}

/**
 * 认领前比较脚下和目标。不沿路重读。
 * 使用场景：耕地选点。unready 这一拍不要改去更远的格。
 */
export function classifyFieldClaim(
  dim: Dimension,
  a: BlockPos,
  b: BlockPos
): FieldClaim {
  const rec = dims.get(dim.id);
  if (!rec) {
    return "unready";
  }
  const ax = Math.floor(a.x);
  const ay = Math.floor(a.y);
  const az = Math.floor(a.z);
  const bx = Math.floor(b.x);
  const by = Math.floor(b.y);
  const bz = Math.floor(b.z);
  if (!layerReady(rec, ax, ay, az) || !layerReady(rec, bx, by, bz)) {
    return "unready";
  }
  const left = findLeaf(rec, ax, ay, az);
  const right = findLeaf(rec, bx, by, bz);
  if (!left || !right) {
    return "different";
  }
  const plaque = rec.plaques.get(left.fieldId);
  if (!plaque?.claimable) {
    return "paused";
  }
  if (left.fieldId !== right.fieldId) {
    return "different";
  }
  return "same";
}

/**
 * 把可逆路上的一步换成执行器认识的边。落下 1 仍写成 Fall。
 * 使用场景：reversiblePathResult。
 */
function edgeFromStep(
  from: StandNode,
  step: ReversibleStep
): PathEdge {
  const to = { x: step.x, y: step.y, z: step.z };
  if (step.kind === "Jump1") {
    return { kind: "Jump1", from, to, cost: COST_JUMP1 };
  }
  if (step.kind === "Fall1") {
    return {
      kind: "Fall",
      from,
      to,
      cost: COST_FALL_BASE + COST_FALL_PER_Y,
    };
  }
  if (step.kind === "SprintGap") {
    return { kind: "SprintGap", from, to, cost: COST_SPRINT_GAP };
  }
  const diagonal =
    Math.abs(to.x - from.x) === 1 && Math.abs(to.z - from.z) === 1;
  return {
    kind: "Walk",
    from,
    to,
    cost: diagonal ? COST_WALK_DIAG : COST_WALK,
  };
}

/**
 * 场编号一致之后，沿可逆邻居找出给执行器走的边。
 * 使用场景：耕地出发。unknown 不写不可达；unreachable 也不拆场。
 */
export function reversiblePathResult(
  dim: Dimension,
  from: StandNode,
  to: StandNode
): PathResult {
  const found = findReversiblePath(dim, from, to);
  if (found.kind === "unknown") {
    return { ok: false, nodes: [], edges: [], reason: "field_unknown" };
  }
  if (found.kind === "unreachable") {
    return { ok: false, nodes: [], edges: [], reason: "field_unreachable" };
  }
  const edges: PathEdge[] = [];
  for (let i = 0; i < found.nodes.length - 1; i++) {
    const cur = found.nodes[i];
    const next = found.nodes[i + 1];
    const view = peekStandField(dim, cur.x, cur.y, cur.z);
    const step = view?.steps.find(
      (item) => item.x === next.x && item.y === next.y && item.z === next.z
    );
    if (!step) {
      return { ok: false, nodes: [], edges: [], reason: "field_unknown" };
    }
    edges.push(edgeFromStep(cur, step));
  }
  return { ok: true, nodes: found.nodes, edges };
}

/**
 * 沿可逆邻居找一条路。这一拍只用出发找路自己的上限。
 * 使用场景：以后出发前。农作尚未改为调用它。
 */
export function findReversiblePath(
  dim: Dimension,
  from: StandNode,
  to: StandNode
): FieldFindResult {
  refreshFieldBudgets();
  const rec = dimOf(dim);
  ensureStandHeight(dim, from.x, from.y, from.z);
  ensureStandHeight(dim, to.x, to.y, to.z);
  let budget = FIELD_FIND_EXPAND_PER_TICK;
  const start = findLeaf(rec, from.x, from.y, from.z);
  const goal = findLeaf(rec, to.x, to.y, to.z);
  const startChunk = rec.chunks.get(chunkMapKey(from.x, from.z));
  const goalChunk = rec.chunks.get(chunkMapKey(to.x, to.z));
  const pending =
    (startChunk?.pendingY.length ?? 0) > 0 || (goalChunk?.pendingY.length ?? 0) > 0;
  if (!start || !goal || pending) {
    return { kind: "unknown" };
  }
  const plaque = rec.plaques.get(start.fieldId);
  if (!plaque?.claimable || start.fieldId !== goal.fieldId) {
    if (!plaque?.claimable) {
      return { kind: "unknown" };
    }
    return { kind: "unreachable" };
  }
  const queue: Leaf[] = [start];
  const prev = new Map<string, string>();
  const seen = new Set<string>([posKey(start.x, start.y, start.z)]);
  let found: Leaf | undefined;
  while (queue.length > 0 && budget > 0) {
    const cur = queue.shift();
    if (!cur) {
      break;
    }
    budget -= 1;
    rereadLeaf(dim, rec, cur);
    const live = findLeaf(rec, cur.x, cur.y, cur.z);
    if (!live || live.fieldId !== goal.fieldId) {
      return { kind: "unknown" };
    }
    const livePlaque = rec.plaques.get(live.fieldId);
    if (!livePlaque?.claimable) {
      return { kind: "unknown" };
    }
    if (samePos(live, goal)) {
      found = live;
      break;
    }
    for (const step of live.steps) {
      const next = findLeaf(rec, step.x, step.y, step.z);
      if (!next || next.fieldId !== live.fieldId) {
        continue;
      }
      const key = posKey(next.x, next.y, next.z);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      prev.set(key, posKey(live.x, live.y, live.z));
      queue.push(next);
    }
  }
  if (!found) {
    return queue.length > 0 ? { kind: "unknown" } : { kind: "unreachable" };
  }
  const nodes: StandNode[] = [];
  let cursor: string | undefined = posKey(found.x, found.y, found.z);
  while (cursor) {
    const parts = cursor.split(",");
    nodes.push({
      x: Number(parts[0]),
      y: Number(parts[1]),
      z: Number(parts[2]),
    });
    cursor = prev.get(cursor);
  }
  nodes.reverse();
  return { kind: "path", nodes };
}

/**
 * 列出这一区块里已经写下的落脚点。
 * 使用场景：path_field 打粒子对照场编号。
 */
export function listChunkFieldNodes(
  dim: Dimension,
  x: number,
  z: number
): FieldLeafView[] {
  const rec = dims.get(dim.id);
  if (!rec) {
    return [];
  }
  const chunk = rec.chunks.get(chunkMapKey(x, z));
  if (!chunk) {
    return [];
  }
  const out: FieldLeafView[] = [];
  for (const leaf of chunk.nodes.values()) {
    out.push(leafView(rec, leaf));
  }
  return out;
}

/**
 * 列出观察者附近已经写下的落脚点。
 * 使用场景：显示路点时刷粒子。不新建落脚点。
 */
export function listStandFieldNear(
  dim: Dimension,
  origin: BlockPos,
  horiz: number,
  vert: number
): FieldLeafView[] {
  const rec = dims.get(dim.id);
  if (!rec) {
    return [];
  }
  const minX = Math.floor(origin.x - horiz);
  const maxX = Math.floor(origin.x + horiz);
  const minY = Math.floor(origin.y - vert);
  const maxY = Math.floor(origin.y + vert);
  const minZ = Math.floor(origin.z - horiz);
  const maxZ = Math.floor(origin.z + horiz);
  const cx0 = Math.floor(minX / CHUNK);
  const cx1 = Math.floor(maxX / CHUNK);
  const cz0 = Math.floor(minZ / CHUNK);
  const cz1 = Math.floor(maxZ / CHUNK);
  const out: FieldLeafView[] = [];
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cz = cz0; cz <= cz1; cz++) {
      const chunk = rec.chunks.get(`${cx},${cz}`);
      if (!chunk) {
        continue;
      }
      for (const leaf of chunk.nodes.values()) {
        if (leaf.x < minX || leaf.x > maxX || leaf.z < minZ || leaf.z > maxZ) {
          continue;
        }
        if (leaf.y < minY || leaf.y > maxY) {
          continue;
        }
        out.push(leafView(rec, leaf));
      }
    }
  }
  return out;
}

/**
 * 每拍继续没做完的建区块、合并和删边探测，并丢掉静置区块。
 * 使用场景：initStandField 挂上的间隔。circles 是这一拍各女仆的活动圈。
 */
export function tickStandField(
  dim: Dimension,
  circles?: ReadonlyArray<{ minX: number; maxX: number; minZ: number; maxZ: number }>
): void {
  refreshFieldBudgets();
  const rec = dimOf(dim);
  continueBuilds(dim, rec);
  runWrites(rec);
  runProbes(rec);
  if (circles) {
    discardIdle(rec, circles);
  }
}

/**
 * 调试：按一拍上限连续做若干拍，方便一次命令看见一块耕地。
 * 使用场景：path_field。正式寻路不要调用。
 */
export function debugPumpStandField(
  dim: Dimension,
  x: number,
  y: number,
  z: number,
  rounds: number
): void {
  const rec = dimOf(dim);
  const times = Math.max(1, Math.min(40, Math.floor(rounds)));
  for (let i = 0; i < times; i++) {
    resetBudgets(rec);
    requestLayers(dim, rec, Math.floor(x), Math.floor(y), Math.floor(z));
    runWrites(rec);
    runProbes(rec);
  }
}
