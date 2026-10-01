/**
 * 寻路门面：find / canReach（Task7 Phase1）。
 * 使用场景：农作认领前预判；follow 执行见 Phase2。
 *
 * 挂 EntityMaid.Path；核心算法在 AStar + edges + StandableCache。
 */
import { Dimension, Entity, Vector3 } from "@minecraft/server";
import { aStar, AStarOptions } from "./AStar";
import { SEARCH_H, SEARCH_V } from "./constants";
import { Executor } from "./Executor";
import { StandableCache, clampBoundsToDimension } from "./StandableCache";
import { BlockPos, PathResult, StandableCacheOptions, StandNode } from "./types";
import { unreachableCache } from "./UnreachableCache";

/**
 * Path.find / canReach 选项。
 * 使用场景：覆盖搜索箱、A* 上限、水是否危险、是否含 Gap。
 */
export type PathFindOptions = AStarOptions &
  StandableCacheOptions & {
    /** 水平搜索半径；默认 SEARCH_H */
    searchH?: number;
    /** 竖直半高；默认 SEARCH_V */
    searchV?: number;
  };

function floor3(v: Vector3): BlockPos {
  return {
    x: Math.floor(v.x),
    y: Math.floor(v.y),
    z: Math.floor(v.z),
  };
}

/**
 * 脚部位姿 → 支撑格 StandNode；不可站返回 undefined。
 * 使用场景：女仆当前位置作起点。
 */
export function standNodeFromFeet(
  cache: StandableCache,
  feet: Vector3
): StandNode | undefined {
  const f = floor3(feet);
  return cache.tryStandNode(f.x, f.y - 1, f.z);
}

/**
 * 将目标解释为支撑格：先当支撑，再当脚位。
 * 使用场景：canReach(maid, destBlock) 的 dest。
 */
export function standNodeFromDest(
  cache: StandableCache,
  dest: Vector3 | StandNode
): StandNode | undefined {
  const p = {
    x: Math.floor(dest.x),
    y: Math.floor(dest.y),
    z: Math.floor(dest.z),
  };
  const asSupport = cache.tryStandNode(p.x, p.y, p.z);
  if (asSupport) {
    return asSupport;
  }
  return cache.tryStandNode(p.x, p.y - 1, p.z);
}

/**
 * 以起终点为中心并扩展 searchH/V 的轴对齐搜索箱。
 * 使用场景：warmBox + edges bounds。
 */
export function buildSearchBounds(
  start: StandNode,
  goal: StandNode,
  searchH: number,
  searchV: number
): { min: BlockPos; max: BlockPos } {
  const cx0 = Math.min(start.x, goal.x);
  const cx1 = Math.max(start.x, goal.x);
  const cy0 = Math.min(start.y, goal.y);
  const cy1 = Math.max(start.y, goal.y);
  const cz0 = Math.min(start.z, goal.z);
  const cz1 = Math.max(start.z, goal.z);
  return {
    min: {
      x: cx0 - searchH,
      y: cy0 - searchV,
      z: cz0 - searchH,
    },
    max: {
      x: cx1 + searchH,
      y: cy1 + searchV,
      z: cz1 + searchH,
    },
  };
}

function runFind(
  dim: Dimension,
  start: StandNode,
  goal: StandNode,
  options?: PathFindOptions
): PathResult {
  const searchH = options?.searchH ?? SEARCH_H;
  const searchV = options?.searchV ?? SEARCH_V;
  const raw = buildSearchBounds(start, goal, searchH, searchV);
  const bounds = clampBoundsToDimension(dim, raw.min, raw.max);
  if (bounds.min.y > bounds.max.y) {
    return { ok: false, nodes: [], edges: [], reason: "bad_bounds" };
  }

  const cache = new StandableCache(dim, {
    waterAsHazard: options?.waterAsHazard,
  });
  cache.warmBox(bounds.min, bounds.max);

  // warm 后再确认起终点仍可站（与缓存一致）
  if (!cache.isStandableBelow(start.x, start.y, start.z)) {
    return { ok: false, nodes: [], edges: [], reason: "bad_start" };
  }
  if (!cache.isStandableBelow(goal.x, goal.y, goal.z)) {
    return { ok: false, nodes: [], edges: [], reason: "bad_goal" };
  }

  return aStar(cache, start, goal, {
    ...options,
    bounds,
  });
}

/**
 * 脚本寻路公开 API（规划阶段）。
 */
export const Path = {
  /**
   * 在维度内从 start 脚位寻到 dest（支撑或脚位）。
   * 使用场景：调试；生产多用 findFromMaid。
   */
  find(
    dim: Dimension,
    startFeet: Vector3,
    dest: Vector3 | StandNode,
    options?: PathFindOptions
  ): PathResult {
    // 轻量解析起终点（按需 getBlock）；正式搜索在 runFind 内 warm
    const probe = new StandableCache(dim, {
      waterAsHazard: options?.waterAsHazard,
    });
    const start = standNodeFromFeet(probe, startFeet);
    if (!start) {
      return { ok: false, nodes: [], edges: [], reason: "bad_start" };
    }
    const goal = standNodeFromDest(probe, dest);
    if (!goal) {
      return { ok: false, nodes: [], edges: [], reason: "bad_goal" };
    }
    return runFind(dim, start, goal, options);
  },

  /**
   * 以女仆当前位置为起点寻路。
   * 使用场景：农作认领前 / 后续 Path.follow。
   */
  findFromMaid(
    maid: Entity,
    dest: Vector3 | StandNode,
    options?: PathFindOptions
  ): PathResult {
    return Path.find(maid.dimension, maid.location, dest, options);
  },

  /**
   * 是否可达（仅看 PathResult.ok）。
   * 使用场景：认领过滤；与 find 共用规则。
   * 若目标在短时不可达缓存中则直接 false（可 ignoreBan）。
   */
  canReach(
    maid: Entity,
    dest: Vector3 | StandNode,
    options?: PathFindOptions & { ignoreBan?: boolean }
  ): boolean {
    const probe = new StandableCache(maid.dimension, {
      waterAsHazard: options?.waterAsHazard,
    });
    const goal = standNodeFromDest(probe, dest);
    if (!goal) {
      return false;
    }
    if (!options?.ignoreBan && unreachableCache.has(goal, maid.id)) {
      return false;
    }
    return Path.findFromMaid(maid, dest, options).ok;
  },

  /**
   * 已解析起终点的 find。
   * 使用场景：批量检测时复用外部已解析节点。
   */
  findNodes(
    dim: Dimension,
    start: StandNode,
    goal: StandNode,
    options?: PathFindOptions
  ): PathResult {
    return runFind(dim, start, goal, options);
  },

  /**
   * 规划并执行跟随；失败返回规划结果或 follow 启动失败。
   * 使用场景：农作走到目标；Gap 用占位冲量表（待 Phase0b 标定）。
   */
  follow(
    maid: Entity,
    dest: Vector3 | StandNode,
    options?: PathFindOptions
  ): PathResult {
    const result = Path.findFromMaid(maid, dest, options);
    if (!result.ok) {
      return result;
    }
    const goal = result.nodes[result.nodes.length - 1];
    if (!goal) {
      return { ok: false, nodes: [], edges: [], reason: "empty_path" };
    }
    const started = Executor.start(maid, result.edges, goal);
    if (!started) {
      return { ...result, ok: false, reason: "follow_start_fail" };
    }
    return result;
  },

  /**
   * 直接执行已有 PathResult（跳过再规划）。
   * 使用场景：find 后自定义再 follow。
   */
  followResult(maid: Entity, result: PathResult): boolean {
    if (!result.ok || result.nodes.length === 0) {
      return false;
    }
    const goal = result.nodes[result.nodes.length - 1];
    return Executor.start(maid, result.edges, goal);
  },

  /** 取消当前跟随 */
  cancel(maid: Entity): void {
    Executor.cancel(maid);
  },

  /** 是否正在 follow */
  isFollowing(maid: Entity): boolean {
    return Executor.isFollowing(maid);
  },
};
