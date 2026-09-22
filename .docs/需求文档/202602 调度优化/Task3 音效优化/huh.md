# 音效优化

将音效全权交由脚本播放，为音效包铺路。任务：
- [x] 先整理当前女仆使用的全部音效，包括自动、脚本、json侧。列出所有音效、文件位置及key值 → [女仆音效清单.md](./女仆音效清单.md)
- [x] 脚本侧女仆音效管理器：`MaidSoundType`（string enum）+ `MAID_SOUND_KEYS` 对照表 + `MaidSoundManager.play(maid, type, options?)`
  - 内部实现：`TouHouLittleMaid_BP/typescripts/src/maid/sound/`
  - **包外播音效只能走 facets**：`EntityMaid.Sound.play` / `EntityMaid.Sound.Type`（勿直接 import `maid/sound`）
- [] 根据列出的所有音效，决定下一步（迁 JSON 环境音、修 attack key、接未播类型等）
- [] 为音效包key值加入 packId，并将音效文件
