/**
 * 女仆脚本寻路模块入口（Task7）。
 * 使用场景：Path / edges / A* 从本目录扩展；包外可经 EntityMaid.Path。
 */
export { StandableCache, clampBoundsToDimension } from "./StandableCache";
export { expandEdges } from "./edges";
export type { EdgeGenOptions } from "./edges";
export { aStar, heuristic } from "./AStar";
export type { AStarOptions } from "./AStar";
export {
  Path,
  buildSearchBounds,
  standNodeFromDest,
  standNodeFromFeet,
} from "./Path";
export type { PathFindOptions } from "./Path";
export { Executor, IN_FLIGHT_MAX } from "./Executor";
export {
  lookupImpulse,
  resolveImpulse,
  feetOfSupport,
  predictHorizontalRange,
  horizontalRangePerHx,
  hxForHorizontalRange,
  overrideImpulse,
  snapshotImpulseTable,
} from "./ImpulseTable";
export type { ImpulseKey, ImpulseVec, ImpulsePos } from "./ImpulseTable";
export { unreachableCache, UnreachableCache, UNREACHABLE_TTL_MS } from "./UnreachableCache";
export {
  ASTAR_MAX_EXPAND,
  ASTAR_MAX_MS,
  COST_FALL_BASE,
  COST_FALL_PER_Y,
  COST_JUMP1,
  COST_SPRINT_GAP,
  COST_WALK,
  GAP_MAX,
  GAP_MIN,
  MAX_FALL,
  SEARCH_H,
  SEARCH_V,
} from "./constants";
export {
  evalBlockFlags,
  isClosedBottomTrapdoor,
  isHazard,
  isNavMismatch,
  isPassable,
  isStandableAt,
  isSupport,
  toBlockView,
} from "./blockPredicates";
export type { BlockView, PredicateContext } from "./blockPredicates";
export type {
  BlockFlags,
  BlockPos,
  PathEdge,
  PathEdgeKind,
  PathResult,
  StandableCacheOptions,
  StandNode,
} from "./types";
