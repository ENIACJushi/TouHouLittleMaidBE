/**
 * 女仆模块唯一对外入口。
 *
 * 包外 / 跨模块请只从这里导入，例如：
 *   import { EntityMaid, StrMaid, MainMenu, MaidTarget, MaidEvents } from "../maid/main";
 *
 * 分区一览：
 * - 实体能力（嵌套）：EntityMaid（Owner / Work / Util 等挂在静态属性上）
 * - 实体序列化：EntityMaid.toStr / fromStr / toLore
 * - 字符串编解码：StrMaid（操作 lore / 编码串，非实体）
 * - 事件：MaidEvents
 * - 工作：MaidTarget、WorkHandler
 * - UI：MainMenu、SkinMenu
 * - 皮肤：MaidSkin、类型
 *
 * maid 包内部：可直接引用子目录（facets/work/ui/…），避免经本文件再导出造成环依赖。
 * facets / entityCodec 不经本文件再导出；实体侧统一用 EntityMaid.*。
 */

// ——— 实体能力 ———
export { EntityMaid } from "./EntityMaid";

// ——— 字符串编解码（物品 lore 等；与 EntityMaid 实体域分离） ———
export * from "./serialize/StrMaid";

// ——— 事件 ———
export { MaidEvents } from "./events/MaidEvents";

// ——— 工作 ———
export { MaidTarget } from "./work/MaidTarget";
export type { WorkHandler } from "./work/types";

// ——— UI ———
export { MainMenu, SkinMenu } from "./ui/MaidUI";

// ——— 皮肤 ———
export * from "./skin/MaidSkin";
export * from "./skin/MaidSkinTypes";
