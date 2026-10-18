/**
 * 落脚点表四件工作各自的一拍上限。
 * 使用场景：StandField 建区块 / 合并编号 / 删边探测 / 出发找路。
 * 不共用。用尽只停这一件。数字是首版规模，要改只改这里。
 */

/** 建区块：一拍最多新建多少个落脚点 */
export const FIELD_BUILD_NODES_PER_TICK = 64;

/** 合并编号：一拍最多把多少个落脚点改成同一个场编号 */
export const FIELD_MERGE_WRITES_PER_TICK = 256;

/** 删边探测：一拍最多沿邻居走过多少个落脚点 */
export const FIELD_PROBE_VISITS_PER_TICK = 128;

/** 出发找路：一名女仆这一拍最多扩展多少个落脚点 */
export const FIELD_FIND_EXPAND_PER_TICK = 256;

/** 区块静置这么久，且不在任何女仆活动圈内，才整块丢掉 */
export const FIELD_CHUNK_IDLE_MS = 60_000;
