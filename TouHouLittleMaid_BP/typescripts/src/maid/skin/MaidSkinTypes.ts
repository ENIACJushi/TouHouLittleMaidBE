
/**
 * 皮肤包展示信息
 */
export interface SkinPackDisplayInfo {
  id: number; // id
  name: { translate: string }; // 展示名称
  icon: string; // 图标
  count: number; // 皮肤数量
}

/**
 * 附加皮肤包配置（由转换网站生成，后续可扩展更多字段）
 * 示例：[{"count":20},{"count":10}]
 * 坐垫包可附带 heights（mounted_height 像素列表）：
 * [{"count":2,"heights":[3,15]}]
 */
export interface SkinPackConfig {
  count: number;
  /** 坐垫骑乘高度像素列表（与 count 对齐，可选） */
  heights?: number[];
  [key: string]: unknown;
}
