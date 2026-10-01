/**
 * SprintGap 冲量表（Task7 Phase0b / Phase2）。
 * 使用场景：Executor Impulse；值来自 Phase0b 游戏内标定（见归档）。
 *
 * 键：(distClass, dy) → 相对起跳方向的冲量分量。
 * hx 为水平合速度标量（沿对岸方向），hy 为竖直。
 */
export type ImpulseVec = { hx: number; hy: number };

/** dist∈{2,3,4} × dy∈{-1,0,1} */
export type ImpulseKey = `${2 | 3 | 4}:${-1 | 0 | 1}`;

/**
 * 运行时冲量表（Phase0b 游戏内标定，单格对岸 + 稳定期无 slip）。
 * 使用场景：lookupImpulse / Executor SprintGap。
 */
const TABLE: Record<ImpulseKey, ImpulseVec> = {
  "2:0": { hx: 0.55, hy: 0.42 },
  "2:1": { hx: 0.42, hy: 0.55 },
  "2:-1": { hx: 0.46, hy: 0.28 },
  "3:0": { hx: 0.65, hy: 0.48 },
  "3:1": { hx: 0.55, hy: 0.62 },
  "3:-1": { hx: 0.6, hy: 0.32 },
  "4:0": { hx: 0.7, hy: 0.52 },
  "4:1": { hx: 0.67, hy: 0.68 },
  "4:-1": { hx: 0.74, hy: 0.35 },
};

function toKey(dist: number, dy: number): ImpulseKey | undefined {
  const d = Math.round(dist) as 2 | 3 | 4;
  const y = Math.round(dy) as -1 | 0 | 1;
  if (d < 2 || d > 4 || y < -1 || y > 1) {
    return undefined;
  }
  return `${d}:${y}`;
}

/**
 * 查表；非法桶返回 undefined。
 * 使用场景：Executor PrepGap → Impulse。
 */
export function lookupImpulse(dist: number, dy: number): ImpulseVec | undefined {
  const key = toKey(dist, dy);
  if (!key) {
    return undefined;
  }
  return TABLE[key];
}

/**
 * 调试覆盖单桶（不持久化到磁盘；进程内生效）。
 * 使用场景：Phase0b path_gap_set。
 */
export function overrideImpulse(
  dist: 2 | 3 | 4,
  dy: -1 | 0 | 1,
  vec: ImpulseVec
): void {
  TABLE[`${dist}:${dy}`] = { hx: vec.hx, hy: vec.hy };
}

/**
 * 导出当前表快照（只读拷贝）。
 * 使用场景：path_gap_dump / 标定后回写源码。
 */
export function snapshotImpulseTable(): Record<ImpulseKey, ImpulseVec> {
  const out = {} as Record<ImpulseKey, ImpulseVec>;
  for (const k of Object.keys(TABLE) as ImpulseKey[]) {
    out[k] = { ...TABLE[k] };
  }
  return out;
}
