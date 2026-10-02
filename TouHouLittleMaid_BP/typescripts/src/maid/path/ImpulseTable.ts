/**
 * SprintGap 冲量（Task7 Phase0b 表 + Phase 扫测反解）。
 * 使用场景：Executor Impulse。
 *
 * - 目标落点：始终为对岸支撑格**顶面中心**（feetOfSupport）。
 * - hx：按「当前脚位 → 格心」精确水平距反解；拟合语义见 FIT / firstTouchSolveExtra。
 * - hy：Phase0b 九桶（plannedDist/dy），有落差时按实际 Δy 微调。
 * - 首触地补偿：Phase0c FIT 为滑行终点；重扫首触地 FIT 后可去掉 firstTouchSolveExtra。
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
 * 平地扫测：H ≈ a·hx + b·hy + c·hx·hy + d。
 * 注意：Phase0c 记录的是首触地后再等 SETTLE_AFTER(10) tick 的滑行终点，
 * 比 Gap 判定用的「首触地」偏远；反解时需加 firstTouchSolveExtra。
 * 使用场景：hxForHorizontalRange / resolveImpulse。
 */
const FIT = {
  a: 3.980481,
  b: 0.232573,
  c: 3.056441,
  d: -0.107157,
} as const;

/**
 * Phase0c 滑行终点相对 Gap 首触地的偏长（格）。
 * 来源：path_go 连跳实测——平地 3/4≈0.31、平地 2≈0.38、下一格≈0.13。
 * 使用场景：格心距 → FIT 反解射程。
 */
const FIRST_TOUCH_EXTRA_FLAT = 0.31;
/**
 * 短平跨（dist=2）：0.31 欠冲≈0.19、0.50 过冲≈0.30，取插值≈0.38。
 * 使用场景：firstTouchSolveExtra。
 */
const FIRST_TOUCH_EXTRA_FLAT_SHORT = 0.38;
const FIRST_TOUCH_EXTRA_DOWN = 0.13;
/** 上跳暂无独立样本，先与平地同补偿（短跨同 short） */
const FIRST_TOUCH_EXTRA_UP = 0.31;
const FIRST_TOUCH_EXTRA_UP_SHORT = 0.38;

/** hy 竖直缩放钳制（有 dy 时） */
const HY_SCALE_MIN = 0.55;
const HY_SCALE_MAX = 1.35;
/** 反解 hx 安全钳制（扫测网格约 0.35～0.80） */
const HX_MIN = 0.28;
const HX_MAX = 0.95;

/**
 * 把「首触地格心距」换成 FIT 语义下的 settle 射程增量。
 * @param plannedDist 规划水平跨距（2/3/4）
 * @param plannedDy 规划 Δy
 * 使用场景：resolveImpulseEx。
 */
function firstTouchSolveExtra(plannedDist: number, plannedDy: number): number {
  const dy = Math.round(plannedDy);
  const dist = Math.round(plannedDist);
  const short = dist <= 2;
  if (dy < 0) {
    return FIRST_TOUCH_EXTRA_DOWN;
  }
  if (dy > 0) {
    return short ? FIRST_TOUCH_EXTRA_UP_SHORT : FIRST_TOUCH_EXTRA_UP;
  }
  return short ? FIRST_TOUCH_EXTRA_FLAT_SHORT : FIRST_TOUCH_EXTRA_FLAT;
}

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
 * resolveImpulse 诊断明细。
 * 使用场景：Executor Gap 日志 / path_go 分析落点。
 */
export type ImpulseResolveDebug = {
  vec: ImpulseVec;
  from: ImpulsePos;
  /** 目标落点：对岸格顶面中心 */
  toFeet: ImpulsePos;
  /** 起跳格脚位中心（若有 from 支撑）；仅诊断 */
  fromPadFeet?: ImpulsePos;
  /** 起点→格心水平距（首触地瞄准） */
  actualH: number;
  /** 交给 FIT 反解的射程 = actualH + solveExtra */
  targetH: number;
  /** 首触地→Phase0c settle 语义的补偿（格） */
  solveExtra: number;
  plannedDist: number;
  plannedDy: number;
  hyRaw: number;
};

/**
 * 带诊断的冲量解析；失败返回 undefined。
 * 落点瞄准对岸格心；hx 按「格心距 + 首触地/settle 语义差」反解。
 * 使用场景：doImpulse 打 PATHGAP 日志。
 */
export function resolveImpulseEx(
  fromPos: ImpulsePos,
  toSupport: { x: number; y: number; z: number },
  plannedDist: number,
  plannedDy: number,
  fromSupport?: { x: number; y: number; z: number }
): ImpulseResolveDebug | undefined {
  const ref = lookupImpulse(plannedDist, plannedDy);
  if (!ref) {
    return undefined;
  }
  const toFeet = feetOfSupport(toSupport);
  const fromPadFeet = fromSupport
    ? feetOfSupport(fromSupport)
    : undefined;
  const dy = Math.round(plannedDy);
  // 瞄准格心；FIT 是 settle 射程，加 firstTouch 补偿后再反解
  const actualH = horizDist(fromPos, toFeet);
  const solveExtra = firstTouchSolveExtra(plannedDist, dy);
  const targetH = Math.max(actualH + solveExtra, 0.5);

  let hy = ref.hy;
  if (dy !== 0) {
    const actualV = toFeet.y - fromPos.y;
    const refV = dy;
    if (Math.abs(refV) > 1e-3) {
      const hyScale = clamp(actualV / refV, HY_SCALE_MIN, HY_SCALE_MAX);
      hy = ref.hy * hyScale;
    }
  }

  const hx = hxForHorizontalRange(targetH, hy);
  return {
    vec: { hx, hy },
    from: { x: fromPos.x, y: fromPos.y, z: fromPos.z },
    toFeet,
    fromPadFeet,
    actualH,
    targetH,
    solveExtra,
    plannedDist: Math.round(plannedDist),
    plannedDy: dy,
    hyRaw: ref.hy,
  };
}

/**
 * 按精确起终点解析冲量：目标为对岸格心；hy 查桶；hx 反解。
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
  return resolveImpulseEx(fromPos, toSupport, plannedDist, plannedDy)?.vec;
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
