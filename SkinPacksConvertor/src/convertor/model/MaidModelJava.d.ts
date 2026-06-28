/**
 * Touhou Little Maid `maid_model.json` TypeScript 类型定义与字段分析。
 *
 * 分析对象：`touhou_little_maid-1.0.0/assets/.../maid_model.json`。
 * 参考实现：`TouhouLittleMaid-1.20/src/main/java/...`。
 *
 * 关键发现：
 * - 实际样例中出现的顶层字段：`pack_name`、`model_list`、`author`、`description`、`version`、`date`、`icon`。
 * - 1.20 源码额外支持顶层字段：`icon_delay`。
 * - 实际样例中出现的模型字段：`model_id`、`name`、`description`、`model`、`extra_textures`、`animation`、`render_item_scale`、`render_entity_scale`、`show_hata`、`show_backpack`、`show_custom_head`、`can_hold_trolley`、`can_hold_vehicle`、`can_riding_broom`、`is_gecko`、`easter_egg`。
 * - 1.20 源码额外支持模型字段：`texture`、`use_sound_pack_id`。
 * - `pack_name`、`model_list`、`model_id` 是必填字段；`model_list` 还必须是非空数组。
 * - `extra_textures` 会在加载时拆成额外模型条目；额外条目的 `model_id` 为原 `model_id` 加 `_` 与贴图路径 MD5 后缀。
 * - `is_gecko: true` 时走 GeckoLib 模型/动画加载；否则走 Bedrock 模型与 JS 动画加载。
 * - `show_hata`、`can_hold_trolley`、`can_hold_vehicle`、`can_riding_broom` 在 1.20 中仅保留 getter 且标记为 deprecated，未发现实际调用点。
 *
 * 主要参考源码：
 * - `CustomModelPack.java`：包字段、必填校验、默认值、`extra_textures` 拆分。
 * - `MaidModelInfo.java`：模型字段、必填校验、默认值、动画默认逻辑、`render_entity_scale` 限制、彩蛋字段。
 * - `CustomPackLoader.java`：文件夹/zip 加载、模型/贴图/动画注册、彩蛋注册。
 * - `AbstractModelGui.java`：`icon` 与 `icon_delay` 的动态图标渲染。
 * - `MaidModelGui.java`：`use_sound_pack_id` 的切换音效包行为。
 * - `SpecialMaidRenderEvent.java`：`easter_egg` 按女仆自定义名称触发模型替换。
 */

/**
 * Minecraft 资源位置字符串。
 *
 * 推荐写法为 `namespace:path/to/file.ext`。
 * 对文件资源，实际读取路径通常映射到资源包内的 `assets/<namespace>/<path>`。
 * 例如：`touhou_little_maid:textures/maid_icon.png` 会读取
 * `assets/touhou_little_maid/textures/maid_icon.png`。
 */
export type TLMResourceLocation = string;

/**
 * 可直接显示的文本或本地化键。
 *
 * 样例大量使用 `{key.path}` 形式，例如 `{pack.touhou_little_maid.maid.name}`。
 * 这类字符串会在 GUI 中被解析为本地化文本；普通字符串也可以作为显示文本。
 */
export type TLMI18nText = string;

/**
 * `maid_model.json` 顶层对象，即一个女仆模型包。
 *
 * 文件固定名为 `maid_model.json`，放置于资源域目录：
 * `assets/<namespace>/maid_model.json`。
 * 加载器会分别从文件夹型资源包与 zip 型资源包读取该文件。
 */
export interface MaidModelJava {
  /** 【已解析】作者列表。缺失时变为空数组。GUI 中会按作者列表显示，通常每两名作者一组换行。 */
  author?: string | string[];
  /** 【已解析】包显示名。必填 */
  pack_name: TLMI18nText;
  /** 【已解析】模型包描述。缺失时变为空数组。GUI 中按行显示，可使用本地化键。 */
  description?: TLMI18nText[];

  /**
   * 模型列表。必填且不能为空；缺失或空数组会导致解析失败并抛出 `Expected "model_list" in pack`。
   * 每个元素描述一个基础模型；如果元素包含 `extra_textures`，加载后会额外派生出多个同模型不同贴图的条目。
   */
  model_list: TLMMaidModelInfo[];

  /** 模型包版本号。源码未对格式做校验，仅在 GUI 详情中显示。 */
  version?: string | null;

  /** 模型包日期。源码未对格式做校验，仅在 GUI 详情中显示；样例常用 `YYYY-MM-DD`。 */
  date?: string | null;

  /**
   * 模型包图标贴图。缺失时使用空图标。
   * 如果图标图片高大于宽，GUI 会把它视为纵向排列的多帧动态图标：每帧为正方形，帧数约为 `height / width`。
   */
  icon?: TLMResourceLocation;

  /**
   * （基岩版不支持动态图标）
   * 动态图标帧切换延迟，单位约为游戏 GUI tick。缺失默认 `2`；小于或等于 `0` 时会被修正为 `1`。
   * 1.0.0 样例中未出现该字段，但 1.20 源码支持。
   */
  icon_delay?: number;
}

/** `model_list[]` 中的单个女仆模型定义。 */
interface TLMMaidModelInfo {
  /**
   * 模型唯一 ID。必填。缺失会导致解析失败并抛出 `Expected "model_id" in model`。
   * 该 ID 也是模型注册、选择、缓存图标与默认资源路径推导的基础。
   */
  model_id: TLMResourceLocation;
  /**
   * 【已解析】模型显示名。缺失时自动生成 `{model.<namespace>.<path>.name}`，其中 `<namespace>` 和 `<path>` 来自 `model_id`。
   * 如果设置了 `easter_egg`，源码会覆盖该名称：加密彩蛋显示为 `{gui.touhou_little_maid.model_gui.easter_egg.encrypt}`，普通彩蛋显示为 `{gui.touhou_little_maid.model_gui.easter_egg.normal}`。
   */
  name?: TLMI18nText;
  /** 【已解析】模型描述。缺失时为空数组。GUI 中按行显示，可使用本地化键。 */
  description?: TLMI18nText[];
  /**
   * 【已解析】模型文件路径。缺失时由 `model_id` 推导：`<namespace>:models/entity/<path>.json`。
   * `is_gecko: false` 时按 Bedrock 模型 JSON 加载；`is_gecko: true` 时按 GeckoLib geo 模型 JSON 加载。
   */
  model?: TLMResourceLocation;

  /**
   * 主贴图路径。缺失时由 `model_id` 推导：`<namespace>:textures/entity/<path>.png`。
   * 1.0.0 样例中基本依赖默认推导，但 1.20 源码支持显式指定。
   */
  texture?: TLMResourceLocation;

  /**
   * 额外贴图列表。每个额外贴图都会在加载时派生出一个新的模型条目：模型、动画、缩放、显示控制等继承原模型，只替换贴图。
   * 派生模型的 ID 规则为：`<原模型 path>_<md5(额外贴图 path)>`，namespace 仍使用原 `model_id` 的 namespace。
   */
  extra_textures?: TLMResourceLocation[];

  /**
   * 动画资源列表。
   * - 普通 Bedrock 模型（`is_gecko` 为 `false`）使用 JS 动画；缺失或空数组时会自动填充默认女仆 JS 动画列表，包括头部、眨眼、乞求、音乐摇头、腿、手臂、坐下、盔甲、翅膀、尾巴、浮动等默认动画。
   * - Gecko 模型（`is_gecko` 为 `true`）使用 `.json` 动画；缺失或空数组时默认使用 `touhou_little_maid:animation/maid.animation.json`。如果显式提供列表，源码会过滤掉路径不以 `.json` 结尾的项。
   * - Gecko 加载阶段遇到默认 `touhou_little_maid:animation/maid.animation.json` 会停止继续读取后续自定义动画文件；随后默认动画会作为缺省动画合并注册。
   */
  animation?: TLMResourceLocation[];

  /**
   * 切换到该模型时自动使用的音效包 ID。缺失或空白时不改变音效包。
   * GUI 提示中会展示该 ID，确认切换模型时会向服务端发送设置音效包的消息。
   * 1.0.0 样例中未出现该字段，但 1.20 源码支持。
   */
  use_sound_pack_id?: string;

  /** 模型在物品/GUI 预览、模型选择界面缓存图标中的缩放倍率。源码未发现硬性范围限制；缺失默认 `1.0`。 */
  render_item_scale?: number;

  /** 女仆实体在世界渲染中的整体缩放倍率。缺失默认 `1.0`；加载修饰时会被限制在 `[0.2, 2.0]` 范围内。 */
  render_entity_scale?: number;

  /**
   * 是否允许该模型渲染背包/背部展示物品层。为 `false` 时模型层面禁用背部物品显示；实际显示还会受到女仆自身显示配置、睡眠、隐身、CarryOn 等条件影响。
   * 对普通 Bedrock 模型和 Gecko 模型均有渲染层读取。
   */
  show_backpack?: boolean;

  /**
   * 是否允许该模型渲染头部装备/头顶方块等自定义头部层。为 `false` 时跳过该头部附加渲染层。
   * 普通模型要求模型存在 head bone；Gecko 模型要求存在 head bones。
   */
  show_custom_head?: boolean;

  /**
   * 旧版/兼容字段，字段名语义为是否显示 `hata` 相关附加物。
   * 1.20 源码中 getter 标记为 deprecated，未发现实际调用点；保留该字段主要用于旧包兼容。
   * @deprecated 1.20 源码中 getter 标记为 deprecated，未发现实际调用点。
   */
  show_hata?: boolean;

  /**
   * 旧版/兼容字段，字段名语义为模型是否支持手持/承载 trolley 相关表现。
   * 1.20 源码中 getter 标记为 deprecated，未发现实际调用点；保留该字段主要用于旧包兼容。
   * @deprecated 1.20 源码中 getter 标记为 deprecated，未发现实际调用点。
   */
  can_hold_trolley?: boolean;

  /**
   * 旧版/兼容字段，字段名语义为模型是否支持手持/承载 vehicle 相关表现。
   * 1.20 源码中 getter 标记为 deprecated，未发现实际调用点；保留该字段主要用于旧包兼容。
   * @deprecated 1.20 源码中 getter 标记为 deprecated，未发现实际调用点。
   */
  can_hold_vehicle?: boolean;

  /**
   * 旧版/兼容字段，字段名语义为模型是否支持骑扫帚相关表现。
   * 1.20 源码中 getter 标记为 deprecated，未发现实际调用点；保留该字段主要用于旧包兼容。
   * @deprecated 1.20 源码中 getter 标记为 deprecated，未发现实际调用点。
   */
  can_riding_broom?: boolean;

  /**
   * 是否按 GeckoLib 模型加载。`false` 表示普通 Bedrock 模型与 JS 动画；`true` 表示 Gecko geo 模型与 JSON 动画。
   * 开启后 `animation` 默认值、动画文件类型过滤、模型注册流程均不同。
   */
  is_gecko?: boolean;

  /**
   * 彩蛋模型触发配置。存在该对象时，模型不会作为普通可切换模型注册到服务端；客户端会按女仆自定义名称匹配并临时替换渲染模型。
   * 如果 `tag` 为空白，加载器不会注册该彩蛋模型。
   */
  easter_egg?: TLMEasterEgg | null;
}

/**
 * 彩蛋模型配置。
 *
 * 彩蛋触发条件来自女仆的自定义名称：
 * - `encrypt: false`：`tag` 直接等于女仆名称时触发。
 * - `encrypt: true`：对女仆名称做 SHA-1 后，与 `tag` 比较；因此 `tag` 应填写目标名称的 SHA-1 十六进制摘要。
 */
interface TLMEasterEgg {
  /** 彩蛋触发标签。普通彩蛋填写明文名称；加密彩蛋填写目标名称的 SHA-1 十六进制字符串。空字符串不会被注册为可触发彩蛋。 */
  tag?: string;

  /** 是否使用加密匹配。`false` 使用明文 `tag` 匹配女仆名称；`true` 使用 `sha1(女仆名称)` 匹配 `tag`。 */
  encrypt?: boolean;
}
