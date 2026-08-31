
/** 默认动画 id */
export const DEFAULT_ANIMATION_ID = 1;

/**
 * 判定「正在行走」的 walk_process 阈值。
 * 对齐 YSM CtrlBinding.MIN_SPEED=0.05：停步后微小速度仍视为静止，继续播 idle。
 */
export const WALK_PROCESS_MOVING_MIN = 0.05;

/**
 * 单条 `scripts.pre_animation` molang 的软上限（字符）。
 * 基岩对超长表达式会静默截断/失效；门控赋值与 showCondition 按此拆条。
 */
export const PRE_ANIMATION_MOLANG_MAX_LENGTH = 1000;
