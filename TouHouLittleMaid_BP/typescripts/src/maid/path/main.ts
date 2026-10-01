/**
 * 女仆脚本寻路模块入口（Task7）。
 * 使用场景：Path / edges / A* 从本目录扩展；包外可 `from "maid/path/main"`。
 */
export { StandableCache } from "./StandableCache";
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
