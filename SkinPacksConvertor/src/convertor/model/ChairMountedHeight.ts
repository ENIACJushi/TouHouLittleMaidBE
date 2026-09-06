/**
 * 坐垫骑乘高度（mounted_height）换算
 *
 * 与 Java `ChairModelInfo.decorate` / `EntityChair.setMountedHeight` 对齐：
 * - JSON 字段为像素单位；
 * - 游戏内高度 = clamp((mounted_height - 3) * 0.0625, -0.5, 2.5)。
 */

/** 缺省 mounted_height（像素） */
export const DEFAULT_MOUNTED_HEIGHT_PIXEL = 0;

/** 换算后骑乘高度下限（方块） */
export const MOUNTED_HEIGHT_Y_MIN = -0.5;

/** 换算后骑乘高度上限（方块） */
export const MOUNTED_HEIGHT_Y_MAX = 2.5;

/** 对应像素下限（使 y = -0.5） */
export const MOUNTED_HEIGHT_PIXEL_MIN = -5;

/** 对应像素上限（使 y = 2.5） */
export const MOUNTED_HEIGHT_PIXEL_MAX = 43;

/**
 * 将 maid_chair.json 的 mounted_height 规范为可切换的像素序号
 */
export function normalizeMountedHeightPixel(raw?: number): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : DEFAULT_MOUNTED_HEIGHT_PIXEL;
  const y = Math.max(MOUNTED_HEIGHT_Y_MIN, Math.min(MOUNTED_HEIGHT_Y_MAX, (n - 3) * 0.0625));
  return Math.round(y / 0.0625 + 3);
}

/**
 * 像素序号 → 基岩版 rideable 座位 Y（方块）
 */
export function mountedHeightPixelToY(pixel: number): number {
  const p = Math.max(MOUNTED_HEIGHT_PIXEL_MIN, Math.min(MOUNTED_HEIGHT_PIXEL_MAX, pixel));
  return (p - 3) * 0.0625;
}
