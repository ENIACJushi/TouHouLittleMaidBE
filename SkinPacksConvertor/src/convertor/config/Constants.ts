
/** 默认动画 id */
export const DEFAULT_ANIMATION_ID = 1;

/**
 * 判定「正在行走」的 walk_process 下限。
 * 对齐 YSM CtrlBinding.MIN_SPEED=0.05：停步后微小速度仍视为静止，继续播 idle。
 */
export const WALK_PROCESS_MOVING_MIN = 0.05;
