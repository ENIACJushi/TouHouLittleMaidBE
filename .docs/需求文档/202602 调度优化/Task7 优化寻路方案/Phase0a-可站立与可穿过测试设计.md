# Task7 前置：可站立 / 可穿过 判定 — 测试设计

**目的：** 在写 A\* / `StandableCache` 之前，用游戏内探针把两个谓词定稿，并尽量贴近女仆 `navigation.walk` 的真实行为。  
**状态：** **已完成（G-Player）**；§6.2 已锁定；生产实现 `maid/path/*`；探针代码 → [Phase0a-探针归档](./Phase0a-探针归档/README.md)。  
**相关：** [实现计划.md](./实现计划.md) Phase 0a；[huh.md](./huh.md) §3.1。

---

## 1. 要敲定的两个判断

寻路里方块角色不同，必须拆开，不能只用「是不是实心」一刀切。

| 谓词 | 含义（路径语义） | 典型用法 |
| --- | --- | --- |
| **可穿过 `isPassable(block)`** | 实体体积可以占用该格（脚格 / 头格净空） | 站立点上方两格；Gap 轨迹采样；Jump1 起跳净空 |
| **可支撑 `isSupport(block)`** | 该格**顶面**能当站立面（站在它「上面」） | 脚下地板；空谷判定「中间有没有踏脚」 |

**可站立格 `isStandable(x,y,z)`**（节点）是组合，不是单格属性：

```
isStandable(脚所在格 foot, 头所在格 head, 脚下支撑格 below) :=
  isSupport(below)
  && isPassable(foot)
  && isPassable(head)
  && !isHazard(foot) && !isHazard(below)   // 岩浆等，可并入或单开
```

约定坐标：节点记脚部整数格 `(x, y_foot, z)`，则 `below = (x, y_foot-1, z)`，`head = (x, y_foot+1, z)`。

**本阶段只敲定：** `isPassable`、`isSupport`（及可选 `isHazard`）。  
`isStandable` 在两者定稿后用上面组合式即可。

---

## 2. 候选方案（探针要对比的公式）

脚本侧以 `@minecraft/server` 的 `Block` 为准。当前工程已用 `block.isAir`；`isSolid` / `isLiquid` 是否在本运行时可用，探针启动时做一次 **API 能力探测** 并写入日志。

### 2.1 `isPassable` 候选

| ID | 公式（伪代码） | 预期问题 |
| --- | --- | --- |
| P0 | `block.isAir` | 漏掉花、草、地毯、告示牌等「非空气但可走」 |
| P1 | `!block.isSolid`（若 API 有） | 可能把半砖/楼梯误判可穿过（脚格） |
| P2 | `block.isAir \|\| block.isLiquid` | 水是否算可穿过：与 maid `avoid_water` 冲突 → 应用 `isHazard` 或配置关掉 |
| P3 | 白名单 tags / typeId（花、草、地毯…）∪ `isAir` | 维护成本高，但可控 |
| P4 | `!isSupport(block) && !isHazard(block)`（与支撑互斥定义） | 依赖 Support 定稿顺序；小心循环定义 |

**建议测试顺序：** 先测 P0/P1（及 API 有无），再对失败用例补 P3 白名单，避免一上来维护大表。

### 2.2 `isSupport` 候选

| ID | 公式（伪代码） | 预期问题 |
| --- | --- | --- |
| S0 | `block.isSolid` | 半砖/楼梯顶面是否算 solid？栅栏顶能否站？ |
| S1 | `!block.isAir && !block.isLiquid` | 叶、玻璃板、矮草可能误判可站 |
| S2 | `isSolid` 且 **不是** 已知「非完整站立面」黑名单（栅栏、墙、细雪？） | 黑名单靠用例积累 |
| S3 | 上表面高度：用 `permutation` / 碰撞（若无直接 API 则本阶段不做精确碰撞） | 精确碰撞脚本侧弱；首版可不选 |

**建议：** 主候选 **S0（isSolid）+ 黑名单 S2**；用用例矩阵打脸后再收紧黑名单。

### 2.3 `isHazard`（建议一并测，避免和水/岩浆缠在一起）

| ID | 内容 |
| --- | --- |
| H0 | typeId / tags：岩浆、火、甜浆果丛等 |
| H1 | `isLiquid &&` 水（可选：农作默认水=危险不可站） |

---

## 3. 真值怎么来（避免「脚本自己测自己」）

每个用例方块要有 **独立真值**，不能只用候选公式互相比。

| 真值源 | 方法 | 用于 |
| --- | --- | --- |
| **G-Player** | 创造/生存下玩家能否站上 / 能否走进该格 | 快速直觉；与女仆可能略有差异 |
| **G-Maid** | 放置地板样本 + 对岸 `seek_marker`，挂 Seek，看女仆是否走上样本顶 / 是否穿过样本格 | **主真值**（对齐 `navigation.walk`） |
| **G-Log** | 记录 `typeId`、`isAir`、`isSolid?`、`isLiquid?`、`getTags()` | 事后归纳白/黑名单 |

**判定规则（单格）：**

- **可穿过真值：** 女仆碰撞箱中心能进入该格体（或该格作为脚/头净空时不挡路）。  
- **可支撑真值：** 女仆能稳定站在该格**顶面**（`isOnGround` 且脚下方块为该格），不会掉穿。

有歧义的（半砖边角、楼梯朝向）记入「边界用例」，首版可标 `SKIP` 或强制走 Jump/绕路，不阻塞定稿主干。

---

## 4. 用例矩阵（必须覆盖）

探针自动 `setBlock` 铺一条「样本走廊」，每格一类；或分批 `block_probe_place <category>`。

### 4.1 可支撑（脚下）

| 类别 | 例 | 期望可支撑（预估） |
| --- | --- | --- |
| 全高实心 | stone, dirt, grass_block, farmland | 是 |
| 半砖（底/顶） | stone_slab[…] | 是（顶面高度不同，脚 y 可能不同——记录） |
| 楼梯 | oak_stairs | 是（朝向敏感） |
| 地毯 | white_carpet | ？对齐引擎 |
| 雪层 | snow_layer 1～8 | 低层？高层？ |
| 叶 | oak_leaves | 否或视引擎 |
| 玻璃 | glass | 是 |
| 栅栏 / 墙 | oak_fence, cobblestone_wall | 否（首版整格）；**顶部可站但面积随连接变 → TODO** |
| 箱子 / 漏斗 | chest, hopper | 是？ |
| **引擎易误判（重点）** | **活板门（开/关、顶/底）、梯子、脚手架、甜浆果、压力板、按钮** | **必须单独记 G-Maid vs 脚本；见 §4.4** |
| 空气 / 水 / 岩浆 | air, water, lava | 否 |

### 4.2 可穿过（身位）

| 类别 | 例 | 期望可穿过（预估） |
| --- | --- | --- |
| 空气 | air | 是 |
| 花 / 矮草 / 死灌木 | short_grass, dandelion | 是 |
| 地毯 | carpet | 是（身）/ 支撑另判 |
| 告示牌 / 火把 | oak_sign, torch | 是？ |
| 全高实心 | stone | 否 |
| 半砖（脚格里） | 脚与半砖同格 | 视碰撞 |
| 水 / 岩浆 | water, lava | 穿过？站立？拆开记 |
| 栅栏 | fence | 否（身不能进实心柱） |
| 门（开/关） | wooden_door | 开=是，关=否 |
| **活板门（开/关）** | iron_trapdoor / oak_trapdoor | **引擎常与直觉不符；重点测** |

### 4.3 组合（可站立节点）

在已定 `isSupport`/`isPassable` 后自动化：

| below | foot | head | 期望 isStandable |
| --- | --- | --- | --- |
| stone | air | air | 是 |
| stone | short_grass | air | 是（若草可穿过） |
| air | air | air | 否 |
| water | air | air | 否（默认） |
| fence | air | air | 否（首版）；顶部可站见 §6.1d TODO |
| stone | stone | air | 否 |
| stone | air | stone | 否 |
| 关闭底活板门 | air | air | ？G-Maid |
| 打开活板门 | air | air | ？G-Maid（可能掉/卡住） |

### 4.4 引擎误判类（NavMismatch）— 特别关照

原版 `navigation.walk` 对部分方块的「能不能走 / 站」与玩家直觉或脚本 `isSolid` **经常不一致**。本前置测试必须把它们单独分类，结果写入「NavMismatch 表」，**不强行塞进笼统 isSolid 公式**。

| typeId / 状态 | 测什么 | 记录 |
| --- | --- | --- |
| 活板门 `*_trapdoor`（open true/false，half top/bottom） | 顶面支撑？身位穿过？女仆是否绕开/卡死/掉落 | G-Maid + dump |
| 梯子 `ladder` | 是否当支撑 / 垂直移动（首版寻路或可当不可走） | |
| 脚手架 `scaffolding` | 站立与穿过 | |
| 压力板 / 按钮 / 地毯 | 支撑 vs 穿过拆开 | |
| 甜浆果丛等 | 伤害 + 穿过 | |

**后续策略（已拍板方向，本阶段只采数不定实现）：**

- 对 NavMismatch 方块：A\* 首版可标为 **特殊边 / 禁止自动 Walk**，避免判错锁死。  
- **中长期：** 脚本介入，**直接设置/传送女仆位置**（或短距 `teleport` 贴面）跨过/踏上该类方块，而不依赖引擎对该格的 path 边。  
- 因此探针报告须能导出「建议 ScriptOverride」清单，供后续 `Path` 执行器挂接。

## 5. 探针命令设计（实现时）

命名空间：`/scriptevent thlm:test …`（与 Task6 验收同一通道；测完归档）。

| 命令 | 作用 |
| --- | --- |
| `block_probe_help` | 说明 |
| `block_probe_api` | 打印当前运行时 Block 上是否有 `isSolid`/`isLiquid` 等 |
| `block_probe_dump` | 看向方块或脚下：打 typeId + 各 API + 各候选 P*/S* 布尔 |
| `block_probe_matrix` | 在玩家附近铺 §4 样本矩阵（分类标签实体或告示） |
| `block_probe_maid` | 生成女仆 + 对样本逐格 Seek 路点，记录是否到达顶面（G-Maid） |
| `block_probe_report` | 汇总：候选 vs G-Maid 一致率；列出分歧 typeId |

输出格式建议（一行一格，便于贴进 §6）：

```
typeId | isAir | isSolid | isLiquid | tags | P0 | P1 | S0 | S1 | G-Maid-support | G-Maid-pass
```

---

## 6. 结果记录（测完填）

### 6.1 API 能力

| API | 本环境有？ | 备注 |
| --- | --- | --- |
| `Block.isAir` | **是** | |
| `Block.isSolid` | **是** | **≠「完整碰撞/可站」**（见 6.1b） |
| `Block.isLiquid` | **是** | water=true；lava 未采到（曾被水邻接变成黑曜石） |
| `permutation.getTags()` | **是** | |
| `permutation.getAllStates()` | 探针已打 | 活板门等用 |

#### 6.1b 首轮 matrix 关键发现（2026-09-30）

| 观察 | 含义 |
| --- | --- |
| `glass` / `oak_leaves` / `oak_fence` / `carpet` / `short_grass` / `torch` / `ladder` 均为 **`isSolid=false`** | **不能**用 `S0=isSolid` 当「可支撑」，也 **不能**用 `P1=!isSolid` 当「可穿过」（玻璃不可穿但 !solid） |
| `stone` / `grass_block` 为 `isSolid=true` | 全高实心与 isSolid 一致 |
| `water` / `lava`：`isLiquid=true`，`isSolid=false` | 液体 API 可用；熔岩亦非 solid |
| `oak_trapdoor` resolve 失败 | 本环境用 `minecraft:trapdoor`（+ states）；铁门为 `iron_trapdoor` |
| 水与熔岩相邻 → 曾变成 `obsidian` | 间距 2 后 magmatic 正常 |

#### 6.1c 活板门 / NavMismatch dump（2026-09-30 第二轮 matrix 成功）

| 样本 | typeId | isSolid | 关键 states | 关键 tags |
| --- | --- | --- | --- | --- |
| closed bottom | `trapdoor` | **false** | open_bit=false, upside_down_bit=false | trapdoors, **one_way_collidable**, wood |
| open bottom | `trapdoor` | **false** | open_bit=true | 同上 |
| closed top | `trapdoor` | **false** | upside_down_bit=true | 同上 |
| iron closed | `iron_trapdoor` | **false** | open_bit=false | trapdoors, one_way_collidable |

→ 脚本侧 **无法**用 `isSolid` 区分开/关活板门；开合只在 `open_bit`。一律进 **NavMismatch**，Walk 勿盲信；日后按 `open_bit`/`upside_down_bit` 决定脚本挪位策略。

梯子 / 脚手架 / 压力板：均为 `isSolid=false`，同属特例表采集对象。

#### 6.1d G-Player 目视确认（2026-10-01）

| 方块 | 支撑 | 穿过 | 说明 |
| --- | --- | --- | --- |
| 活板门 **关**（底） | **是**（底部平面，类似地毯） | 视碰撞；当薄地板 | 读 `open_bit=false`；站立面在格内偏下 |
| 活板门 **开** | **侧边可站**（哪一侧由 `direction` 决定） | 开敞侧可过 | 类似「竖起来的薄板」；**不是**全格实心，也不是简单「不可站」 |
| 楼梯 | **可爬**；依附侧边的**顶部台阶可站** | 台阶逻辑 | 行为类比打开的活板门；须读朝向/形状，不能当全高 `isSolid` |
| 压力板 | **否** | **是** | 不可当地板支撑；身位可穿过 |
| 石/玻璃/草/地毯/液体等主干 | 与 §6.2 草案一致 | 与草案一致 | **G-Player 目视 OK，锁定** |
| 栅栏 | **顶部可站** | 身不可进柱 | 见下方 TODO（首版整格仍当不可支撑） |

→ 活板门/楼梯：**状态相关的局部站立面**（薄板/台阶），普通「整格 Support / Passable」不够用 → 保持 **NavMismatch / 特殊边**；首版 Walk 可暂禁或只认「关闭底活板门 ≈ 地毯式支撑」；开活板门与楼梯侧站依赖 `direction`，中长期 **脚本挪位**。  
→ 压力板：定稿 **`isSupport=false`，`isPassable=true`**。  
→ 其余主干样本：**OK，按 §6.2 锁定**。

**TODO（后置，不挡首版 StandableCache）：**

- **栅栏顶部可站，但可站面积随连接状态变化**（`*_fence` / 可能含 `*_wall` 的 `north`/`south`/`east`/`west` 等）。首版：身位不可穿、整格 `isSupport=false`（不把栅栏当地板节点）。后续再细究局部站立面 / ScriptOverride。

**结论（API + G-Player；G-Maid 可选抽测）：**

- `isSolid` **不是**站立面权威，也 **不是**穿过权威（玻璃/树叶/活板门均为 false）。  
- `P1=!isSolid` **否决**；`S0=isSolid` **否决**。  
- **lava/water**：靠 `isLiquid` / typeId，不能靠 solid。  
- 活板门：必须读 `open_bit` + `direction` + `upside_down_bit`；关≈地毯支撑，开≈侧边可站。  
- 楼梯：特殊攀爬/台阶支撑，与开活板门同类处理。  
- 压力板：不支撑、可穿过。  
- 栅栏顶部：可站但几何随连接变 → **后置 TODO**。

### 6.2 定稿公式（**已锁定** — 主干实现；特例见表）

> 主干（石/玻璃/草/液体等）按下列实现；活板门/楼梯等走 NavMismatch，不塞进布尔一刀切。栅栏顶部几何后置。

**isHazard(block)**

```
isLiquid === true
|| typeId 含 lava/fire
|| （可选）typeId === water   // 农作 avoid_water：水当危险不可站
```

**isPassable(block)** — 身位可占（脚/头净空）

```
isAir
|| typeId ∈ 植物薄片白名单（short_grass, tall_grass, *_flower, dandelion, …）
|| typeId ∈ 装饰薄片（torch, *_sign, …）
|| typeId 含 pressure_plate
|| typeId 含 carpet          // 身可过；支撑另见 isSupport
```

明确 **不可穿过（默认）**：`isSolid===true`；`glass` / `*_leaves`；`fence` / `wall`。  
活板门 / 楼梯：**不**用本式一刀切 → NavMismatch。

**isSupport(block)** — 顶面可当站立面（整格近似）

```
(isSolid === true && typeId ∉ 支撑黑名单)
|| typeId ∈ 透明全高白名单（glass, …）
|| typeId 含 carpet          // G-Player：薄支撑，类似关活板门
|| （关闭且底装的活板门：open_bit=false && !upside_down → 视为薄支撑，可并入特例函数）
```

明确 **不可支撑（首版）**：air、liquid、**fence / wall**（整格；顶部可站后置）、短草/花/火把、**压力板**、开着的活板门（整格意义上；侧站另案）。

**NavMismatch / ScriptOverride（强制特例）**

| 类 | 识别 | 人工真值 | 首版策略 | 中长期 |
| --- | --- | --- | --- | --- |
| 活板门关·底 | trapdoor, open=false, !upside_down | 底部可站≈地毯 | 可当薄支撑边 | 脚本贴面 |
| 活板门开 | open=true | 侧边可站（看 direction） | 禁普通 Walk；或 ScriptOverride | 脚本改位置 |
| 楼梯 | *_stairs | 可爬；侧顶可站 | 禁或特殊 Climb 边 | 脚本/特殊边 |
| 压力板 | pressure_plate | 不支撑、可穿过 | Support=false Passable=true | — |
| 梯子/脚手架 | ladder / scaffolding | 待补目视 | 暂禁或特例 | 脚本 |
| **栅栏顶部** | `*_fence`（+ 可能 wall） | 顶部可站；面积随连接变 | **整格 Support=false**；不生成栅栏顶节点 | **TODO：按连接状态细究局部站立面** |

| 谓词 | 选用方案 ID | 最终公式 | 例外名单 |
| --- | --- | --- | --- |
| isPassable | P-whitelist | 见上；+pressure_plate | 活板门/楼梯→Mismatch |
| isSupport | S-hybrid | solid∪glass∪carpet；关底活板门可选 | fence/wall 整格否；压力板否；栅栏顶 TODO |
| isHazard | H-liquid | isLiquid ∪ lava/fire | 水可配置 |

### 6.3 与 G-Maid 一致率

| 集合 | 样本数 | 与定稿一致 | 已知分歧 |
| --- | --- | --- | --- |
| 支撑矩阵 | G-Player 主干 OK | 锁定 §6.2 | 栅栏顶后置 |
| 穿过矩阵 | G-Player 主干 OK | 锁定 §6.2 | — |
| 组合站立 | 推导 | isSupport∧Passable(foot/head)∧!Hazard | — |

**通过标准：**

- 主干全高方块 + 空气 + 水/岩浆：按 §6.2 实现  
- 半砖 / 楼梯 / 地毯 / 雪 / 活板门：边界进 NavMismatch 或特例，不并存多套启发式  
- `StandableCache` **只实现这一套**

---

## 7. 定稿后如何用进寻路

```
isPassable  → 脚/头净空、Gap 轨迹采样
isSupport   → 地板、空谷「中间有踏脚」
isStandable → A* 节点
Walk 边     → 两端 isStandable 且同 y、四向相邻
```

与原版 AI 仍可能有个别分歧：Walk 执行失败时走 Task7 Fail + 不可达缓存，不在本前置阶段追求 100% 边角一致。

---

## 8. 工作顺序

1. [x] 实现 §5 探针（`api` + `dump` + 矩阵）  
2. [x] 跑 §4 矩阵，填 §6（G-Player；G-Maid 可选未做）  
3. [x] 定稿公式写进 huh + `blockPredicates` / `StandableCache`  
4. [x] 探针代码归档 → [Phase0a-探针归档](./Phase0a-探针归档/README.md)  
5. [ ] 进入四类边 / 冲量标定 / A\*（实现计划 Phase 0b / 1）

**后置：** 栅栏顶部可站面积随连接状态变化。

---

## 9. 不做

- 精确方块碰撞网格重建（除非 API 直接给出）  
- 对模组方块一次穷举（定稿后按「默认同 isSolid + 例外表」扩展）  
- 本阶段实现完整 A\* / Farm 接线
