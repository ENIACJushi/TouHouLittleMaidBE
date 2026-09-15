/**
 * 女仆模块对外导出入口。
 * 优先 facets / serialize / events；兼容门面与旧路径 shim 见根目录再导出文件。
 *
 * 允许的根目录薄再导出（非业务实现）：
 * - EntityMaid.ts → compat/EntityMaid
 * - MaidTarget.ts → work/*
 *
 * UI 权威路径：ui/MaidUI（经本 main 再导出 MainMenu/SkinMenu）
 * StrMaid 权威路径：serialize/StrMaid（也可经本 main 再导出）
 */

// 基础层
export * from "./facets/main";
export * from "./serialize/StrMaid";
export * from "./serialize/entityCodec";

// 事件唯一入口
export { MaidEvents } from "./events/MaidEvents";

// 兼容门面（包外旧调用面）
export { EntityMaid } from "./compat/EntityMaid";

// 工作 / UI（新代码可直接从此入口取）
export { MaidTarget } from "./work/MaidTarget";
export type { WorkHandler } from "./work/types";
export { MainMenu, SkinMenu } from "./ui/MaidUI";

// 皮肤注册（已有能力，保留）
export * from "./skin/MaidSkin";
export * from "./skin/MaidSkinTypes";
