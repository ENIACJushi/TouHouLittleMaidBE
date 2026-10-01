/**
 * Task7 寻路图常量（首版）。
 * 使用场景：edges / A* / canReach；与实现计划 §3 对齐。
 */

/** 农作搜索水平半径（格） */
export const SEARCH_H = 16;
/** 农作搜索竖直半高（格） */
export const SEARCH_V = 4;

/** Fall 最大下落格数 */
export const MAX_FALL = 3;

/** SprintGap 水平跨距（格，含端点间距） */
export const GAP_MIN = 2;
export const GAP_MAX = 4;

/** 边代价 */
export const COST_WALK = 1;
export const COST_JUMP1 = 1.3;
/** Fall：基础 + 每下落 1 格 */
export const COST_FALL_BASE = 1;
export const COST_FALL_PER_Y = 0.3;
export const COST_SPRINT_GAP = 7;

/** A* 展开 / 耗时上限 */
export const ASTAR_MAX_EXPAND = 2000;
/**
 * A* 墙钟上限（ms）。勿过小：部分平台 Date.now 粒度≈15ms，8ms 会误超时。
 * 使用场景：单次 find；农作可再收紧或分帧。
 */
export const ASTAR_MAX_MS = 50;
