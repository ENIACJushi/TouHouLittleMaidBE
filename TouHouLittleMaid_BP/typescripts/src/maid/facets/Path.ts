/**
 * EntityMaid.Path 门面（Task7 Phase1：规划）。
 * 使用场景：canReach / find；follow 待 Phase2。
 * 实现委托 maid/path/Path；包外经 EntityMaid.Path 调用。
 */
import { Path as PathImpl } from "../path/Path";

export const Path = PathImpl;
