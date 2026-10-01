/**
 * 四类路径边生成：Walk / Jump1 / Fall / SprintGap。
 * 使用场景：A* 邻居展开；与执行器共用同一套 Gap 规则（实现计划 §3 / huh §3.2–3.3）。
 *
 * 节点坐标 = 支撑格 (x,y,z)；脚 ≈ y+1，头 ≈ y+2。
 */
import {
  COST_FALL_BASE,
  COST_FALL_PER_Y,
  COST_JUMP1,
  COST_SPRINT_GAP,
  COST_WALK,
  GAP_MAX,
  GAP_MIN,
  MAX_FALL,
} from "./constants";
import { StandableCache } from "./StandableCache";
import { BlockPos, PathEdge, StandNode } from "./types";

/** 四向水平（首版不做对角 Walk/Jump） */
const CARDINAL: ReadonlyArray<Readonly<{ dx: number; dz: number }>> = [
  { dx: 1, dz: 0 },
  { dx: -1, dz: 0 },
  { dx: 0, dz: 1 },
  { dx: 0, dz: -1 },
];

/** Gap 落差优先序：平跳 → 下一格 → 上一格 */
const GAP_DY_ORDER: ReadonlyArray<number> = [0, -1, 1];

/**
 * 边生成选项。
 * 使用场景：Path.find 传入搜索箱 bounds，限制邻居落点。
 */
export type EdgeGenOptions = {
  maxFall?: number;
  gapMin?: number;
  gapMax?: number;
  /** 是否生成 SprintGap；默认 true */
  includeGap?: boolean;
  /** 邻居落点须在箱内（含端点） */
  bounds?: { min: BlockPos; max: BlockPos };
};

function inBounds(p: BlockPos, bounds?: EdgeGenOptions["bounds"]): boolean {
  if (!bounds) {
    return true;
  }
  const { min, max } = bounds;
  return (
    p.x >= min.x &&
    p.x <= max.x &&
    p.y >= min.y &&
    p.y <= max.y &&
    p.z >= min.z &&
    p.z <= max.z
  );
}

function edge(
  kind: PathEdge["kind"],
  from: StandNode,
  to: StandNode,
  cost: number
): PathEdge {
  return {
    kind,
    from: { x: from.x, y: from.y, z: from.z },
    to: { x: to.x, y: to.y, z: to.z },
    cost,
  };
}

/**
 * 身位净空：脚格 + 头格均可穿过且非 hazard。
 * 使用场景：跃上/跃谷轨迹采样（支撑格坐标 → 查 y+1 / y+2）。
 */
function bodyClear(
  cache: StandableCache,
  x: number,
  supportY: number,
  z: number
): boolean {
  const foot = cache.getFlags(x, supportY + 1, z);
  const head = cache.getFlags(x, supportY + 2, z);
  return foot.passable && head.passable && !foot.hazard && !head.hazard;
}

/**
 * 起跳头顶多一格净空（Jump1 / 向上 Gap）。
 * 使用场景：从支撑格 from 向上跳时，y+3 须可过。
 */
function jumpHeadClear(cache: StandableCache, from: StandNode): boolean {
  const above = cache.getFlags(from.x, from.y + 3, from.z);
  return above.passable && !above.hazard;
}

/**
 * 从可站立节点展开全部合法边。
 * 使用场景：A* 每次 pop 当前节点时调用。
 */
export function expandEdges(
  cache: StandableCache,
  from: StandNode,
  options?: EdgeGenOptions
): PathEdge[] {
  const maxFall = options?.maxFall ?? MAX_FALL;
  const gapMin = options?.gapMin ?? GAP_MIN;
  const gapMax = options?.gapMax ?? GAP_MAX;
  const includeGap = options?.includeGap !== false;
  const bounds = options?.bounds;
  const out: PathEdge[] = [];

  for (const { dx, dz } of CARDINAL) {
    // —— Walk：同 y 相邻可站 ——
    {
      const tx = from.x + dx;
      const ty = from.y;
      const tz = from.z + dz;
      if (inBounds({ x: tx, y: ty, z: tz }, bounds)) {
        const to = cache.tryStandNode(tx, ty, tz);
        if (to) {
          out.push(edge("Walk", from, to, COST_WALK));
        }
      }
    }

    // —— Jump1：邻格 y+1，起跳头顶净空 ——
    {
      const tx = from.x + dx;
      const ty = from.y + 1;
      const tz = from.z + dz;
      if (inBounds({ x: tx, y: ty, z: tz }, bounds) && jumpHeadClear(cache, from)) {
        const to = cache.tryStandNode(tx, ty, tz);
        if (to) {
          out.push(edge("Jump1", from, to, COST_JUMP1));
        }
      }
    }

    // —— Fall：邻柱向下 1..maxFall；中间无更近可站踏脚 ——
    for (let drop = 1; drop <= maxFall; drop++) {
      const tx = from.x + dx;
      const ty = from.y - drop;
      const tz = from.z + dz;
      if (!inBounds({ x: tx, y: ty, z: tz }, bounds)) {
        continue;
      }
      let blocked = false;
      for (let d = 1; d < drop; d++) {
        if (cache.isStandableBelow(tx, from.y - d, tz)) {
          blocked = true;
          break;
        }
      }
      if (blocked) {
        continue;
      }
      // 迈出：起点高度邻格身位可过；下落途中身位可过
      if (!bodyClear(cache, tx, from.y, tz)) {
        continue;
      }
      let fallClear = true;
      for (let d = 1; d < drop; d++) {
        if (!bodyClear(cache, tx, from.y - d, tz)) {
          fallClear = false;
          break;
        }
      }
      if (!fallClear) {
        continue;
      }
      const to = cache.tryStandNode(tx, ty, tz);
      if (to) {
        out.push(
          edge("Fall", from, to, COST_FALL_BASE + COST_FALL_PER_Y * drop)
        );
      }
    }

    // —— SprintGap：轴对齐，每方向一条最近合法对岸 ——
    if (includeGap) {
      const gapEdge = findNearestGap(
        cache,
        from,
        dx,
        dz,
        gapMin,
        gapMax,
        bounds
      );
      if (gapEdge) {
        out.push(gapEdge);
      }
    }
  }

  return out;
}

/**
 * 沿单方向找最近合法 SprintGap 对岸。
 * 规则：距∈[gapMin,gapMax]、Δy∈[-1,1]、中间无可站踏脚、轨迹净空；平跳优先。
 */
function findNearestGap(
  cache: StandableCache,
  from: StandNode,
  dx: number,
  dz: number,
  gapMin: number,
  gapMax: number,
  bounds?: EdgeGenOptions["bounds"]
): PathEdge | undefined {
  for (let dist = gapMin; dist <= gapMax; dist++) {
    const tx = from.x + dx * dist;
    const tz = from.z + dz * dist;
    for (const dy of GAP_DY_ORDER) {
      const ty = from.y + dy;
      if (!inBounds({ x: tx, y: ty, z: tz }, bounds)) {
        continue;
      }
      if (!isGapClear(cache, from, tx, ty, tz, dx, dz, dist)) {
        continue;
      }
      const to = cache.tryStandNode(tx, ty, tz);
      if (to) {
        return edge("SprintGap", from, to, COST_SPRINT_GAP);
      }
    }
  }
  return undefined;
}

/**
 * Gap 净空与空谷：中间柱在 [minY,maxY] 无可站；各采样身位可过。
 */
function isGapClear(
  cache: StandableCache,
  from: StandNode,
  tx: number,
  ty: number,
  tz: number,
  dx: number,
  dz: number,
  dist: number
): boolean {
  const yLo = Math.min(from.y, ty);
  const yHi = Math.max(from.y, ty);

  if (ty > from.y && !jumpHeadClear(cache, from)) {
    return false;
  }

  for (let step = 1; step < dist; step++) {
    const ix = from.x + dx * step;
    const iz = from.z + dz * step;
    for (let y = yLo; y <= yHi; y++) {
      if (cache.isStandableBelow(ix, y, iz)) {
        return false;
      }
    }
    if (!bodyClear(cache, ix, from.y, iz)) {
      return false;
    }
    if (ty !== from.y && !bodyClear(cache, ix, ty, iz)) {
      return false;
    }
  }

  return bodyClear(cache, from.x, from.y, from.z);
}
