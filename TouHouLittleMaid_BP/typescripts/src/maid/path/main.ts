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
export type { PathFindOptions, PathFollowOptions } from "./Path";
export { Executor, IN_FLIGHT_MAX } from "./Executor";
export type { ExecutorStartOptions } from "./Executor";
export { setReachVizEnabled } from "./ReachViz";
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
export {
  MAID_COLLISION_RADIUS,
  SEEK_PURSUE_REACH_MULTIPLIER,
  ARRIVE_GOAL_R,
  ARRIVE_VIA_R,
  ARRIVE_REACH_R,
  ARRIVE_LOOK_HALF_DEG,
  withinReachDistance,
  withinLookCone,
  checkScriptArrive,
} from "./Arrive";
export {
  PATHMOV_CRUISE_VXZ,
  PATHMOV_DEF_MOVEMENT,
  CRUISE_PER_MOVEMENT,
  PLAYER_JUMP_HY,
  SCRIPT_DECEL_H,
  JUMP1_PLANNED_DIST,
  JUMP1_PLANNED_DY,
  JUMP1_MIN_TARGET_H,
  JUMP1_ALONG_MIN_FACTOR,
  JUMP1_ALONG_MAX_FACTOR,
  defaultDriveParams,
  readDefMovement,
  faceOnce,
  enterScriptProxy,
  restoreMaidMovement,
  tickWalkDrive,
  inJump1Window,
  applyJump1Impulse,
} from "./ScriptDrive";
export type {
  CardinalDir,
  DriveParams,
  Jump1ImpulseInfo,
} from "./ScriptDrive";
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
  isHazard,
  isNavMismatch,
  isPassable,
  isStandableAt,
  isSunkSupport,
  isSupport,
  toBlockView,
} from "./blockPredicates";
export type { BlockView, PredicateContext } from "./blockPredicates";
export type {
  BlockFlags,
  BlockPos,
  PathEdge,
  PathEdgeKind,
  PathFollowCompleteInfo,
  PathFollowCompleteReason,
  PathResult,
  StandableCacheOptions,
  StandNode,
} from "./types";
