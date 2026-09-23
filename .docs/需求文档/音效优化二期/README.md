# 二期音效需求

**不在**「202602 调度优化」内执行。完善音效触发条件、补齐未接线音效、音效包与转换器，需等其它系统（如饰品/静音、工作模式注册、跨包通信等）更稳后再做。

## 前置（已在 202602 Task3 完成）

调度优化 Task3 已把女仆语音通道收拢到脚本，并为二期铺路：

| 交付 | 文档 |
|------|------|
| BE 音效通道与清单 | [女仆音效清单.md](../202602%20调度优化/Task3%20音效优化/女仆音效清单.md) |
| JSON 环境迁脚本 | [JSON侧音效迁移计划.md](../202602%20调度优化/Task3%20音效优化/JSON侧音效迁移计划.md) |
| Java 全表 | [Java版女仆音效清单.md](Java版女仆音效清单.md) |
| 缺失 / 条件差 / 分阶段方案 | [Java对照-缺失与条件差异改进计划.md](Java对照-缺失与条件差异改进计划.md) |

实现入口：`EntityMaid.Sound.play` / `MaidSoundType`（`TouHouLittleMaid_BP/typescripts/src/maid/`）。

---

## 待办

### 1. 对齐 Java：补齐与条件改进

按 [改进计划](Java对照-缺失与条件差异改进计划.md) 落地（原 Phase A→B→C）：

- [ ] Phase A：`HurtPlayer` / `ItemGet` 接线（有 OGG、改动可控）
- [ ] Phase B：模式 ambient + `FindTarget`（战斗/工作中周期语音）
- [ ] Phase C：Hurt 火焰分流、Morning/Night 时间窗、开盒 pitch、`idle1` 重复定义等微调

依赖提示：Mute/频率若与饰品栏统一，宜在饰品系统之后再定 mute 矩阵；工作 ambient 表宜在工作模式注册重构后扩展。

### 2. 音效包

- [ ] 为音效包 key 加入 `packId`，音效文件迁到新目录，避免被其它包同路径覆盖
- [ ] （此前结论）`SoundDefinitionRegistry.getDefinitions` 只能读行为包定义，资源包不可用 → 仍走「包提供列表 / 旧方案」一类设计，细节在实现时定

### 3. 转换器

- [ ] 为转换器加入语音包转换功能（对齐 Java `maid_sound.json` + OGG 布局）

---

## 明确不做 / 后置（见改进计划 §6）

- 环境音改回 Java「ambient 内 50% 替换」（保持传感器边沿）
- 无玩法的 `break` / `furnace` / `brewing` 空枚举
- 无频率门的高密度 ambient
- 一次性补齐全部独立 mode OGG（无资源时先 fallback Idle）
