/**
 * 坐垫骑乘高度（mounted_height）换算
 * 与 Java ChairModelInfo / SkinPacksConvertor ChairMountedHeight 对齐
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

/** 实体属性：当前已激活的 seat_h 组件组像素序号 */
export const CHAIR_SEAT_H_PROPERTY = 'thlm:seat_h';

/**
 * 将 mounted_height 规范为可切换的像素序号
 */
export function normalizeMountedHeightPixel(raw?: number): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : DEFAULT_MOUNTED_HEIGHT_PIXEL;
  const y = Math.max(MOUNTED_HEIGHT_Y_MIN, Math.min(MOUNTED_HEIGHT_Y_MAX, (n - 3) * 0.0625));
  return Math.round(y / 0.0625 + 3);
}

/**
 * 像素序号 → rideable 座位 Y（方块）
 */
export function mountedHeightPixelToY(pixel: number): number {
  const p = Math.max(MOUNTED_HEIGHT_PIXEL_MIN, Math.min(MOUNTED_HEIGHT_PIXEL_MAX, pixel));
  return (p - 3) * 0.0625;
}
