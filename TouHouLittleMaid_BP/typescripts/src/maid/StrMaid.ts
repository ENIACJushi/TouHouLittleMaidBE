/**
 * 保持 `from "./StrMaid"` / `from "../maid/StrMaid"` 可解析；
 * 权威实现在 serialize/StrMaid。
 */
export { StrMaid } from "./serialize/StrMaid";
export type { StrMaidHealth, StrMaidSkin } from "./serialize/StrMaid";
