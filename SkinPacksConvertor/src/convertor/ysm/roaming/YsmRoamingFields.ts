/**
 * YSM 配饰变量字段名工具。
 *
 * Java 端常用嵌套 `v.roaming.xxx`；基岩对嵌套变量赋值不稳定，
 * 转换期一律展平为 `v.ysm_roaming_xxx`（字段名不含 `v.` 前缀时为 `ysm_roaming_xxx`）。
 */

/** 叶子名 → 扁平字段名。例：`fumo` → `ysm_roaming_fumo` */
export const toFlatYsmRoamingField = (roamingLeaf: string): string => {
  return `ysm_roaming_${roamingLeaf.toLowerCase()}`;
};

/**
 * 将 `roaming.xxx` 或裸叶子 `xxx` 规范为扁平 keep 字段名。
 * 例：`roaming.fumo` / `fumo` → `ysm_roaming_fumo`。
 */
export const toYsmRoamingKeepField = (roamingPathOrLeaf: string): string => {
  const raw = roamingPathOrLeaf.toLowerCase().replace(/^roaming\./, '');
  return toFlatYsmRoamingField(raw);
};
