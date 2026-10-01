/**
 * SprintGap 冲量表（Task7 Phase0b / Phase2）。
 * 使用场景：Executor Impulse；缺表时用保守占位，待 path_gap_* 标定后覆盖。
 *
 * 键：(distClass, dy) → 相对起跳方向的冲量分量。
 * hx/hz 为水平合速度标量（沿对岸方向），hy 为竖直。
 */
export type ImpulseVec = { hx: number; hy: number };

/** dist∈{2,3,4} × dy∈{-1,0,1} */
export type ImpulseKey = `${2 | 3 | 4}:${-1 | 0 | 1}`;

/**
 * 保守占位表（未游戏内标定；偏欠水平、略补 hy）。
 * 使用场景：Phase2 先能跑通状态机；Phase0b 用实测替换。
 */
const PLACEHOLDER: Record<ImpulseKey, ImpulseVec> = {
  "2:0": { hx: 0.55, hy: 0.42 },
  "2:1": { hx: 0.52, hy: 0.55 },
  "2:-1": { hx: 0.58, hy: 0.28 },
  "3:0": { hx: 0.72, hy: 0.48 },
  "3:1": { hx: 0.68, hy: 0.62 },
  "3:-1": { hx: 0.75, hy: 0.32 },
  "4:0": { hx: 0.88, hy: 0.52 },
  "4:1": { hx: 0.84, hy: 0.68 },
  "4:-1": { hx: 0.92, hy: 0.35 },
};

/**
 * 查表；非法桶返回 undefined。
 * 使用场景：Executor PrepGap → Impulse。
 */
export function lookupImpulse(dist: number, dy: number): ImpulseVec | undefined {
  const d = Math.round(dist) as 2 | 3 | 4;
  const y = Math.round(dy) as -1 | 0 | 1;
  if (d < 2 || d > 4 || y < -1 || y > 1) {
    return undefined;
  }
  const key = `${d}:${y}` as ImpulseKey;
  return PLACEHOLDER[key];
}

/**
 * 调试覆盖单桶（不持久化）。
 * 使用场景：Phase0b path_gap_try 调参。
 */
export function overrideImpulse(dist: 2 | 3 | 4, dy: -1 | 0 | 1, vec: ImpulseVec): void {
  PLACEHOLDER[`${dist}:${dy}`] = vec;
}
