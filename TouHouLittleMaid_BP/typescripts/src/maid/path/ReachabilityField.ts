/**
 * 方案 C：ROI 多源逆向可达场（按指定 goal 的站立格集合）。
 * 使用场景：农作认领前 `isReachable(maidStand, goal)`；边规则与 expandEdges/A* 一致。
 */
import { Dimension } from "@minecraft/server";
import { ASTAR_MAX_EXPAND, SEARCH_H, SEARCH_V } from "./constants";
import { EdgeGenOptions, expandEdges } from "./edges";
import {
  acquireSharedStandable,
  invalidateSharedStandable,
  sharedStandableKey,
} from "./SharedStandable";
import { clampBoundsToDimension } from "./StandableCache";
import { BlockPos, StandableCacheOptions, StandNode } from "./types";

/** 可达场默认 TTL（毫秒） */
export const REACH_FIELD_TTL_MS = 10_000;
/** 单次建场最多枚举的可站立节点数（防尖刺） */
export const REACH_FIELD_MAX_STANDS = 4_000;

/**
 * ROI 包围盒（支撑格坐标空间）。
 * 使用场景：ensure / invalidate；与 Path 搜索箱对齐。
 */
export type ReachRoi = {
  min: BlockPos;
  max: BlockPos;
};

/**
 * ensure 选项。
 * 使用场景：Farm 扫描后建场；可覆盖 TTL / 边选项。
 */
export type ReachFieldEnsureOptions = StandableCacheOptions &
  EdgeGenOptions & {
    ttlMs?: number;
    maxStands?: number;
    /** 单 goal 逆向 BFS 展开上限 */
    maxExpand?: number;
  };

type FieldRecord = {
  dimId: string;
  min: BlockPos;
  max: BlockPos;
  waterAsHazard: boolean;
  leaseKey: string;
  expires: number;
  /** goalKey → 能到达该 goal 的站立格键集合（含 goal 自身） */
  byGoal: Map<string, Set<string>>;
  /** 逆向邻接构建次数（探针：同 ROI 复用时不应狂涨） */
  buildCount: number;
};

const fields = new Map<string, FieldRecord>();

function nodeKey(n: StandNode): string {
  return `${n.x},${n.y},${n.z}`;
}

/**
 * ROI 场键（不含 goal 列表；goal 存在 byGoal 内增量）。
 */
function fieldKey(
  dimId: string,
  min: BlockPos,
  max: BlockPos,
  waterAsHazard: boolean
): string {
  return sharedStandableKey(dimId, min, max, waterAsHazard);
}

function sweepExpired(now: number): void {
  for (const [k, rec] of fields) {
    if (now > rec.expires) {
      fields.delete(k);
    }
  }
}

/**
 * 以锚点为中心划 ROI 箱（首版划法①）。
 * 使用场景：Farm.search / ensure 默认箱。
 */
export function buildRoiAround(
  anchor: StandNode,
  searchH: number = SEARCH_H,
  searchV: number = SEARCH_V
): ReachRoi {
  return {
    min: {
      x: anchor.x - searchH,
      y: anchor.y - searchV,
      z: anchor.z - searchH,
    },
    max: {
      x: anchor.x + searchH,
      y: anchor.y + searchV,
      z: anchor.z + searchH,
    },
  };
}

/**
 * 枚举箱内可站立支撑格。
 */
function collectStands(
  cache: import("./StandableCache").StandableCache,
  min: BlockPos,
  max: BlockPos,
  maxStands: number
): StandNode[] {
  const out: StandNode[] = [];
  for (let y = min.y; y <= max.y; y++) {
    for (let x = min.x; x <= max.x; x++) {
      for (let z = min.z; z <= max.z; z++) {
        if (cache.isStandableBelow(x, y, z)) {
          out.push({ x, y, z });
          if (out.length >= maxStands) {
            return out;
          }
        }
      }
    }
  }
  return out;
}

/**
 * 正向 expandEdges → 逆向邻接：toKey → fromKey[]。
 * 使用场景：从 goal 反向 BFS 得 R(goal)。
 */
function buildReverseAdj(
  cache: import("./StandableCache").StandableCache,
  stands: StandNode[],
  edgeOpts: EdgeGenOptions
): Map<string, string[]> {
  const rev = new Map<string, string[]>();
  for (const from of stands) {
    const edges = expandEdges(cache, from, edgeOpts);
    const fk = nodeKey(from);
    for (const e of edges) {
      const tk = nodeKey(e.to);
      let list = rev.get(tk);
      if (!list) {
        list = [];
        rev.set(tk, list);
      }
      list.push(fk);
    }
  }
  return rev;
}

/**
 * 从 goal 沿逆向边 BFS，得到能到达 goal 的站立格集合。
 */
function bfsReachable(
  rev: Map<string, string[]>,
  goal: StandNode,
  maxExpand: number
): Set<string> {
  const gKey = nodeKey(goal);
  const R = new Set<string>();
  const q: string[] = [gKey];
  R.add(gKey);
  let expanded = 0;
  while (q.length > 0) {
    const cur = q.pop()!;
    expanded++;
    if (expanded > maxExpand) {
      break;
    }
    const preds = rev.get(cur);
    if (!preds) {
      continue;
    }
    for (const pred of preds) {
      if (!R.has(pred)) {
        R.add(pred);
        q.push(pred);
      }
    }
  }
  return R;
}

/**
 * 确保 ROI 上对给定 goals 建好 R(g)；复用共享 Standable。
 * 使用场景：Farm 扫描后；认领前批量准备。
 * @returns 本场 goal 覆盖数与是否新建/增量
 */
export function ensureReachabilityField(
  dim: Dimension,
  roi: ReachRoi,
  goals: StandNode[],
  options?: ReachFieldEnsureOptions
): {
  key: string;
  goalCount: number;
  rebuilt: boolean;
  standCount: number;
} {
  const now = Date.now();
  sweepExpired(now);
  const waterAsHazard = options?.waterAsHazard !== false;
  const ttlMs = options?.ttlMs ?? REACH_FIELD_TTL_MS;
  const maxStands = options?.maxStands ?? REACH_FIELD_MAX_STANDS;
  const box = clampBoundsToDimension(dim, roi.min, roi.max);
  const key = fieldKey(dim.id, box.min, box.max, waterAsHazard);

  const lease = acquireSharedStandable(dim, box.min, box.max, {
    waterAsHazard,
    ttlMs: Math.min(ttlMs, 5_000),
  });
  try {
    let rec = fields.get(key);
    const needGoals = goals.filter((g) => {
      const gk = nodeKey(g);
      return !rec?.byGoal.has(gk);
    });

    if (rec && now <= rec.expires && needGoals.length === 0) {
      rec.expires = now + ttlMs;
      return {
        key,
        goalCount: rec.byGoal.size,
        rebuilt: false,
        standCount: 0,
      };
    }

    if (!rec || now > rec.expires) {
      rec = {
        dimId: dim.id,
        min: { ...box.min },
        max: { ...box.max },
        waterAsHazard,
        leaseKey: lease.key,
        expires: now + ttlMs,
        byGoal: new Map(),
        buildCount: 0,
      };
      fields.set(key, rec);
    }

    const edgeOpts: EdgeGenOptions = {
      maxFall: options?.maxFall,
      gapMin: options?.gapMin,
      gapMax: options?.gapMax,
      includeGap: options?.includeGap,
      bounds: { min: box.min, max: box.max },
    };

    const stands = collectStands(
      lease.cache,
      box.min,
      box.max,
      maxStands
    );
    const rev = buildReverseAdj(lease.cache, stands, edgeOpts);
    rec.buildCount++;
    rec.expires = now + ttlMs;

    const maxExpand = options?.maxExpand ?? ASTAR_MAX_EXPAND * 2;
    const toBuild = needGoals.length > 0 ? needGoals : goals;
    // 整场过期时 needGoals 可能为空但 byGoal 已空：对全部 goals 重建
    const list =
      rec.byGoal.size === 0 && goals.length > 0 ? goals : toBuild;

    for (const g of list) {
      if (
        g.x < box.min.x ||
        g.x > box.max.x ||
        g.y < box.min.y ||
        g.y > box.max.y ||
        g.z < box.min.z ||
        g.z > box.max.z
      ) {
        continue;
      }
      if (!lease.cache.isStandableBelow(g.x, g.y, g.z)) {
        continue;
      }
      rec.byGoal.set(nodeKey(g), bfsReachable(rev, g, maxExpand));
    }

    return {
      key,
      goalCount: rec.byGoal.size,
      rebuilt: true,
      standCount: stands.length,
    };
  } finally {
    lease.release();
  }
}

/**
 * 查询站立格是否能到达指定 goal。
 * @returns true/false；无场或 goal 未收录时返回 undefined（调用方回退 A*）
 */
export function isReachableInField(
  dimId: string,
  stand: StandNode,
  goal: StandNode
): boolean | undefined {
  const now = Date.now();
  sweepExpired(now);
  const sKey = nodeKey(stand);
  const gKey = nodeKey(goal);
  for (const rec of fields.values()) {
    if (rec.dimId !== dimId || now > rec.expires) {
      continue;
    }
    const set = rec.byGoal.get(gKey);
    if (!set) {
      continue;
    }
    // goal 在该 ROI 场内
    if (
      stand.x < rec.min.x ||
      stand.x > rec.max.x ||
      stand.y < rec.min.y ||
      stand.y > rec.max.y ||
      stand.z < rec.min.z ||
      stand.z > rec.max.z
    ) {
      // 起点在箱外：本场不能断言，继续看其它场
      continue;
    }
    return set.has(sKey);
  }
  return undefined;
}

/**
 * 使 ROI / 整维可达场失效，并连带丢弃重叠的共享 Standable。
 * 使用场景：地形变化；显式刷新。
 */
export function invalidateReachabilityField(
  dimId: string,
  roi?: ReachRoi
): void {
  if (!roi) {
    for (const [k, rec] of fields) {
      if (rec.dimId === dimId) {
        fields.delete(k);
      }
    }
    invalidateSharedStandable(dimId);
    return;
  }
  for (const [k, rec] of fields) {
    if (rec.dimId !== dimId) {
      continue;
    }
    const overlap =
      rec.min.x <= roi.max.x &&
      rec.max.x >= roi.min.x &&
      rec.min.y <= roi.max.y &&
      rec.max.y >= roi.min.y &&
      rec.min.z <= roi.max.z &&
      rec.max.z >= roi.min.z;
    if (overlap) {
      fields.delete(k);
    }
  }
  invalidateSharedStandable(dimId, roi.min, roi.max);
}

/**
 * 仅丢掉某个 goal 的 R(g)；若无剩余 goal 则删整场。
 * 使用场景：Path.follow Fail 到该终点。
 */
export function invalidateReachabilityGoal(
  dimId: string,
  goal: StandNode
): void {
  const gKey = nodeKey(goal);
  for (const [k, rec] of fields) {
    if (rec.dimId !== dimId) {
      continue;
    }
    if (rec.byGoal.delete(gKey) && rec.byGoal.size === 0) {
      fields.delete(k);
    }
  }
}

/**
 * 调试快照。
 * 使用场景：验收两女仆同 ROI 只建一场。
 */
export function reachabilityFieldStats(): {
  fields: number;
  totalGoals: number;
  totalBuildCount: number;
} {
  let totalGoals = 0;
  let totalBuildCount = 0;
  for (const rec of fields.values()) {
    totalGoals += rec.byGoal.size;
    totalBuildCount += rec.buildCount;
  }
  return { fields: fields.size, totalGoals, totalBuildCount };
}

/** 测试用清空 */
export function clearReachabilityFieldForTest(): void {
  fields.clear();
}
