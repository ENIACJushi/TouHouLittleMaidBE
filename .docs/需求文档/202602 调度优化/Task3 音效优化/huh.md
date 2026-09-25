# 音效优化（202602 Task3）

将音效全权交由脚本播放，为音效包铺路。

**本任务组范围内已完成。** 补齐未接线音效、对齐 Java 条件、音效包与转换器 → 见 [音效优化二期](../../音效优化二期/README.md)（需等其它系统完善后再做）。

## 已完成

- [x] 先整理当前女仆使用的全部音效，包括自动、脚本、json侧。列出所有音效、文件位置及key值 → [女仆音效清单.md](./女仆音效清单.md)
- [x] 脚本侧女仆音效管理器：`MaidSoundType`（string enum）+ `MAID_SOUND_KEYS` 对照表 + `MaidSoundManager.play(maid, type, options?)`
  - 内部实现：`TouHouLittleMaid_BP/typescripts/src/maid/sound/`
  - **包外播音效只能走 facets**：`EntityMaid.Sound.play` / `EntityMaid.Sound.Type`（勿直接 import `maid/sound`）
- [x] 脚本侧全部女仆音效接入 `Sound.play`（idle / attack / feed / tamed / camera / box；Work 经 SOUND_LIS 查表）
- [x] 用 `EntityHurtAfterEvent` / `EntityDieAfterEvent`（`entityTypes: [thlmm:maid]`）取代 `sounds.json` 自动 hurt/death
- [x] JSON 侧环境音效迁脚本 → [JSON侧音效迁移计划.md](./JSON侧音效迁移计划.md)（6 条已迁；背包原版 `pop` 有意保留）
- [x] 确定 SoundDefinitionRegistry.getDefinitions 的机制，决定音效包实现方案
  - 用的是行为包的音效定义，资源包不可用。仍然使用旧方案（落地归二期）
- [x] 确认还没有实现的音效，以及当前音效和 Java 版实际条件的差别，制定改进和实现计划（**仅调研与方案，不落地**）
  - Java 全表 → [Java版女仆音效清单.md](../../音效优化二期/Java版女仆音效清单.md)
  - 缺失 / 条件差 / 分阶段实现 → [Java对照-缺失与条件差异改进计划.md](../../音效优化二期/Java对照-缺失与条件差异改进计划.md)

## 已移交二期

原下列项已迁出本任务组，跟踪见 [音效优化二期/README.md](../../音效优化二期/README.md)：

- 按改进计划落地（HurtPlayer / ItemGet / 模式 ambient / FindTarget 等）
- 音效包 key 加 packId、文件目录防覆盖
- 转换器语音包转换
