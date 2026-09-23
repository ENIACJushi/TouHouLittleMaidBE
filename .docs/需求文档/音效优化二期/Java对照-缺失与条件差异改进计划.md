# Java 对照：缺失音效与条件差异 — 改进与实现计划

> **执行归属**：方案产出属 202602 Task3；**落地不在「202602 调度优化」内**，跟踪见 [音效优化二期](./README.md)。完善音效与音效包需等其它系统就绪后再做。

对照：[Java版女仆音效清单.md](Java版女仆音效清单.md)  
基岩现状：[女仆音效清单.md](../202602%20调度优化/Task3%20音效优化/女仆音效清单.md)  
工程：`TouHouLittleMaid_BP`（脚本）+ `TouHouLittleMaid_RP`（定义/OGG）

目标：列出 BE **尚未实现** 的 Java 女仆音效，以及 **已实现但触发条件不同** 的项，并给出分阶段实现计划（优先可落地、对齐体感）。

---

## 1. 结论速览

| 类别 | 数量级 | 说明 |
|------|--------|------|
| BE 已接线且体感接近 | 约 10 | Death / Tamed / Camera / Box；环境 6 音（机制不同）；Attack/Feed（仅切模式） |
| BE 有定义/枚举但未接线 | 4 | `FindTarget` / `HurtPlayer` / `ItemGet` / `Credit` |
| BE 无定义、Java 有注册 | 多 | 工作模式细分、hurt_fire、game_win/lost、ai_chat 等 |
| 条件差异大（同名不同行为） | 核心 | Idle / 环境 / Attack·Feed / Hurt |

基岩当前播放入口统一为 `EntityMaid.Sound.play` → `MaidSoundManager`；mute 仅约束 **Idle + 环境**。

---

## 2. 对照总表

图例：✅ 已实现 · ⚠ 已实现但条件有差 · ❌ 未实现 · ◐ 仅注册/仅资源 · — 不适用

### 2.1 女仆语音

| Java ID | BE `MaidSoundType` / key | 状态 | 差异摘要 |
|---------|--------------------------|------|----------|
| `maid.mode.idle` | `Idle` / `mob.thlmm.maid.idle` | ⚠ | Java：ambient ~4s + 50% 可被环境替换；BE：定时器约 33s + 0–100 tick 延迟，**仅 idle，不叠环境** |
| `maid.mode.attack` | `Attack` | ⚠ | Java：战斗模式 ambient + 50% find_target；BE：**仅 `Work.set` 切模式瞬间** |
| `maid.mode.danmaku_attack` | 复用 `Attack` | ⚠ | Java：独立事件 + 音效包文件；BE：与近战同 key，且仅切模式 |
| `maid.mode.range_attack` | — | ❌ | BE 有 `ranged_attack` 模式索引，无独立音效；字幕有遗留 |
| `maid.mode.farm` / shears / milk / snow / torch / feed_animal / extinguishing | — | ❌ | Java 为各任务 ambient；BE `SOUND_LIS` 对应位为 `undefined` |
| `maid.mode.feed` | `Feed` | ⚠ | Java：喂主人 ambient + env 0.3；BE：切 `feed`/`feed_animal` 瞬间；`feed_animal` 在 Java 是独立 mode 音 |
| `maid.mode.break` / furnace / brewing | — | ◐ | Java 仅注册无任务；BE 无需跟进，除非音效包兼容 |
| `maid.environment.*`（6） | Hot/Cold/Rain/Snow/Morning/Night | ⚠ | 见 §3.2 |
| `maid.ai.find_target` | `FindTarget`（有 OGG） | ❌ | Java：战斗 ambient 50%；BE：无调用 |
| `maid.ai.hurt` | `Hurt` | ⚠ | BE 一律 Hurt；无 fire / player 分流 |
| `maid.ai.hurt_fire` | — | ❌ | 无 enum / 无定义 / 无文件 |
| `maid.ai.hurt_player` | `HurtPlayer`（有 OGG） | ❌ | Java：玩家伤 + 120 tick 冷却；BE 未用 |
| `maid.ai.item_get` | `ItemGet`（有 OGG） | ❌ | Java：每 5 次拾取；BE 未接（备忘：需冷却） |
| `maid.ai.tamed` | `Tamed` | ✅≈ | 双方驯服成功播；BE 另有 `disable_tamed` 反序列化抑制 |
| `maid.ai.death` | `Death` | ✅≈ | 双方死亡播；mute 策略略不同（Java 可经事件取消） |
| `maid.ai.game_win` / `game_lost` | — | ❌ | BE 棋类若未做或未接线则无 |
| `maid.credit` | `Credit`（有 OGG） | ❌ | Java：音效包 GUI 试听；BE 无音效包 UI |
| `maid.ai_chat` | — | ❌ | TTS；BE 无对应能力时后置 |

### 2.2 相关非语音（顺带）

| Java ID | BE | 状态 |
|---------|-----|------|
| `item.camera_use` | `CameraUse` / `thlm.camera_use` | ✅ |
| `entity.box` | `Box` / `thlm.box` | ✅≈（pitch 阶段差可后置） |
| `block.altar_craft` | `altar_craft` | ✅（非 MaidSoundType） |
| `item.compass` | 有 `point.ogg` 孤儿 | ❌ 未接线 |
| `block.gomoku*` / fairy / recording | — | ❌ 随功能再定 |

---

## 3. 条件差异详解（已实现项）

### 3.1 Idle

| | Java | 基岩 |
|--|------|------|
| 节拍 | Ambient 间隔 80 tick（~4s） | heal 定时器 3s 一步，`step % 11 === 0` → ~33s |
| 内容 | 常为 idle，**50% 机会**被环境音替换（钓鱼除外） | **只播 idle**；环境另走传感器 |
| mute | Mute 饰品取消 `MaidPlaySoundEvent` | DP `mute` 跳过播放 |
| 额外 | 客户端全局/单女仆频率再随机丢弃 | 播前再随机延迟 0–100 tick |

**体感**：BE 闲聊更稀、与环境解耦；Java 更密且「边干活边抱怨天气」。

### 3.2 环境六音

| | Java | 基岩 |
|--|------|------|
| 触发模型 | 嵌在 ambient 里，带概率 `p`（多为 0.5） | `environment_sensor` 状态变化 → `thlmm:e*` → 脚本（**边沿触发、无随机**） |
| Morning / Night | 仅清晨/傍晚 **3 小时窗口** | `is_daytime` 真/假整段昼夜（白天一整段只在切入时播一次） |
| Rain / Snow | 下雨 + 群系降水类型 | 温和/海洋 + 降水 → Rain；寒冷 + 降水 → Snow |
| Cold / Hot | biome 温度 API | `is_temperature_type` cold / warm |
| 与 mode 关系 | 可替代当前工作 ambient | 与模式音独立 |

**体感**：BE 更像「进了热天/下雨了说一句」；Java 更像「闲聊时偶尔提到天气/早晚」。

### 3.3 Attack / Feed（模式音）

| | Java | 基岩 |
|--|------|------|
| 时机 | 该任务下持续 ambient | **仅 `Work.set` 切换瞬间** |
| Attack 变体 | find_target 50% 混入 | 无 |
| Danmaku / Range | 独立 SoundEvent（包内可不同 OGG） | 弹幕复用 Attack；远程无音 |
| Feed | ambient + env 0.3 | 切 feed / feed_animal 播 Feed |

### 3.4 Hurt

| | Java | 基岩 |
|--|------|------|
| 普通伤 | `hurt` | `Hurt` |
| 火焰 | `hurt_fire`（无文件时复用 hurt 缓冲） | 仍 `Hurt` |
| 玩家打女仆 | `hurt_player`，120 tick 冷却 | 仍 `Hurt`（`HurtPlayer` 未用） |
| 治疗 | — | `damage <= 0` 不播 |

### 3.5 Tamed / Death / Camera / Box

差异较小：驯服、死亡、拍照、开盒均有对应播放点。细节：Java tamed 不受 Mute 饰品影响；BE tamed 不查 mute，但有 `disable_tamed`。开盒 pitch 随阶段变化 BE 未复刻。

---

## 4. 未实现清单（按优先级）

### P0 — 有资源、对标 Java 核心体验、改动面可控

| 项 | BE 现状 | 建议对齐 |
|----|---------|----------|
| `HurtPlayer` | 有 enum + OGG | `onHurt`：若 `damagingEntity` 为玩家且冷却到期 → `HurtPlayer`，否则 `Hurt`；冷却 ~6s（120 tick 或等效） |
| `ItemGet` | 有 enum + OGG | 拾取成功路径计数，每 N 次（Java=5）播一次；尊重 mute |
| `FindTarget` | 有 enum + OGG | 见 P1（与 Attack ambient 绑定更合理） |

### P1 — 行为模型对齐（Idle / 模式 ambient / 环境）

| 项 | 建议 |
|----|------|
| Idle 频率 | 可选：缩短间隔或增加「工作中 ambient」通道，避免仅切模式才有 mode 音 |
| 战斗 ambient + FindTarget | 攻击/弹幕（及日后远程）模式下，周期 ambient：50% FindTarget / 50% Attack（或独立 Danmaku key） |
| 其它工作 ambient | farm/shears/…：无独立 OGG 时 **复用 Idle**（对齐 Java 音效包 fallback），有资源再拆 key |
| 环境与 ambient 关系 | **不推荐**完全改成 Java 概率嵌入（BE 传感器去抖已稳）；保持边沿触发，仅微调 Morning/Night 时间窗（若 API 允许） |

### P2 — 缺资源 / 缺系统，随功能做

| 项 | 依赖 |
|----|------|
| `hurt_fire` | 新增定义 + OGG（或 Hurt 复用）+ 伤害类型判断 |
| `range_attack` / `danmaku_attack` 独立 key | 音效包或自建 OGG；`MaidSoundType` 扩展 |
| `feed_animal` 独立于 `feed` | 可选；现复用 Feed 可接受 |
| `game_win` / `game_lost` | 棋类玩法落地后 |
| `credit` | 音效包选择 UI |
| `ai_chat` | TTS |
| `item.compass` | 罗盘功能接线 |
| break/furnace/brewing | 仅包兼容，可不做 |

---

## 5. 实现计划（分步）

### Phase A — 补齐「有文件未接线」（预计小）

**目标**：HurtPlayer、ItemGet 可玩；文档与 enum 一致。

1. **HurtPlayer**  
   - 改 `MaidLifeCycleEvents.onHurt`：解析 `damageSource` / `damagingEntity`。  
   - 玩家伤害：冷却用 DP 或内存 Map（entity id → 到期 tick）；到点播 `HurtPlayer` 并重置冷却。  
   - 非玩家：保持 `Hurt`。  
   - 不查 mute（对齐 Java hurt 路径；Mute 饰品若日后做再统一）。

2. **ItemGet**  
   - 在现有拾取 / 磁铁成功处调用 `Sound.play(..., ItemGet)`。  
   - 计数器：每 5 次成功拾取播一次（或可配置）；mute 时跳过。  
   - 验收：连续拾取不刷屏。

3. **验收**  
   - 玩家打女仆：优先 hurt_player 语音，6s 内再打为普通 hurt 或不重复 player 线（按实现二选一，建议对齐 Java：冷却期内走普通 hurt）。  
   - 拾取 5 次左右听到一次 item_get。

4. **文档**  
   - 更新 [女仆音效清单.md](../202602%20调度优化/Task3%20音效优化/女仆音效清单.md) §6/§8；勾选本计划对应项。

### Phase B — 模式 ambient + FindTarget（中）

**目标**：战斗/工作中有周期性语音，接近 Java「干活时说话」，而不是只在切模式叫一声。

1. 在现有 `MaidScheduleEvents` 定时器（或独立 ambient 步）增加：  
   - 若 mute → return  
   - 按 `Work.get` 查「ambient 音效表」：  
     - attack / danmaku：`rand < 0.5 ? FindTarget : Attack`  
     - feed / feed_animal：`Feed`（可选再叠环境——建议 **不叠**，环境仍走传感器）  
     - 其它已实现工作：暂 `Idle` 或 skip  
     - idle：保持现有 Idle 逻辑或与 ambient 合并，避免双重播放  
2. **切模式音**：可保留（比 Java 多一声提示），或改为可选；建议 **保留**，增强 UI 反馈。  
3. 频率：先用现有 ~33s 档，避免过吵；后续可加「频率」配置贴近 Java 4s×频率门。  
4. 验收：近战模式等待可见周期语音；约一半为 find_target。

### Phase C — 条件微调（小～中）

| 调整 | 做法 | 优先级 |
|------|------|--------|
| Morning/Night 时间窗 | 若脚本可读当日时间，限制在类似 0–3000 / 12000–15000 的片段再允许传感器触发；否则保持昼夜边沿 | 低（BE API 限制时跳过） |
| 开盒 pitch | `Box` 播放 options.pitch 按阶段 | 低 |
| Hurt 火焰 | 有伤害类型再加 `HurtFire` | 中（需资源） |
| idle1 重复 | 修 `sound_definitions` 重复条目 | 顺手 |

### Phase D — 音效包与扩展 key（另项 / huh 后续）

与 huh 中「packId + 目录防覆盖」「转换器语音包」衔接：

1. `MaidSoundType` 可扩展 range_attack / danmaku_attack / farm / …  
2. 无独立文件时管理器层 **fallback** 到 Attack/Idle（对齐 Java `CustomSoundLoader` 复用）。  
3. Credit 在音效包预览 UI 中播放。

本 Phase 不阻塞 A/B。

---

## 6. 建议不做或明确降级

| 项 | 理由 |
|----|------|
| 环境完全改回「ambient 内 50% 替换」 | 破坏现有传感器去抖与 mute 一致性；双通道更清晰 |
| 为 break/furnace/brewing 加空枚举 | Java 也无玩法路径 |
| 4 秒高频率 ambient 无频率门 | 基岩无客户端 OpenAL 包频率时易吵；应用更长间隔或全局概率 |
| 一次性做齐所有 mode 独立 OGG | 无资源；先 fallback Idle |

---

## 7. 验收矩阵（Phase A+B 合计）

| 场景 | 期望 |
|------|------|
| 玩家连续攻击女仆 | 首次（或冷却外）hurt_player，冷却内 hurt |
| 火焰伤害（若未做 hurt_fire） | hurt（可接受） |
| 连续拾取物品 | 约每 5 次 item_get；mute 无声 |
| 切换近战 / 弹幕 / 喂食 | 仍有切模式音 |
| 近战挂机 | 周期性 Attack 或 FindTarget |
| 进入雨天 / 热群系 | 环境音边沿一次；mute 无声 |
| 空闲挂机 | Idle 仍按现节奏（或与 B 合并后的单一 ambient） |

---

## 8. 工作量估计

| Phase | 改动面 | 估计 |
|-------|--------|------|
| A HurtPlayer + ItemGet | `MaidLifeCycleEvents`、拾取路径、可选 DP | 小 |
| B 模式 ambient + FindTarget | `MaidScheduleEvents` / Work 查表、频率 | 中 |
| C 微调 | 传感器或 Hurt 类型、definitions | 小 |
| D 音效包 key | 与 huh 后续任务合并 | 大（另排期） |

---

## 9. 与任务分组关系

| 范围 | 内容 |
|------|------|
| 202602 Task3（已完成） | 脚本通道、环境迁脚本、清单与本对照方案 |
| [音效优化二期](./README.md) | Phase A–C 落地、packId / 目录、转换器语音包 |

JSON 环境迁脚本已完成；落地时 **保持** 边沿模型（见 §6）。

**二期推荐顺序**：A → B →（资源就绪时）hurt_fire / 独立 mode key → 音效包（原 Phase D）。
