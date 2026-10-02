/**
 * SprintGap 冲量（Task7 Phase0b 表 + Phase 扫测反解）。
 * 使用场景：Executor Impulse。
 *
 * - hy：仍用 Phase0b 九桶（按 plannedDist/dy），有落差时按实际 Δy 微调。
 * - hx：由平地扫测拟合式反解「目标水平射程」。
 * - 瞄准：起点偏近岸（actualH ≤ 格心距）时短瞄防滑出；偏远岸时不短瞄并略过冲，避免连跳欠冲掉沟。
 */
export type ImpulseVec = { hx: number; hy: number };

/** dist∈{2,3,4} × dy∈{-1,0,1} */
export type ImpulseKey = `${2 | 3 | 4}:${-1 | 0 | 1}`;

/** 脚位 / 世界坐标（仅用 x/y/z） */
export type ImpulsePos = { x: number; y: number; z: number };

/**
 * Phase0b 九桶：主要提供 hy；hx 列仅作调试/归档参考，resolve 不再直接用。
 * 使用场景：lookupImpulse / resolveImpulse 取 hy。
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

/**
 * 平地扫测：H ≈ a·hx + b·hy + c·hx·hy + d（H 为水平落点位移）。
 * 使用场景：hxForHorizontalRange / resolveImpulse。
 */
const FIT = {
  a: 3.980481,
  b: 0.232573,
  c: 3.056441,
  d: -0.107157,
} as const;

/** 近岸起跳时相对对岸中心的短瞄（格），防滑出垫外 */
const AIM_SHORT_NEAR = 0.2;
/** 近岸短瞄相对实际距的下限比例 */
const AIM_MIN_RATIO_NEAR = 0.88;
/** 远岸起跳时略过冲（格），补偿拟合误差与连跳偏远 */
const AIM_OVERSHOOT_FAR = 0.08;
/** actualH 相对规划格心距超出此值视为「远侧起跳」 */
const FAR_SIDE_EPS = 0.08;
/** hy 竖直缩放钳制（有 dy 时） */
const HY_SCALE_MIN = 0.55;
const HY_SCALE_MAX = 1.35;
/** 反解 hx 安全钳制（扫测网格约 0.35～0.80） */
const HX_MIN = 0.28;
const HX_MAX = 0.95;

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
export function feetOfSupport(support: {
  x: number;
  y: number;
  z: number;
}): ImpulsePos {
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
export function lookupImpulse(
  dist: number,
  dy: number
): ImpulseVec | undefined {
  const key = toKey(dist, dy);
  if (!key) {
    return undefined;
  }
  return { ...TABLE[key] };
}

/**
 * 由目标水平射程与 hy 反解 hx（平地拟合）。
 * 使用场景：resolveImpulse；诊断。
 */
export function hxForHorizontalRange(targetH: number, hy: number): number {
  const den = FIT.a + FIT.c * hy;
  if (Math.abs(den) < 1e-6) {
    return HX_MIN;
  }
  const hx = (targetH - FIT.b * hy - FIT.d) / den;
  return clamp(hx, HX_MIN, HX_MAX);
}

/**
 * 按精确起终点解析冲量：hy 查桶（可竖直缩放）；hx 按目标水平距反解。
 * @param fromPos 女仆当前脚位（通常 maid.location）
 * @param toSupport 对岸支撑格
 * @param plannedDist 规划边水平跨距（2/3/4），查 hy 桶
 * @param plannedDy 规划边 Δy（-1/0/1）
 * 使用场景：Executor doImpulse。
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
  // 规划格心距（轴对齐跨距 ≈ plannedDist）
  const nominalH = Math.max(Math.round(plannedDist), 1);
  // 至少越过对岸近棱再进垫约 0.25（actualH 指中心，近棱约 actualH-0.5）
  const clearMin = Math.max(actualH - 0.5 + 0.25, 0.5);
  let targetH: number;
  if (actualH > nominalH + FAR_SIDE_EPS) {
    // 远侧起跳：实际更远，禁止再短瞄；略过冲到中心内侧
    targetH = Math.max(actualH + AIM_OVERSHOOT_FAR, clearMin);
  } else {
    // 近侧/格心：短瞄，减轻落到中心后惯性滑出
    targetH = Math.max(
      actualH - AIM_SHORT_NEAR,
      actualH * AIM_MIN_RATIO_NEAR,
      clearMin
    );
  }

  let hy = ref.hy;
  const dy = Math.round(plannedDy);
  if (dy !== 0) {
    const actualV = toFeet.y - fromPos.y;
    const refV = dy;
    if (Math.abs(refV) > 1e-3) {
      const hyScale = clamp(actualV / refV, HY_SCALE_MIN, HY_SCALE_MAX);
      hy = ref.hy * hyScale;
    }
  }

  const hx = hxForHorizontalRange(targetH, hy);
  return { hx, hy };
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
