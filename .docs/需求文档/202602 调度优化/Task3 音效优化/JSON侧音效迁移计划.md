# JSON 侧音效迁移计划

## 结论

**环境 6 条已迁脚本（2026-03）。**  
自动与脚本业务音效此前已接 `EntityMaid.Sound`；JSON 仅保留传感器 / property 去抖，以及背包原版 `pop`。

实现要点：`environment:*` 事件 `set_property` + `trigger: thlmm:e*` → `MaidLifeCycleEvents.onEnvironmentSound`（mute 对齐 idle）。

---

## 1. 剩余清单

### 1.1 必迁（女仆语音 / `MaidSoundType`）

源：`MaidGenerator/template.js` → 生成 `BP/entities/maid/maid.json`。

触发链：`component_groups.environment:simple` 的 `minecraft:environment_sensor` → 实体事件 → `queue_command playsound`（**不经脚本、不查 mute**）。

| 实体事件 | 播放 Key | `MaidSoundType` | 同事件还做的事 |
|----------|----------|-----------------|----------------|
| `environment:temperature_warm` | `mob.thlmm.maid.hot` | `Hot` | `set_property environment:temperature = 1` |
| `environment:temperature_cold` | `mob.thlmm.maid.cold` | `Cold` | `temperature = 2` |
| `environment:weather_rain` | `mob.thlmm.maid.rain` | `Rain` | `weather = 1` |
| `environment:weather_snow` | `mob.thlmm.maid.snow` | `Snow` | `weather = 2` |
| `environment:morning` | `mob.thlmm.maid.morning` | `Morning` | `daytime = 1` |
| `environment:night` | `mob.thlmm.maid.night` | `Night` | `daytime = 0` |

无音效、仅改 property（迁移时保留即可）：

| 事件 | 作用 |
|------|------|
| `environment:temperature_mild` | `temperature = 0` |
| `environment:weather_clear` | `weather = 0` |

传感器仍负责「状态变化才触发」（`int_property != 当前值` + 温度/天气/昼夜过滤），迁移后应继续依赖这套去抖，避免每 tick 刷音效。

### 1.2 可选 / 建议后置（非女仆语音）

| 位置 | Key | 说明 |
|------|-----|------|
| 背包更换交互 ×4 | 原版 `play_sounds: "pop"` | UI 反馈，非 `mob.thlmm.*`；与音效包无关。可保留 JSON，或日后改脚本播自定义音 |

### 1.3 不在本迁移范围

| 项 | 原因 |
|----|------|
| `find_target` / `hurt_player` / `item_get` / `credit` | 已有定义与 enum，**无播放点**；属「是否接业务」另议，不是 JSON 迁移 |
| `altar_craft` / `power_pop` | 祭坛 / P 点，非女仆实体 JSON |
| `Sound.playSound` 原始 key 过渡 API | 可在 JSON 迁完后删或标废弃 |

---

## 2. 目标形态

```
[JSON] environment_sensor（检测 + 去抖）
   → 实体事件：只 set_property（写 temperature / weather / daytime）
   → 同时 hook 脚本（数驱事件 thlmm:* 或等价）
[脚本] 收到钩子 →（可选 mute）→ EntityMaid.Sound.play(Type.*)
```

原则：

1. **音效只由脚本播**（走 `Sound` 门面）。
2. **传感器与 property 去抖留在 JSON**（已验证、且 RP 未发现读这些 property 的动画依赖；property 仍主要服务传感器自身）。
3. **mute 对齐 idle**：环境语音应尊重 `Sound.getMute`（迁完后行为会比现在「环境无视 mute」更一致；若需完全复刻旧行为可加开关，默认尊重 mute）。

---

## 3. 推荐实现步骤

### Step A — 数驱钩子（JSON → 脚本）

在现有 `thlmm:` 体系上为环境音加短钩（命名示例，实现时与 `EntityEvents` 字母表对齐）：

| 建议事件 id | 对应音效 |
|-------------|----------|
| `thlmm:e0` / `thlmme0` 类 | Hot |
| … | Cold / Rain / Snow / Morning / Night |

或更可读：在事件里 `queue_command` 改为 `scriptevent`，由脚本解析。优先复用现有 **dataDrivenEntityTrigger → MaidEvents** 路径，避免再开一套通道。

**事件体改动**（每个有音效的 environment 事件）：

- **保留** `set_property`
- **删除** `queue_command` 的 `playsound …`
- **增加** 通知脚本的 trigger（`run_command scriptevent` / 已有 thlm 事件字母）

无音效的 mild / weather_clear：不动或只保留 property。

### Step B — 脚本处理

在 `MaidLifeCycleEvents` 或新建 `MaidEnvironmentEvents`：

```typescript
// 伪代码
onEnvironmentSound(maid, type: MaidSoundType) {
  if (EntityMaid.Sound.getMute(maid)) return;
  EntityMaid.Sound.play(maid, type);
}
```

`EntityEvents` 的 `thlmm:` switch 增加对应 case。

### Step C — 生成与验收

1. 改 `MaidGenerator/template.js`
2. 跑生成器更新 `maid.json`
3. 验收矩阵：

| 场景 | 期望 |
|------|------|
| 进热群系 / 冷群系 | Hot / Cold 各播一次；property 更新 |
| 温和群系下雨 | Rain |
| 寒冷群系降水 | Snow（不是 Rain） |
| 昼夜切换 | Morning / Night 各一次，不刷屏 |
| mute=true | 环境语音不播；property 仍更新 |
| 切回同状态 | 因 sensor 去抖，不重复播 |

### Step D — 收尾

- 更新 [女仆音效清单.md](./女仆音效清单.md) §4 / §8
- `huh.md` 勾选本项
- （可选）背包 `pop`：文档标明「有意保留 JSON」或列入另议

---

## 4. 方案取舍（不采用的理由）

| 方案 | 说明 | 为何不首选 |
|------|------|------------|
| 全脚本轮询天气/温度 | 去掉 `environment_sensor` | 成本高、易抖、与现有 property 去抖重复 |
| 事件只留 scriptevent、property 也改脚本写 | 脚本 `setProperty` | 可以，但多一步；传感器已在 JSON，property 同事件改更省 |
| 只删 playsound、不接脚本 | — | 环境语音会静音，功能回退 |

---

## 5. 工作量与风险

| 项 | 估计 |
|----|------|
| 改动面 | `template.js` 6 事件 + `EntityEvents` / Maid 事件 1 处 + 生成 maid.json |
| 风险 | 钩子漏接 → 无语音；mute 策略变更需在 changelog/自测注明 |
| 依赖 | 无；不阻塞音效包 packId 调研，可与 huh 下一项并行 |

---

## 6. 完成后「女仆音效通道」状态

| 通道 | 状态 |
|------|------|
| 自动 `sounds.json` | 已空 |
| 脚本业务（idle/attack/feed/tamed/camera/box/hurt/death） | 已接 `Sound.play` |
| JSON 环境 6 音 | **本计划迁移对象** |
| JSON 背包 `pop` | 建议保留 |
| 未接线类型（find_target 等） | 产品决策，非迁移 |
