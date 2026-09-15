
## 脚本侧优化

### 本期范围与约束

| 项 | 约定 |
|----|------|
| 目标 | 脚本侧结构重构与可维护性（全 TS、职责清晰） |
| 不做 | 新功能：全局女仆队列、区块农作调度、新 seek/目标锁定、新工作模式 |
| 落地形态 | 近乎重写：目录与模块可全新划分；旧 JS 作行为对照 |
| 兼容 | 涉及已有持久化的设计不改：`StrMaid` 编码、lore、实体属性名、`thlmm:*` / `api:mode_*` 事件名；包外调用面用 compat 过渡 |
| 范围 | 仅脚本侧（`typescripts/src/maid` + 事件接线）；JSON / `MaidGenerator` 视为 platform adapter，本期只定边界不重画 |

---

### 目标架构（方案 2 修正版）

**核心思想**：事件薄、领域按 facet 拆分、工作模式独立；API 以 **Entity 中心 + 静态/模块方法** 为主（不做默认 `Maid.fromEntity` 包装，避免与事件每次下发的 `Entity` 模型冲突，也不做 id→句柄缓存）。

```
EntityEvents / ItemEvents
        │
   events/          协议适配，脚本侧唯一入口
        │
   facets / work / ui / serialize
        │
   platform：实体属性 / triggerEvent / JSON AI（本期不改实现）
```

包外（altar / GarageKit / Command 等）经 `compat/` 或直接使用 `facets` + `serialize`。

---

### 优化女仆脚本侧代码

路径：`TouHouLittleMaid_BP/typescripts/src/maid`

#### 目录结构

```
typescripts/src/maid/
  facets/                 # 状态与行为切片（从 EntityMaid 拆出）
    Work.ts / Owner.ts / Health.ts / Level.ts / …
  serialize/
    StrMaid.ts            # 格式冻结；与 facets 双向转换
  events/                 # 唯一协议入口（替换 MaidManager 上帝类）
    MaidEvents.ts         # 聚合
    lifecycle / interact / schedule / coupled
  work/                   # 现有农作等任务（行为照搬，只拆结构）
    types.ts              # handler 接口
    Farm.ts / Melon.ts / Cocoa.ts / …
  ui/                     # 表单；只依赖 facets
  skin/                   # 皮肤包注册（已有，保留）
  compat/                 # 对外兼容门面（只转发、不写新业务）
    EntityMaid.ts
  index.ts                # 对外导出（优先 facets / serialize / events）
```

可选：用命名空间聚合 `export const Maid = { Work, Owner, … }`，仅为组织名，不是 Entity 包装类。

#### 依赖规则（硬约束）

1. `events` / `ui` / `work` → 可依赖 `facets` / `serialize`；不可互相深挖对方内部
2. `facets` / `serialize` 不依赖 `events` / `ui` / `work`
3. 包外模块优先走 `compat/`；新代码直接用 `facets` / `serialize`
4. `EntityEvents` 只接线到 `events/`，不再散落调用旧 `MaidManager.*`

#### 基础层

##### facets（原「女仆实体接口」）

提供对女仆信息的读取与修改；方法形态为 `Facet.method(entity, …)`。

| Facet | 职责 | 来源对照 |
|------|------|----------|
| `Level` | 等级、属性表、驯服等级事件 | `EntityMaid.Level` |
| `Movement` | 移速写入、lock/unlock | `Movement` |
| `Owner` | 主人 id/名、refresh | `Owner` |
| `Health` | 当前/最大生命 | `Health` |
| `Kill` | 杀敌计数 | `Kill` |
| `Skin` | 皮肤 pack/index；委托 `skin/` 注册表 | `Skin` + `skin/` |
| `Pick` | 拾取模式、magnet | `Pick` |
| `Work` | 工作模式 get/set、触发 `api:mode_*` | `Work` |
| `Home` | home 坐标/维度 | `Home` |
| `Backpack` | 类型、隐显、容器 | `Backpack` |
| `Anim` | sit/hug/sleep 等 | `Anim` |
| `Emote` | 表情（现有全局 timeout 改为每女仆独立，属等价修 bug） | `Emote` |
| `Mute` / `Sound` | 静音、播音效 | 同名 |
| `Statues` / `Ride` | 仍被调用则保留，否则进 compat 遗留 | 同名 |

编排函数（不属于单一 facet）：`init`、`toStr`/`toLore` 等，分别落在 facets 旁或 `serialize`。

不放进 facets：心跳步进、农作扫描、表单、死亡出胶片等跨实体流程 → `events` / `work` / `ui`。

##### skin（原「模型」）

实体外观/皮肤包注册与修改；由 `facets/Skin` 委托，目录可继续独立于 `skin/`。

##### serialize（原「字符化」）

+ `StrMaid` 编码与 lore **冻结**，只做 TS 化与逻辑收敛
+ 内部通过 facets 读写实体，不依赖 events
+ 从字符串生成女仆：单一工厂，避免 altar 自行拼属性

##### events（原「女仆事件」）

| 模块 | 协议来源（冻结） | 职责 |
|------|------------------|------|
| `lifecycle` | spawn/death/tame/load 等 | 初始化、死亡胶片+墓碑、驯服、加载扫描 |
| `interact` | 交互、sit/stand、照片/魂符等 | UI、姿态、物品→女仆 |
| `schedule` | `thlmm:t` 及子触发 | 回血、回程、弹幕、分发 work 一步 |
| `coupled` | NPC/状态扫描等 | 照搬现有，独立文件 |

心跳数据流（行为等价）：

```
JSON timer → thlmm:t → EntityEvents → events/schedule
  → facets（Heal / Pick / Home…）+ work（按模式 search/step）
thlmm:h / thlmm:a → schedule 对应方法
entityHitEntity on thlmt:* → work.targetAcquire
```

#### 第二层

##### ui

负责展示表单；只依赖 facets 公开 API。

##### work

+ 统一 handler 接口（如 `search` / `step` / `acquire`）
+ 实现照搬现有 Farm / Melon / Cocoa / SugarCane 等
+ `schedule` 只分发，不内嵌扫方块
+ **不**引入全局任务队列或区块树调度（见 `新女仆任务调度机制.md`，另期）

#### compat

+ `EntityMaid.*` 外观转发到 facets / 编排函数
+ `StrMaid` canonical 在 `serialize`，compat 可再导出
+ 只转发、不写新业务；新代码禁止依赖 compat

#### JSON / MaidGenerator（边界声明）

脚本继续通过既有属性名与 `triggerEvent` 协作；本期不改事件名、属性名、不重画生成器。

---

### 迁移顺序

1. 搭骨架（目录、facets 占位、compat 转发）
2. 按依赖自底向上迁 facets
3. serialize TS 化并对齐；旧字符串对照读写
4. 收拢 events；`EntityEvents` / `ItemEvents` 只进 `events/`
5. 拆 `MaidTarget` → `work/*`
6. ui TS 化
7. 删旧 JS 上帝文件；收敛 compat

### 验收标准

+ 玩家可感知行为与现网一致（驯服/死亡胶片/魂符照片/坐立抱/工作模式/农作/弹幕回血/皮肤与 UI）
+ 旧 `StrMaid` 字符串与 lore 可解码、可写回，不升级格式
+ `thlmm:*`、实体属性名、`api:mode_*` 无变更
+ 无新功能（无全局队列、无新农作调度、无新工作模式）
+ 依赖方向符合上文；业务入口唯一为 `events/`
+ `maid` 下业务代码全量 TS

### 明确延期

+ 运行时女仆管理器 / 全局任务调度 / 三维区块调度 → `新女仆任务调度机制.md`
+ JSON 决策与动作继续外移的专项清理 → 另开需求（可与结构重构并行规划，但不阻塞本期验收）

### 备选方案（已否决，仅存档）

| 方案 | 结论 |
|------|------|
| 静态领域拆分但不理清事件入口 | 易迁、易再次膨胀为上帝类 |
| Entity 实例句柄 `Maid.fromEntity` | 与事件模型不符；易误导缓存；本期不采用 |
| 六边形纯领域端口 | 过重，Bedrock 副作用难以真正纯化 |
