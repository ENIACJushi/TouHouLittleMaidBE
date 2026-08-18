
/** 默认动画 id */
export const DEFAULT_ANIMATION_ID = 1;

/**
 * 判定「正在行走」的 walk_process 下限。
 * 对齐 YSM CtrlBinding.MIN_SPEED=0.05：停步后微小速度仍视为静止，继续播 idle。
 */
export const WALK_PROCESS_MOVING_MIN = 0.05;

/**
 * 转换得到的动画 id 起始值
 *  为默认动画预留更小的 id 空间（如后续扩展默认 idle/run 等）
 *  常态 100，在生成预置模型包或预置动画时，设为 1
 */
export const CONVERTED_ANIMATION_ID_START = 100;
