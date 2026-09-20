# 槽位系统（脚本 → JSON）

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
- 不要求立刻拆掉现有捆包事件（如 `api:lv_1_basic`）；槽位与之 **可并存**，业务后迁

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

现状：`Level` 调用 `api:lv_N_basic` / `_tame`，组内捆了 attack、health 等。

目标：Level（或其它业务）改为组合原子槽；**本阶段交付物是中间层 + 生成约定**，不强制同一提交内改完 Level。

迁移时注意：同一实体上，旧捆包组与新原子槽若含 **同一组件键**，会互相覆盖，需约定切换窗口（先退旧 `api:lv_*`，再挂 `slot:*`，或按组件键逐步替换）。

---

## 7. 落地顺序

1. 定稿本文约定（命名、事件体、目录）。  
2. 实现生成器 `expandIntSlot` + 先锋槽（建议 `attack`，或先把 `variant`/`Skin` 接入 runtime）。  
3. 脚本 `registry` + `runtime` + `Slots.*` 具名 API。  
4. 再批量增加其它数值/枚举槽。  
5. 业务（Level 等）改为组合槽；旧 `api:lv_*` 视情况废弃。  
6. （另线）JSON 决策/音效迁移 —— 不并入本系统实现。

---

## 8. 文档与代码同步

- 新增槽位时：先改生成器槽位表，再补脚本 `registry`（或由生成器吐出 `slots.gen.ts`，二选一，优先避免两处手写漂移）。  
- 审查时重点看：业务是否绕过 `Slots` 直接 `triggerEvent("slot:…")`；`slot:*` 事件是否混入决策/副作用。
