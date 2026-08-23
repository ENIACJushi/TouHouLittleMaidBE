/**
 * Touhou Little Maid `maid_chair.json` TypeScript 类型定义与字段分析。
 *
 * 分析对象：坐垫模型包配置文件 `maid_chair.json`，放置于资源域目录：
 * `assets/<namespace>/maid_chair.json`。
 *
 * 与女仆 `maid_model.json` 相对独立，由独立的坐垫转换器（ChairPackConvertor）解析。
 *
 * 实际样例/源码中出现的字段：
 * - 顶层字段：`pack_name`、`model_list`、`author`、`description`、`version`、`date`、`icon`。
 * - 模型字段：`model_id`、`name`、`description`、`model`、`texture`、`extra_textures`、
 *   `animation`、`render_entity_scale`、`mounted_height`、`is_gecko`。
 */

/**
 * Minecraft 资源位置字符串。
 *
 * 推荐写法为 `namespace:path/to/file.ext`。
 * 对文件资源，实际读取路径通常映射到资源包内的 `assets/<namespace>/<path>`。
 */
export type TLMResourceLocation = string;

/**
 * 可直接显示的文本或本地化键。
 *
 * 字符串可使用 `{key.path}` 形式表示本地化键，例如 `{pack.touhou_little_maid.chair.name}`；
 * 普通字符串也可以作为显示文本。
 */
export type TLMI18nText = string;

/**
 * `maid_chair.json` 顶层对象，即一个坐垫模型包。
 */
export interface ChairModelJava {
  /** 作者列表。缺失时变为空数组。GUI 中会按作者列表显示组。 */
  author?: string | string[];
  /** 包显示名。必填。 */
  pack_name: TLMI18nText;
  /** 模型包描述。缺失时变为空数组。GUI 中按行显示，可使用本地化键。 */
  description?: TLMI18nText[];
  /** 模型包图标贴图。缺失时使用空图标。 */
  icon?: TLMResourceLocation;
  /** 模型列表。必填且不能为空。 */
  model_list: TLMChairModelInfo[];
  /** 模型包版本号。源码未对格式做校验，仅在 GUI 详情中显示。 */
  version?: string | null;
  /** 模型包日期。源码未对格式做校验，仅在 GUI 详情中显示。 */
  date?: string | null;
}

/**
 * `model_list[]` 中的单个坐垫模型定义。
 */
export interface TLMChairModelInfo {
  /** 模型唯一 ID。必填。也是模型注册、选择、缓存图标与默认资源路径推导的基础。 */
  model_id: TLMResourceLocation;
  /** 模型显示名。缺失时自动生成 `{model.<namespace>.<path>.name}`。 */
  name?: TLMI18nText;
  /** 模型描述。缺失时为空数组。GUI 中按行显示，可使用本地化键。 */
  description?: TLMI18nText[];
  /** 模型文件路径。缺失时由 `model_id` 推导：`<namespace>:models/entity/<path>.json`。 */
  model?: TLMResourceLocation;
  /** 主贴图路径。缺失时由 `model_id` 推导：`<namespace>:textures/entity/<path>.png`。 */
  texture?: TLMResourceLocation;
  /** 额外贴图列表（暂未处理）。 */
  extra_textures?: TLMResourceLocation[];
  /** 动画资源列表（gecko JSON 动画）。 */
  animation?: TLMResourceLocation[];
  /** 坐垫实体在世界渲染中的整体缩放倍率。缺失默认 `1.0`；解析时会被限制在 `[0.2, 2.0]` 范围内。 */
  render_entity_scale?: number;
  /** 骑乘高度（坐上坐垫后的世界高度）。 */
  mounted_height?: number;
  /** 是否按 GeckoLib 模型/动画加载。`false` 为普通 Bedrock 模型；`true` 为 Gecko geo 模型与 JSON 动画。 */
  is_gecko?: boolean;
}
