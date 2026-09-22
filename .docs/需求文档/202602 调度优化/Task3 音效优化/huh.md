# 音效优化

将音效全权交由脚本播放，为音效包铺路。任务：
- [x] 先整理当前女仆使用的全部音效，包括自动、脚本、json侧。列出所有音效、文件位置及key值 → [女仆音效清单.md](./女仆音效清单.md)
- [x] 脚本侧女仆音效管理器：`MaidSoundType`（string enum）+ `MAID_SOUND_KEYS` 对照表 + `MaidSoundManager.play(maid, type, options?)`
  - 内部实现：`TouHouLittleMaid_BP/typescripts/src/maid/sound/`
  - **包外播音效只能走 facets**：`EntityMaid.Sound.play` / `EntityMaid.Sound.Type`（勿直接 import `maid/sound`）
- [x] 脚本侧全部女仆音效接入 `Sound.play`（idle / attack / feed / tamed / camera / box；Work 经 SOUND_LIS 查表）
- [x] 用 `EntityHurtAfterEvent` / `EntityDieAfterEvent`（`entityTypes: [thlmm:maid]`）取代 `sounds.json` 自动 hurt/death
- [] 确定 SoundDefinitionRegistry.getDefinitions 的机制，决定音效包实现方案。若这个函数可以获取导入的音效包的音效，则音效包只需要提供packId即可，不需要提供音效列表
- [] 为音效包key值加入 packId，并将音效文件
