/**
 * EntityMaid.Path 门面（Task7：规划 + 执行）。
 * 使用场景：canReach / find / follow / cancel。
 * 实现委托 maid/path/Path；包外经 EntityMaid.Path 调用。
 */
import { Path as PathImpl } from "../path/Path";

export const Path = PathImpl;
