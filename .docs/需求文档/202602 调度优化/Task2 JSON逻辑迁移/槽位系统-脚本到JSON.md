# 槽位系统（脚本 → JSON）

**Task2 状态：已完成**（交付见 §9.1 / §9.2；移出项见 §9.3）。

本文档约定 Task2 中 **脚本主动装载/卸载实体组件** 的基础层架构。  
它位于具体业务（等级、工作模式等）之下，与既有「万金油」`api:` 事件、以及 JSON→脚本的 `thlmm:` 钩子 **并列且边界清晰**。

---

## 1. 范围

### 做

| 侧 | 职责 |
|----|------|
| **MaidGenerator / maid.json** | 按槽位表展开：原子 `component_groups` + 成对装载/卸载事件 |
| **脚本槽位层** | 校验取值（枚举 / 范围）、维护当前档、`quit` 旧档再 `add` 新档；向上提供规范 API |
| **业务 facets** | 组合多个槽位调用，表达「等级」「姿态」等语义；不直接拼事件名字符串 |

### 不做（本阶段明确排除）

- 不改动、不重命名现有 `thlmm:` / `thlmb:` 等 **JSON→脚本** 体系
- 不把环境音效、粒子、`queue_command` 等决策迁入本系统（那是 Task2 后续、另一条线）
- `api:lv_*_basic` / `thlmm:lv*_basic` 已删除；basic 仅走槽位
- **不做** `dmg_tame` 一类 damage_sensor 槽：驯服承伤 / 减伤 / 主人相关伤害逻辑，后续用 **脚本伤害事件** 替代，不经槽位系统
- **不做** `scale` 槽：可脚本直改
- **不做** 本任务内接入 `seek`：现生成结构需调整且未使用，留给「精准目标控制」任务

### 与 `api:` 的边界

| | `api:*`（既有） | `slot:*`（本系统） |
|--|-----------------|-------------------|
| 定位 | 业务向、常捆多个组件/附带 `set_property` | 专业、原子：一槽一档一只组件形态 |
| 调用方 | 各 facet 直接 `triggerEvent` | 仅经槽位运行时；业务不碰事件名 |
| 事件体 | 历史上较杂 | **只允许** `add` / `remove` 对应组 |
| 扩展方式 | 手写事件 | 表驱动批量展开 |

---

## 2. 核心概念：槽位（Slot）

**槽位** = 引擎上一条 **互斥** 的组件线：同一实体、同一槽，任意时刻最多挂载一档（一个 token）。

示例（示意）：

```text
槽位 attack
  token 11 → group 内 { "minecraft:attack": { "damage": 11 } }
  token 12 → group 内 { "minecraft:attack": { "damage": 12 } }
  token 13 → group 内 { "minecraft:attack": { "damage": 13 } }
```

脚本侧：`Slots.attack.set(maid, 12)` → 若当前为 11，则先卸 11 再装 12。

已有接近形态：`Skin` 的 `skin:N`（variant）。本系统将其泛化为可复用的槽位运行时，并 **补上互斥卸载**（Skin 若尚未 quit 旧组，接入时一并规范）。

---

## 3. 命名约定

前缀统一为 **`slot:`**，与 `api:`、`thlmm:`、`skin:`（过渡期）区分。

设槽位 id 为 `<id>`（小写蛇形或短名，如 `attack`），档位为 `<token>`（整数十进制，或枚举名）。

| 对象 | 格式 | 示例 |
|------|------|------|
| component_group | `slot:<id>_<token>` | `slot:attack_12` |
| 装载事件 | `slot:<id>_<token>`（与组名相同） | `slot:attack_12` |
| 卸载事件 | `slot:<id>_<token>_quit` | `slot:attack_12_quit` |

### 事件体约束（硬性）

装载：

```json
{ "add": { "component_groups": ["slot:attack_12"] } }
```

卸载：

```json
{ "remove": { "component_groups": ["slot:attack_12"] } }
```

**禁止**出现在 `slot:*` 事件中：`filters` 分支、`sequence` 决策、`set_property`、`queue_command`、`playsound`、再 `trigger` 其它业务事件。

### 与历史名的关系

- 新槽位一律用 `slot:`。
- 既有 `skin:N`、`tlm_seek:*`、`api:lv_*` 等 **不必立刻改名**；脚本运行时可用适配器映射到旧事件，或生成器为先锋槽双写别名（可选，默认不双写以保持干净）。

---

## 4. MaidGenerator 架构

### 职责

用 **槽位表** 展开大量原子组/事件，避免为每个 damage 手写一份 JSON。

### 建议结构

```text
MaidGenerator/
  main.js                 # 加载槽位定义 → 校验 → 展开 → 写 maid.json
  template.js             # 既有大包 / life / thlmm 等（本阶段少动）
  modules/
    Skin.js               # 可保留；或改为调用通用 expand
    Seek.js               # 暂独立；日后视是否纳入 slot 再定
    slots/
      expand.js           # expandIntSlot / expandEnumSlot
      attack.js           # 或统一 slots.manifest.js
      ...
```

### 槽位定义字段（建议）

| 字段 | 说明 |
|------|------|
| `id` | 槽位名，进入事件名 `slot:<id>_…` |
| `kind` | `int` \| `enum` |
| `min` / `max` | `int` 时的闭区间 |
| `values` | `enum` 时的 token 列表 |
| `component` | 如 `minecraft:attack` |
| `shape` | 组件体模板，用占位符填入 token（如 `{ "damage": "$" }`） |

生成器对每个 token：`addComponentGroup` + 装载事件 + 卸载事件；并校验全局组名/事件名不冲突。

### 校验（建议在 build 时做）

1. `id`、组名、事件名唯一  
2. `slot:*` 事件体仅含 add/remove  
3. int 槽 `min≤max`，且展开数量在可接受上限内（防止误配炸 JSON）

---

## 5. 脚本侧架构

位于业务 facets **之下**，例如：

```text
typescripts/src/maid/
  slots/                    # 新建
    registry.ts             # 槽元数据（与生成器表对齐：id、kind、范围、事件名公式）
    runtime.ts              # set / get / clear：校验 → quit 旧 → add 新
    main.ts                 # 导出 Slots
  facets/
    Level.ts                # 业务：日后组合Slots，现可仍用 api:lv_*
    Skin.ts                 # 可逐步改为走 runtime
    ...
```

### 运行时职责

1. **约束**：越界拒绝或断言；业务不再散落 magic number 检查。  
2. **互斥**：每实体每槽记录当前 token（DynamicProperty 或内存表）；`set` 同值则 no-op。  
3. **调用**：只通过 `entity.triggerEvent`，事件名由公式生成，业务不拼字符串。  
4. **具名出口**（便于审查）：`Slots.attack.set(maid, 12)`，而非通用 `Slots.set('attack', 12)` 作为唯一对外形式（内部仍可通用实现）。

### 分层关系（目标态）

```text
Level.set(lv)                 # 业务语义
  → Slots.attack.set(…)       # 槽位基础系统
  → Slots.… 
       → triggerEvent("slot:…")
            → maid.json 原子组
```

`Movement` 等 **脚本可直接改组件数值** 的路径，不强制进槽位；槽位只服务「必须靠换 component_group」的能力。

---

## 6. 与 Level 等业务的关系

`Level.eventBasic` 组合 `Slots.attack/health/knockback`。  
JSON 已删除 `thlmm:lv*_basic` 与 `api:lv_*_basic`（含 quit），无 `quitLegacyBasic`。  
`api:lv_*_tame`（damage_sensor）**已由 Task5 脚本伤害管线替代并删除**；见 [Task5 huh](../Task5%20伤害转移至脚本处理/huh.md)。

### 6.1 兼容性结论与删旧事件惯例（已验证）

**结论（2026-09）：** Level basic 迁槽位并 **直接删除** 旧 `lv*_basic` 捆包/事件后，与现有玩法 **可兼容**（含生成、升级、魂符还原等路径依赖 `Init` / `Level.set` → `eventBasic` 挂槽）。

后续其它 `api:` 捆包迁移，按同一套路删旧，不必长期保留 quit 兼容层：

1. **先** 脚本业务改为只调 `Slots.*`（或新槽），Init/反序列化等入口也要能补齐槽位。  
2. **再** 从 `MaidGenerator/template.js` 删除对应 `component_groups` + `api:*` / `api:*_quit`，以及 `become_*` 等对旧组的 add/remove 引用。  
3. `npm run build` 重生 `maid.json` + `slots.gen.ts`；脚本侧去掉任何 `quitLegacy*` / 对旧事件名的 `triggerEvent`。  
4. 实机确认后再合入；文档在本节或 §9 勾掉对应项。

仍保留、不按此条误删的：

- `thlmm:` / `thlmb:` 等 **JSON→脚本** 钩子  
- 尚未迁完的捆包（如工作模式 `api:mode_*` 等）
- `api:lv_*_tame`：~~等脚本伤害事件替代后再删~~ → **Task5 已删**；勿再改造成 `slot:*`

---

## 7. 落地顺序

1. ~~定稿本文约定（命名、事件体、目录）。~~
2. ~~实现生成器 `expandIntSlot` + 先锋槽 `attack`（`slot:attack_1..32`）。~~
3. ~~脚本 `registry` + `runtime` + `Slots.attack`；`Skin`/`VariantSlot` 适配历史 `skin:*` 并补 `_quit`。~~
4. ~~P0：`health` + `knockback` 槽（可拆 `api:lv_*_basic`）。~~
5. ~~业务 Level **basic** 改组合槽。~~
6. ~~Task2 槽位范围收尾：`seek` / `scale` / backpack / dmg_tame 均不纳入本任务。~~
7. （另线，非本任务）JSON 决策/音效；驯服承伤改脚本伤害事件；精准目标控制时再改 seek。

---

## 8. 文档与代码同步

- 新增/改槽位数值：改 `MaidGenerator/modules/slots/*`（或 `Skin.js` variant 区间）后 `npm run build`。  
  build 会同时更新 `maid.json` 与脚本侧 `typescripts/src/maid/slots/slots.gen.ts`（**不**自动 tsc）。  
  `registry.ts` 只保留类型并再导出 `slots.gen.ts`。
- 临时改数值可直接编辑 `slots.gen.ts`；下次 build 会覆盖，且不会改 maid.json。
- 审查时重点看：业务是否绕过 `Slots` 直接 `triggerEvent("slot:…")`；`slot:*` 事件是否混入决策/副作用。

---

## 9. 槽位清单

原则：**只把「必须靠换 component_group」且能原子化的数值/有限枚举」做成槽**；复杂 AI 捆包、JSON→脚本钩子、脚本已能直改的组件，不进本表。

### 9.1 已有

| 槽位 | 事件形态 | 作用 | 主要调用方 |
|------|----------|------|------------|
| `attack` | `slot:attack_<2..32 step=2>` | 设置 `minecraft:attack.damage`（偶数档；set 向下对齐） | `Level.eventBasic` |
| `health` | `slot:health_<20..100 step=2>` | 设置 `minecraft:health`（偶数档；set 向下对齐） | `Level.eventBasic` / `Health.setMax` |
| `knockback` | `slot:knockback_<0..100 step=2>` | 百分制偶数档 → `knockback_resistance.value = n/100`（set 向下对齐） | `Level.eventBasic` / `Slots.knockback` |
| `variant` | 历史 `skin:<0..200>` + `_quit` | 设置 `minecraft:variant` | `facets/Skin` → `VariantSlot` |

### 9.2 Task2 范围内已完成（原 P0）

`attack` / `health` / `knockback` 已齐；`Level.eventBasic` 仅挂槽位；**旧 basic 捆包已删且已验证可兼容**（见 §6.1）。形态：

```text
Level.set(lv)
  → Slots.attack.set(damage)          // lv1→12, lv2→16（step=2）
  → Slots.health.set(maxHp)           // lv1→64, lv2→70（step=2，71→70）
  → Slots.knockback.set(percent)      // lv1→10, lv2→20（step=2，即 0.1 / 0.2）
  → Movement 仍脚本直写
  → 驯服承伤：过渡期仍可挂 api:lv_N_tame；终态用脚本伤害事件，不做槽
```

**Task2 槽位工作到此结束。** 下列项不进入本任务后续实现。

### 9.3 明确不做槽 / 移出本任务

| 能力 | 原因 |
|------|------|
| `minecraft:movement` 数值 | 已由 `Movement` 脚本直写；JSON 只注册组件 |
| `thlm:scale` / scale 组件 | **可脚本直改**，不做槽 |
| 站/坐/抱 **整套** movement+nav+behavior | 多组件捆包 + 与 `thlmm:v/w` 双向耦合；保持现组/`api:` |
| 工作模式 AI（farm/attack/danmaku…） | 多 behavior + family 捆包，属业务 `api:mode_*` |
| follow / home 状态组 | 业务状态机，非数值档 |
| 背包容量 / `api:backpack_*` | 格数档位少、无灵活变动需求；维持现有 `api:backpack_*` |
| 驯服 `damage_sensor` / `api:lv_*_tame` | **Task5 已删**；脚本 `EntityMaid.Damage` 承接 |
| `seek` / `tlm_seek:*`（现生成 0~300 档） | **结构需调整且当前未使用**；留到调度总览「精准目标控制」任务再优化，本任务不接入脚本、不改生成结构 |
| `thlmm:*` 钩子与音效 | JSON→脚本或副作用线，与 slot 无关 |

### 9.4 本任务实施记录（均已完成）

1. ~~**`health` 槽**~~  
2. ~~**`knockback` 槽**~~  
3. ~~**Level `basic` 改组合槽并删旧 `lv*_basic`**~~
