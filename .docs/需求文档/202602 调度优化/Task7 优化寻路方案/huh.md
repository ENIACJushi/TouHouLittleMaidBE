# Task7 脚本寻路（有界 A\* + 冲刺跃谷）

**状态：** Phase0a 完成；四类边 + A\* / `canReach` 已落地；下一步规划验收或 Phase2 `follow`。细节见 [实现计划.md](./实现计划.md)。  
**依赖：** [Task6](../Task6%20精准目标控制/huh.md) **已完成**。

| 阶段 | 状态 |
| --- | --- |
| Phase 0a | **已完成**：公式 §6.2；探针 → [Phase0a-探针归档](./Phase0a-探针归档/README.md)；生产 `maid/path/*` |
| Phase 0b | 冲量标定（待做；可与 Phase2 Gap 执行并行） |
| Phase 1 | **已完成**；`path_all` PASS；验收归档 → [Phase1-规划验收归档](./Phase1-规划验收归档/README.md) |
| Phase 2 | `Path.follow` 执行（进行中） |

**定位：** 农作等接入 Task6 精准目标的 **刚需**（认领前预判可达）。  
含 **冲刺跳过空谷**：原版 `navigation.walk` **不会**规划跨空格跃迁；用脚本 `applyImpulse` 执行该边。

---

## 1. 动机与边界

生产 API 无 `canReach` / `findPath` / `entity.navigateTo`。

| 能力 | 原版 AI | 本任务 |
| --- | --- | --- |
| 平走、跳上 1 格、落下若干格 | `navigation.walk` + `jump.static` 可走 | 规划进图；执行可交 AI |
| **冲刺跃过一段空谷落到对岸** | **不规划**（无跨沟边） | **规划 + `applyImpulse` 执行** |

目标：

- `canReach` / 出路径：先 A\* 预判，再 Task6 `stamp`
- 路径含跃谷时：脚本打断 AI → 冲量 → 落地后接续
- 农作接线（mode / `Farm` stamp 等）在本任务或紧随其后

**不做（默认）：**

- SimulatedPlayer / GameTest 探针当运行时
- 全程脚本模拟走路（平走段仍优先 AI）
- 二格高「爬墙式」垂直跳（无对岸落点）
- 连续多段跑酷连跳（可后扩；首版单段 Gap 边）

---

## 2. 方案重评 → 最佳方案

### 2.1 为何改方案

旧草案：站立格 A\* + Walk / Jump1 / Fall，执行「全程路点 + 原版 nav」。  
在「要跨空谷」后不成立：引擎路径不含 Gap 边，只放路点 **过不了沟**。

| 方案 | 跨空谷 | 评价 |
| --- | --- | --- |
| 仅原版 nav + 路点 | 否 | 不足 |
| 全程 teleport 贴路径 | 能「到」 | 无冲刺手感；否决为默认 |
| 全程脚本冲量走路 | 能 | 难稳、费调试 |
| **混合：A\* 多类型边 + 分段执行** | **能** | **采用** |

### 2.2 结论（最佳）

**有界 A\*（可站立格）+ 边类型分流执行：**

1. **规划层（统一）**  
   节点 = 可站立格。  
   边 = `Walk` | `Jump1` | `Fall` | **`SprintGap`（冲刺跃谷）**。  
   `SprintGap` 代价明显高于步行，仅无绕路时选用。

2. **执行层（混合）**  
   - `Walk` / `Jump1` / `Fall`：路点 / Seek 标记 + 原版 nav（与 Task6 锁协议兼容）。  
   - `SprintGap`：暂停索敌/移动 AI → `clearVelocity` → 朝向对岸 → **一次** `applyImpulse`（或 `applyKnockback`）→ 轮询落地/到位 → 失败则中止并标不可达 → 成功则跑下一段。

3. **标定**  
   冲量不靠理论弹道一次算死；用 **「水平跨距 × 落差 → (vx,vy,vz)」查找表** 游戏内标定（女仆质量/阻力与玩家不同）。项目内已有 `applyImpulse` 先例（如 `PowerPoint`）。

---

## 3. 图模型

### 3.1 节点

可站立格 `(x, y_floor, z)`：支撑面 + 脚/头净空（约 `0.6×1.5`）；避伤害块 / 水。

**判定公式已锁定（G-Player + API；详见 [Phase0a §6.2](./Phase0a-可站立与可穿过测试设计.md)）：**

- `isHazard`：`isLiquid` ∪ lava/fire（水可配置为危险）。  
- `isPassable`：air ∪ 植物/装饰薄片 ∪ pressure_plate ∪ carpet；**否** solid / glass / leaves / fence / wall。  
- `isSupport`：`(isSolid ∧ ¬黑名单) ∪ glass ∪ carpet ∪ 关底活板门`；**否** air/liquid/fence·wall（整格）/压力板/开活板门。  
- `isStandable`：below 可支撑 ∧ foot/head 可穿过 ∧ ¬hazard。  

活板门开/楼梯 → **NavMismatch**（局部站立面，首版禁普通 Walk 或特殊边；中长期脚本挪位）。  
**后置 TODO：** 栅栏顶部可站，面积随 `north/south/east/west` 连接变化——首版不生成栅栏顶节点。

### 3.2 边

| 类型 | 条件（摘要） | 代价（建议） | 执行 |
| --- | --- | --- | --- |
| Walk | 同 y，四向（可选八向）相邻可站 | 1 | AI |
| Jump1 | 邻格 `y'=y+1`，起跳净空 | 1.2～1.5 | AI |
| Fall | `y'∈[y-maxFall,y-1]`，`maxFall`≈3～4 | 1+k·Δy | AI |
| **SprintGap** | 见下节 | **5～10**（偏高） | **冲量** |

启发：水平距离 + `|Δy|`（可略低估）。搜索箱：农作水平 `≤16～24`，竖直 `±4～6`。

### 3.3 SprintGap 生成规则（首版）

对每个可站立格 A，在水平距离 `gapMin..gapMax`（建议 **2～4** 格）内找可站立格 B：

1. **中间是空谷**：A→B 水平线段上，除端点外无「可站立」踏脚（或脚下为空气/非支撑）；禁止把普通相邻 Walk 标成 Gap。  
2. **落差**：`Δy = yB-yA ∈ [-1, +1]`（首版收紧；过后再放宽）。  
3. **朝向**：优先轴对齐；可选对角（跨距用 √2 折算进表）。  
4. **净空**：起跳格头上、轨迹包络（可用若干采样点 `getBlock`）无实心阻挡。  
5. **扇出上限**：每格最多 K 条 Gap 边（如每方向 1 条最近合法对岸），避免边爆炸。

`canReach` 与真实执行共用同一套 Gap 规则，避免「判得过、跳不过」。

---

## 4. 冲量执行（SprintGap）

### 4.1 状态机（每女仆一条路径）

```
Idle → FollowWalk(边…) → PrepGap → Impulse → InFlight → Landed → FollowWalk… → Done
                              ↘ Fail → 释放目标锁 / 写不可达缓存
```

要点：

- **进 Gap 前**：女仆须在起跳格附近且 `isOnGround`；`reset_target` / 临时卸 Seek 或锁 `movement`，避免 AI 抢速度。  
- **Impulse**：`clearVelocity()` 后 **单次** `applyImpulse`（持续每 tick 冲量易与移动叠加速度，社区有相关问题）。  
- **InFlight**：超时（如 1～2s）或落入虚空/伤害块 → Fail。  
- **Landed**：脚在 B 的容差内且着地 → 恢复 AI，接下一段。

### 4.2 冲量表

```
key: (distClass, dy) → { hx, hy, hz }  // 水平合成方向 × 标量，或分轴
```

- `distClass`：按水平距离分桶（2 / 3 / 4…）。  
- 实现期用 debug 指令试跳填表；保留「略欠一点水平、略补一点 hy」的微调项。  
- 备选 API：`applyKnockback(horizontalForce, verticalStrength)`（语义更贴「推一下」，可与 impulse 二选一标定）。

### 4.3 与 Task6

Gap 段不依赖 `must_reach` 选中沟对面的实体（引擎可能根本选不到）。  
业务流程：**脚本 `canReach`（含 Gap）通过 → stamp →** 执行器按路径走；Walk 段仍可用 Seek 追标记。

---

## 5. 性能

1. 搜索箱方块缓存（`isSolid` / `isStandable`）；Gap 净空采样读缓存。  
2. A\* 节点/耗时上限；Gap 候选只对「无 Walk 邻居通向的方向」或「对岸有目标价值」生成可二期优化，首版规则生成即可。  
3. 同时处于 `InFlight` 的女仆数宜设上限，避免冲量风暴。

---

## 6. 与 Task6 / 农作衔接

| 阶段 | 内容 |
| --- | --- |
| Task6 | 精准目标控制系统 only |
| **Task7** | 本寻路（含 SprintGap）+ 农作接入 Task6 |
| 更后 | 全局区块调度 |

顺序：**Task6 → Task7**。

---

## 7. 预期落地

分阶段与模块清单见 **[实现计划.md](./实现计划.md)**（`maid/path/*`、`EntityMaid.Path`、先 Farm 接线）。
