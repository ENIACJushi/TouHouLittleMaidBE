/**
 * SprintGap 冲量表（Task7 Phase0b / Phase2）。
 * 使用场景：Executor Impulse；值来自 Phase0b 游戏内标定（见归档）。
 *
 * 标定约定：起跳/对岸均为**格心**，水平参考距 = distClass（2/3/4）。
 * 运行时用实际脚位到对岸脚位的水平距，对标定 hx（及有落差时的 hy）做比例缩放。
 */
export type ImpulseVec = { hx: number; hy: number };

/** dist∈{2,3,4} × dy∈{-1,0,1} */
export type ImpulseKey = `${2 | 3 | 4}:${-1 | 0 | 1}`;

/** 脚位 / 世界坐标（仅用 x/y/z） */
export type ImpulsePos = { x: number; y: number; z: number };

/**
 * 运行时冲量表（Phase0b 游戏内标定，单格对岸 + 稳定期无 slip）。
 * 使用场景：lookupImpulse / resolveImpulse。
 */
const TABLE: Record<ImpulseKey, ImpulseVec> = {
  "2:0": { hx: 0.44, hy: 0.42 },
  "2:1": { hx: 0.42, hy: 0.55 },
  "2:-1": { hx: 0.46, hy: 0.28 },
  "3:0": { hx: 0.65, hy: 0.48 },
  "3:1": { hx: 0.55, hy: 0.62 },
  "3:-1": { hx: 0.6, hy: 0.32 },
  "4:0": { hx: 0.7, hy: 0.52 },
  "4:1": { hx: 0.67, hy: 0.68 },
  "4:-1": { hx: 0.74, hy: 0.35 },
};

/** 缩放钳制，避免靠边起跳时冲量过猛/过弱 */
const SCALE_MIN = 0.55;
const SCALE_MAX = 1.35;

function toKey(dist: number, dy: number): ImpulseKey | undefined {
  const d = Math.round(dist) as 2 | 3 | 4;
  const y = Math.round(dy) as -1 | 0 | 1;
  if (d < 2 || d > 4 || y < -1 || y > 1) {
    return undefined;
  }
  return `${d}:${y}`;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function horizDist(a: ImpulsePos, b: ImpulsePos): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * 对岸支撑格顶面脚位（与 Executor feetOf 一致）。
 */
export function feetOfSupport(support: { x: number; y: number; z: number }): ImpulsePos {
  return {
    x: support.x + 0.5,
    y: support.y + 1,
    z: support.z + 0.5,
  };
}

/**
 * 查表；非法桶返回 undefined。
 * 使用场景：标定 / 调试；正式起跳请用 resolveImpulse。
 */
export function lookupImpulse(dist: number, dy: number): ImpulseVec | undefined {
  const key = toKey(dist, dy);
  if (!key) {
    return undefined;
  }
  return { ...TABLE[key] };
}

/**
 * 按实际起跳位置解析冲量：以规划桶标定值为参考，按实际水平距缩放。
 * @param fromPos 女仆当前脚位（通常 maid.location）
 * @param toSupport 对岸支撑格
 * @param plannedDist 规划边水平跨距（2/3/4），作标定参考距与查表键
 * @param plannedDy 规划边 Δy（-1/0/1）
 * 使用场景：Executor doImpulse；连续跳跃时起点未必在格心。
 */
export function resolveImpulse(
  fromPos: ImpulsePos,
  toSupport: { x: number; y: number; z: number },
  plannedDist: number,
  plannedDy: number
): ImpulseVec | undefined {
  const ref = lookupImpulse(plannedDist, plannedDy);
  if (!ref) {
    return undefined;
  }
  const toFeet = feetOfSupport(toSupport);
  const actualH = horizDist(fromPos, toFeet);
  const refH = Math.max(Math.round(plannedDist), 1);
  // 水平：实际距 / 标定距（格心距 ≈ distClass）
  const hxScale = clamp(actualH / refH, SCALE_MIN, SCALE_MAX);

  // 竖直：有规划落差时按实际 Δy 相对 |plannedDy| 微调；平跳保持标定 hy
  let hyScale = 1;
  const dy = Math.round(plannedDy);
  if (dy !== 0) {
    const actualV = toFeet.y - fromPos.y;
    const refV = dy; // 格心到格心竖直差 ≈ dy
    if (Math.abs(refV) > 1e-3) {
      hyScale = clamp(actualV / refV, SCALE_MIN, SCALE_MAX);
    }
  }

  return {
    hx: ref.hx * hxScale,
    hy: ref.hy * hyScale,
  };
}

/**
 * 调试覆盖单桶（不持久化到磁盘；进程内生效）。
 * 使用场景：Phase0b path_gap_set（归档复测）。
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
