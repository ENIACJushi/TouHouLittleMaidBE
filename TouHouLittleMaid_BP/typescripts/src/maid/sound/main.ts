/**
 * 女仆音效模块导出入口（文件夹桶约定为 main，禁止 index）。
 *
 * **包外禁止直接导入本目录。** 跨模块播音效只能走 facets 门面：
 * `import { EntityMaid } from "../maid/main"` → `EntityMaid.Sound.play(...)` /
 * `EntityMaid.Sound.Type`。本目录仅供 maid 包内部（Sound facet、事件等）使用。
 */
export { MaidSoundType } from "./MaidSoundType";

export {
  MaidSoundManager,
  MAID_SOUND_KEYS,
  MaidSoundPlayOptions,
} from "./MaidSoundManager";
