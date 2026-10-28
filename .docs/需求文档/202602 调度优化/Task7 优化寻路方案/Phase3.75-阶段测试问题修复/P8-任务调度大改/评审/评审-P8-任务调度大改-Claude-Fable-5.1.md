# 评审：P8 任务调度大改

对照稿：`../开发草稿-P8-任务调度大改.md`  
对照实现：`StandField` / `StandableCache` / `blockPredicates` / `reversibleSteps` / `edges` / `budgets` / `activityCircle` / `Farm` / `CropRoute` / `SugarCane` / `Melon` / `Cocoa` / `MaidTarget` / `MaidScheduleEvents` / `FarmBlocks`  
API 对照：`@minecraft/server@2.11.0-beta` 类型声明（`BlockFilter` / `BlockQueryOptions` / `Dimension.getBlocks` / `ListBlockVolume`）、`@minecraft/vanilla-data@1.26.32`  
维度：DRY / OCP / DIP / LSP / 最少知识（得墨忒耳）。分级：BLOCKER / MAJOR / MINOR。

评审模型：**Claude Fable 5.1**  
日期：2026-10-27

本文件只写评审与建议，不改方案正文、不落代码。常数（1200 tick、刷新扫描预算、N=5）维持原稿「待拍板」，本文不另拟数字。

同目录已有两份评审（`评审-P8-任务调度大改.md`、`评审-P8-任务调度大改-Cursor-Grok-4.6.md`）。本文独立对照代码后写成：与它们一致的结论只在「交叉意见」一节按编号认可，不重抄；正文条目是前两份**没有覆盖**、或本文**不同意**的点。编号与前两份互不对应。每条尽量给 `文件:行` 供人工核对。

---

## 结论

方向同意：可达场 + 区块级共享扫描 + 女仆只查缓存。已拍板 1～5 可维持。

但按当前正文开工，有两处会让整个 P8 打偏：

1. **性能模型找错了热点。** 正文把 `getBlock` 开销算在建层上；稳态里最大的消费者是出发找路：`findReversiblePath` 每展开一个落脚点就 `rereadLeaf`，而 `rereadLeaf` 每个叶子都 `new StandableCache`（`StandField.ts:518`），邻居之间的方块读取零复用。P8a 只换建层读口，验收「`getBlock` 次数显著下降」会在基准上通过、在游戏里看不到。
2. **刷新的「邻居」定义与可逆步契约不符。** 可逆步含跨沟（`SprintGap`，水平可达 `GAP_MAX = 4`），正文的局部列刷新只重算「动手格所在列及四邻」，圈 diff 的「邻居变了」没有定义半径。刷新会留下与地形不符的跨沟边，恰是 P6 修过的那类「场对不上」。

其余是契约补洞（`different` 要拆、生命周期入口要跟着占用表走、P7c 实测结论的机制要保住）和几处 API 层面的简化。

---

## 与现状对齐（前两份未列的事实）

| 现状 | 出处 | 对 P8 的含义 |
| --- | --- | --- |
| `rereadLeaf` 每个叶子 `new StandableCache(dim)`；`findReversiblePath` 每拍最多展开 256 个叶子且逐个 reread | `StandField.ts:518`、`:1242`；`budgets.ts` `FIELD_FIND_EXPAND_PER_TICK = 256` | 每次 follow 出发的方块读取量与路径长度成正比，且无跨叶子复用 |
| `scanChunk` 每次被调用（即每拍）`new StandableCache`；一层 256 格，每拍最多新建 64 个叶子 | `StandField.ts:675`、`:686`；`FIELD_BUILD_NODES_PER_TICK = 64` | 密集田一层跨 4 拍建完，每拍重新读边界邻居 |
| `REVERSIBLE_REACH = GAP_MAX` 已导出并注明「重读时只看同一行、同一列、不超过这个距离的邻居」，但全仓库无人引用 | `reversibleSteps.ts:102` | 刷新半径的意图已写下、没有落地；P8 应把它用起来而不是另写「四邻」 |
| `classifyFieldClaim` 把「起点或目标没有叶子」和「两边都有叶子但场不同」都返回 `different` | `StandField.ts:1023-1035` | 闸门若按 `different` 触发刷新，分不清「表可能缺点」和「静态分场」 |
| `BlockFilter` 多个 include 条件之间是**或**：「至少匹配其中一个 include 即不被拒绝」 | `index.d.ts:26081-26087` | 同一类型多个 permutation（可可四个朝向）一次查询即可；`Farm.collectTasks` 现有的「土地 ∪ 成熟作物」一次调用也靠这个 |
| `getBlocks(..., allowUnloadedChunks=true)` 文档明写「只检查体积内已加载区块里的位置」 | `index.d.ts:8432-8437` | 「没返回 = 空气」在区块边缘必错；这不是待实测项，是已声明行为 |
| `getBlocks` 声明会抛 `ArgumentOutOfBoundsError` / `InvalidArgumentError` / `UnloadedChunksError` | `index.d.ts:8443-8449` | 扫描体积越过世界顶 / 底要先钳位 |
| `Cocoa.acquireAt` 无论如何都 `getBlock` 目标格核对 `age`，`direction` 缺省时从方块读 | `Cocoa.ts:23-37` | 正文「补种无需 `getBlock`」不成立 |
| `standsBeside` 只取脚位 `task.y` 与 `task.y-1`，从不把脚位 `task.y+1`（站在瓜上）当候选 | `CropRoute.ts:86-103` | 「瓜顶算落脚点」是新增行为，不是放宽 |
| P7c 的「按列更整齐」来自 `collectTasks` 螺旋列序 + `maxCount = 25` 截断，`assignNext` 再按距离排 | `Farm.ts:488-504`、`:563-565`、`:762-777`；P7 稿 §4.5 / §9 | 整齐的是**候选窗口**，不是排序键；去掉截断后「同距按列序」复现不了 |
| 占用表的生命周期入口有三处 fan-out：`leaveWork` / `onMaidInvalid` / `settleReturned`，各自落到四个工作的 `abandon` / `markStale` / `settle` | `MaidTarget.ts:72-124` | 占用表若迁到任务板，这些入口必须一起迁 |
| `FarmBlocks.getLands()` 按「种子 × 土地」重复 push；土地含 `soul_sand`（下界疣） | `FarmBlocks/main.js:72-79`；`Vallina.js:22` | 喂 `includeTypes` 前去重；「耕地」措辞应为「土地名单」，沉陷特例只对 `farmland` |
| `@minecraft/vanilla-data@1.26.32` 已是 devDependency，`MinecraftBlockTypes` 枚举 1342 个原版 typeId；`src` 未引用；构建为 `tsc` 直出，无打包器 | `package.json`、`tsconfig.json`、`mojang-block.d.ts` | 完整 typeId 名单可以在**构建期**由现有谓词函数生成，不必手写第二份；运行时不能直接 import |
| Bedrock 只有 `minecraft:air` 一种空气；另有 `light_block_0..15`、`structure_void` 等非空气、非 solid 方块 | `mojang-block.d.ts:24`、`:688-703`、`:1154` | `excludeTypes: ["minecraft:air"]` 足够；后者是「nonAir 且不在薄片组 → 不可过」的具体反例 |

---

## BLOCKER

### B-1. 稳态 `getBlock` 热点在出发找路，不在建层；P8a 基准与验收口径错位

**原则：LSP**（验收指标必须度量被替换路径的真实成本）、**DRY**（同一拍同一格被反复读）

正文「现状与痛点 → 逐格读方块」只算了建层：一个区块三层约 2000 次 `getBlock`。这是一次性成本（区块要闲置 60s 且出圈才丢）。稳态成本在别处：

- `Farm.tryFollowTask` / `CropRoute.assignNext` 每次出发都走 `reversiblePathResult` → `findReversiblePath`；
- `findReversiblePath` 每展开一个叶子调用一次 `rereadLeaf`（`StandField.ts:1242`），每拍上限 256 个；
- `rereadLeaf` 每个叶子 `new StandableCache(dim)`（`:518`），然后 `tryStandNode`（3 格）+ `reversibleSteps` → `expandEdges`（四向 Walk / Jump1 / Fall1 / SprintGap + 四斜向）。

按 `edges.ts` 数一遍平地上一个叶子要读的**不同**格子：自身列 4 格（支撑、脚、头、起跳头顶 y+3）；每个正向邻居列 Walk 3 格、Jump1 多 1 格（y+3）、Fall1 多 1 格（y-1）→ 4 × 5；每个斜向列 3 格 → 4 × 3；跨沟探测在平地上第一步就撞到可站踏脚、不再多读。合计约 36 格。相邻叶子的读取范围大量重叠（同一格落在约 3×3 个叶子的足迹里），但缓存是每叶子一份，所以**完全不复用**。一次出发展开 50～100 个叶子就是 1800～3600 次 `getBlock`——每次 `getBlock` 还伴随 `toBlockView` 的 `getAllStates()`、`getTags()` 两次原生调用——而且是每名女仆每次出发都付一次。

正文「与现有方案的关系」明确把 `StandableCache` 留给「一次性搜索」、只让建层改 getBlocks。按此落地，P8a 基准（只测建层）会显示大幅下降，游戏里每拍的方块读取量几乎不变。

**建议：**

1. **P8a 开工前先打计数器**，按来源分三类统计每拍 `getBlock` / `getBlocks` / 迭代位置数：建层（`scanChunk`）、出发找路（`rereadLeaf`）、工作扫描（`collectTasks`）。计数器按 Phase0 探针归档做法，测完归档，不常驻 BP。没有这组数字，P8a 的「显著下降」没有分母。
2. **把「同一拍共享一份 flags 缓存」作为对照组先做**：缓存挂在 `DimRec` 上、`resetBudgets` 时清空（与 `rec.reread` 同生命周期），`rereadLeaf` 和 `scanChunk` 都用它。这正是前两份评审 M10 说的 `BlockFlagsSource` 端口的第一个实现，改动面小，并且能把 P8a 的收益从「缓存复用」里剥离出来，避免归因错误。一个契约要同时写下：同一拍内 `acquireAt` 改了方块（瓜由实心变空气）之后再找路，共享缓存会读到旧值——这与正文「acquire 后局部列刷新」是同一个钩子，应在那里让受影响格失效。
3. **出发时是否还要逐叶子重读，列为待拍板**（见「建议增补的待拍板」1）。P8 引入 60s diff + 局部列刷新后，「每次找路沿途全部重读」与它们职责重叠；但去掉它会改变失效兜底的语义（失效叶子只能靠 follow fail → `unreachableCache` 30s），不能顺手改。
4. P8a 验收改写为：**每拍总方块读取量**（三类之和）下降，而不是「建层 `getBlock` 次数」下降。

---

## MAJOR

### M-1. 刷新的「邻居变了」没有半径定义；局部列刷新的四邻覆盖不了跨沟边

**原则：LSP**（刷新结果必须与 `reversibleSteps` 契约一致）、**DRY**（`REVERSIBLE_REACH` 已声明意图却未实现）

可逆步四种：`Walk`（含斜向）、`Jump1`、`Fall1`、`SprintGap`。前三种只看 8 邻列的 y-1..y+3；`SprintGap` 由 `findNearestGap` 在同轴 2～4 格外找对岸，并要求中间列**没有可站踏脚**、身位净空（`edges.ts:247-313`），再由 `gapReturns` 反向验证。

所以一个格子变化（瓜长出 / 收掉、玩家放一块方块）影响的叶子集合是：

- 8 邻列（Walk / 斜向 / Jump1 / Fall1）；
- **同轴四个方向各 `GAP_MAX = 4` 格内的叶子**（跨沟边的两端，以及因这块方块被挡住、或新开出踏脚而失效的中间列）。

正文：局部列刷新「对动手格所在列及四邻做局部列刷新」；圈 diff「都在但邻居变了 → 走现有 `rereadLeaf`」但没有说怎么知道「邻居变了」。按四邻实现，瓜收掉后 3 格外一对跨沟叶子之间的边不会被重算，场划分与地形不符——P6 修的就是这类症状，只是入口不同。

`reversibleSteps.ts:102` 已经导出 `REVERSIBLE_REACH = GAP_MAX` 并写明用途，但全仓库没有引用。P8 应把它用起来，而不是再写一个「四邻」。

**建议：**

- 定义**脏区**函数：变化格集合 → 8 邻列 ∪ 同轴 `REVERSIBLE_REACH` 内各列，Y 窗口取该层叶子的读取范围（支撑 y-1 到头顶 y+3）。局部列刷新与圈 diff 都用这一个函数（DRY）。
- diff 流程改为：新旧可站集合比对（增删叶子）→ 对「增删格脏区内仍存活的叶子」`rereadLeaf`。不是对整层每个叶子 reread（那等于重建），也不是只对四邻。
- 分级说明：目前 `findReversiblePath` 对途经叶子逐个重读，能在出发时纠正残留的错误边，所以本条先记 MAJOR；**若 B-1 的待拍板选择减少出发时重读，本条升为 BLOCKER**。

---

### M-2. `different` 是两种情况的合并，闸门按它触发会被静态分场永久拉动

**原则：LSP**（闸门输入契约）

这是对前两份评审 B3 的细化，也是分歧点：它们把 `all_different_or_unreach` 归为「可刷新」。

`classifyFieldClaim`（`StandField.ts:1023-1035`）返回 `different` 的两条路：

1. `!left || !right`（`:1025-1027`）：起点或目标**没有叶子**——层建完了但这格不可站，或叶子被删后没补回来。正文说的「瓜被收后瓜下地面重新可站却不入表」就落在这里。
2. 两边都有叶子、`fieldId` 不同（`:1032-1034`）：真正的分场——篱笆外的女仆、台阶上下两片田。

第 1 种值得刷新；第 2 种刷新无益，而且是**稳定状态**：一名站在篱笆外的女仆，每过一次冷却就对 25 个区块做一遍 diff，直到有人挪动她。正文「候选存在但全部场不同 / 走不到 → 视为没有，可以触发（地形可能已变）」把两种混在一起。

**建议：**

- 给 `FieldClaim` 加一值，或在任务板侧拆分：`no_leaf`（可刷新）与 `other_field`（默认不刷新）。拆分点就在上面两段之间，不需要重读方块。
- 若希望 `other_field` 也能偶尔纠正（地形真的变了），方向有两个，需拍板而不是取常数：（a）仅当该女仆自己脚下的 `fieldId` 自上次索要以来变化时允许一次；（b）完全交给其它触发源（`no_leaf`、局部列刷新）。
- `unreachable` 来自 `reversiblePathResult`，发生在认领之后、出发之前；它说明「场说同、实际不通」，是场陈旧的强信号，可刷新，但要和 `unreachableCache` 的 30s ban 配合，别让同一目标在 ban 内反复触发刷新。

---

### M-3. 占用表迁移必须带上生命周期入口，否则出现幽灵占用

**原则：最少知识、LSP**（任务板替代 `cellClaims` 后，释放语义不能缩水）

正文「调度层：任务板……套用 `cellClaims`」只写了索要时怎么用占用表，没写占用怎么释放。现状释放路径不止 `onFollowComplete`：

| 入口 | 位置 | 做什么 |
| --- | --- | --- |
| `MaidTarget.leaveWork(maid, prev)` | `MaidTarget.ts:72-89` | 切模式 → 对应工作 `abandon`：`releaseOwner` + 清 DP job + `Path.cancel` |
| `MaidTarget.onMaidInvalid(id)` | `:95-113` | 死亡 / 拍照 / 魂符：人还在则四个工作各 `abandon`，人不在则各 `markStale(id)` |
| `MaidTarget.settleReturned(maid)` | `:119-124` | 卸载再加载：四个工作各 `settle` 清残留 DP job |
| `Farm.releaseOwner` / `releaseQueue` | `Farm.ts:162-170`、`:201-214` | 连 `farmQueues`、`stuckPulseByMaid` 一起清 |

另外 `Farm` 与三个 `CropRoute` 的占用表**互不相通**，DP job 键各一个（`thlm:farm_job` / `thlm:sugar_job` / `thlm:melon_job` / `thlm:cocoa_job`）。

**建议：**

- 任务板若持有占用，必须暴露与现状同语义的端口：`release(maid, pos)` / `releaseOwner(id)` / `markStale(id)` / `settle(maid)`，并让 `MaidTarget` 的三处 fan-out 改为调用它；迁移清单写进 P8b 验收。
- 若选前两份评审 M2 的方向 A（任务板只做查询 + 就绪确认，占用 / 队列 / follow 留在工作侧），这一条自动满足——这是本文倾向方向 A 的主要理由之一，另两个理由是 P7 硬约束不动、`CropRoute` 尚无队列。
- 不论哪种方向，`cellClaims` 的键目前是 `dimId|x,y,z` 的**动手格**；任务板若按兴趣点 id 或 `standKey` 占用，`nearTask` / `abandonStuckJob` 这些按动手格比对的兜底要同步改，否则 P7b 的卡住作废会对不上键。

---

### M-4. P7c「按列更整齐」的机制是候选窗口，排序键复现不了

**原则：LSP**（相对 P7c 实测结论）

P7 稿 §4.5 / §9：试过按距离取最近 K，实测**按列扫描分配更整齐**，已回退。现状整齐的原因在 `Farm.collectTasks`：

- 外层 `ix` 从女仆脚下按 0, +1, -1, +2, -2… 螺旋**按列**推进（`Farm.ts:488`）；
- 每列一次 `getBlocks`，命中就入候选，**满 25 即停**（`:502-504`、`:563-565`）；
- `assignNext` 再在这至多 25 个里按距离、同距收割优先排序取 5（`:762-777`）。

所以「整齐」来自候选只覆盖离女仆最近的几列，而不是排序。正文「P7c 按列扫描被兴趣点表替代；『按列更整齐』的分配体验在任务板排序里保留（同距按列序）」——任务板从整圈兴趣点里按距离取，等距环上的点来自四面八方，「同距按列序」只影响并列项，整齐度会回到 P7c 否决过的样子。

**建议（需拍板，不在这里定）：**

1. 任务板的候选窗口按列扩张：从女仆所在列开始向两侧逐列取，攒够「大于 N 的窗口」即停，再排序取 N——保留现状机制；
2. 接受行为变化，并在 P8b 验收里把「分配整齐度」从 P7c 的标准里去掉；
3. 把窗口形状做成工作侧注入的策略（Farm 按列，瓜 / 可可按距离），任务板不写死（OCP）。

无论选哪种，`harvest > plant` 的同距优先（`:770-776`）要保留，前两份评审 m1 已提。

---

### M-5. 半刷新层的可见性没有定义；diff 要能断点续做

**原则：LSP**（`layerReady` 契约）、**最少知识**

正文：刷新预算「每拍最多重扫多少个区块层，分到多个 tick 做完；未做完的区块层留在刷新队列里」。但 diff 里的 `createLeaf` 也要消耗 `buildLeft`（否则一层 diff 新增 200 个叶子就把每拍 64 的建层上限打穿），所以**一层 diff 几乎必然跨拍**。跨拍期间这层处于「旧叶子部分已删、新叶子部分未建」的中间态，要回答两个问题：

1. 中间态要不要像首建一样挡住认领？
   - 若把该层重新推进 `pendingY`：`layerReady` 对整个区块返回 false，连没动的层也 `unready`（前两份评审 M5 已指出 `pendingY` 粒度问题）；
   - 若不推进：中间态可被认领，可能认到一个即将被删的叶子 → follow fail → `unreachableCache` 30s。
2. 断点怎么记？`scanChunk` 用 `chunk.cursor`；diff 还要保存「新扫描集合」直到做完，否则下一拍再扫一次等于重复 `getBlocks`。

**建议：** 两种可见性都有代价，列为待拍板；不管选哪个，diff 的断点结构（扫描快照 + 游标）要和 `scanChunk` 共用一套，不要再长一个并列的状态机。另：`removeLeaf` 每次都 `syncBusy`（`StandField.ts:598`），`syncBusy` 遍历全部 writes / probes / plaques；批量删几十个叶子时应攒到本拍末尾合并一次，否则 diff 自己成为新热点。

---

### M-6. 名单导出不要手写第二份：构建期由现有谓词生成

**原则：DRY**（名单唯一来源仍是 `blockPredicates`）、**OCP**

正文：「现在那里是 `includes` 子串匹配，需要提成可复用的导出名单（完整 typeId 列表）」。手工维护一份完整 typeId 列表，等于在 `blockPredicates` 之外再立一个权威，日后两边必漂。

仓库里已经有现成材料：`@minecraft/vanilla-data@1.26.32` 是 devDependency，`MinecraftBlockTypes` 枚举 1342 个原版 typeId（`mojang-block.d.ts`），`src` 尚未引用。

**建议：**

- 写一个**构建期**脚本：遍历 `MinecraftBlockTypes`，对每个 typeId 用现有 `isPlantThin` / `isDecorThin` / `isFenceOrWall` / `isNavMismatch` 等**同一批函数**分组，生成一份带「由脚本生成，勿手改」头的 `.ts` 常量文件提交到 `data/`。谓词仍是唯一权威，名单是它的派生物。
- 运行时不能 `import "@minecraft/vanilla-data"`：构建是 `tsc` 直出，没有打包器，Bedrock 只解析 manifest 声明的 `@minecraft/server*` 模块。
- 生成名单之外的 typeId（模组方块）按前两份评审 B2：必须 `getBlock`，不得判墙。`light_block_*`、`structure_void` 是现成反例——它们非空气、非 solid，今天按 `isPassable` 默认分支可过。
- `BlockFilter` 还有 `includeTags` / `excludeTags`（`index.d.ts:26102`、`:26123`）。`toBlockView` 已经读 `permutation.getTags()`，可以用现有探针先看一遍土地 / 作物 / 栅栏各带什么 tag；若覆盖够，部分分组可以少维护一份 `includeTypes` 名单。这是待测项，不是前提。

---

## MINOR

### m-1. 可可「按 direction 0～3 分四次查询」没有收益

**原则：DRY、最少知识**

`BlockFilter` include 条件之间是或（`index.d.ts:26081-26087`）：四个朝向的 `age=2` permutation 放进**同一个** `includePermutations` 数组，一次 `getBlocks` 就能筛出全部成熟可可。正文分四次查只为了预知 `direction`，但 `Cocoa.acquireAt`（`Cocoa.ts:23-37`）无论如何都要 `getBlock` 目标格核对 `age`，`direction` 缺省时也从那里读——正文「补种无需 `getBlock`」不成立。建议一次查询，`direction` 维持现状在 acquire 时读。

---

### m-2. 「瓜顶算落脚点」是新增行为，不是放宽，要单独验收

**原则：LSP**

`standsBeside`（`CropRoute.ts:86-103`）只取脚位 `task.y` 与 `task.y-1`；脚位 `task.y+1`（站在瓜上）从未是候选。站在目标上动手，与 `goalBlocksAbove` / 终点实体位置 / Arrive 朝向的既有假设都不同（P7 否决近距直收的理由就是朝向）。建议 P8d 把「瓜顶」作为单独用例验收，不与「四邻高低差 1」合并；若 Arrive 对脚下目标给不出朝向，宁可不收瓜顶。

---

### m-3. `getBlocks` 体积越界会抛，复用现有钳位

**原则：DRY**

`getBlocks` 声明会抛 `ArgumentOutOfBoundsError` / `InvalidArgumentError`（`index.d.ts:8443-8449`）。扫描单元 y-1..y+3 在世界顶 / 底会越界；`StandableCache.clampBoundsToDimension` 已经处理过同样的事（含 `heightRange.max` 排他上界），直接用，不要在扫描器里再写一份。

---

### m-4. `getLands()` 去重；「耕地」改「土地名单」

**原则：DRY**

`FarmBlocks.addSeed` 按「种子 × 土地」重复 push（`main.js:72-79`），原版就有 6 个 `minecraft:farmland` + 1 个 `minecraft:soul_sand`。喂 `includeTypes` 前去重。下界疣的土地是 `soul_sand`，不是 farmland，而 `isSunkSupport` 只认 farmland：正文「farm_harvest：落脚点是耕地」应写「土地名单中的支撑格」，沉陷规则只对 farmland。

---

### m-5. 文档数字与措辞

- 「已有落脚点只在 `rereadLeaf`，只能删点、删边」：`rereadLeaf` 发现新增步会 `scheduleMerge`（`StandField.ts:554-565`），即**能加边**；只是不能加点。表述改为「不能新建落脚点」。
- 「一个 16×16 区块建 3 层……合计约 2000 次 `getBlock`」偏低：`expandEdges` 读到 y+3（`jumpHeadClear`）与 y-1（Fall1），三层支撑对应 7 个高度而不是 5 个；缓存每拍新建；跨沟探测会读到区块外 4 格。数字无需精确，但基准要用计数器实测而不是推算（B-1）。
- 「64×64 约 16 个区块（未对齐最多 25）」：活动圈是 ±32 含两端，格心判定后一边 64～65 格，跨 5 个区块是常态，16 只在家坐标恰好对齐且取整时出现。预算、验收都按 25 写。
- 「先排除空气」：Bedrock 只有 `minecraft:air`（无 `cave_air`），`excludeTypes: ["minecraft:air"]` 足够。此处正确，写明以免有人补 `cave_air`。

---

### m-6. 成熟判定三处，要指定一处权威

**原则：DRY**

P8 之后「作物成熟」会有三种写法：就绪确认的 `includePermutations`、`taskStillValid` 的逐状态比对（`Farm.ts:616-625`）、`acquireAt` 的 `permutation.matches`（`:421-424`）。P7 评审 MINOR 3 已提 `isMatureCropBlock`。P8b 接 Farm 时应确定：就绪确认负责「候选筛选」，出队与 acquire 只用一个共享判定函数复核。

---

### m-7. 分组查询可以用上一步的结果当体积

**原则：最少知识**（少做无关的原生扫描）

正文步骤 2「对同一 `vol` 用 `includeTypes` 再查若干次」。`getBlocks` 接受任何 `BlockVolumeBase`，`ListBlockVolume` 也是（`index.d.ts:17068`、`:8451`）；后续分组查询可以把步骤 1 得到的 `nonAir` 列表当体积，原生侧只扫非空气格。是否更快要和 P8a 基准一起测，不预设结论。

---

## 对前两份评审的交叉意见

**一致、不重抄**（编号按 Grok 版）：B1 三态（空气 / 非空气 / 未知）；B2 flags 权威仍是 `evalBlockFlags`；B4 一次扫描两套消费者、`ChunkRec` 不出现兴趣点；B5 圈内首建缺扫描单元；M1 表里只存 candidate；M3 Farm 名单权威是 `FarmBlocks`；M4 规则自带竖直窗口；M5 / M7 预算与 `paused` 风暴；M6 `paused` 入闸门；M8 `refreshColumns` 与工作无关（本文 M-1 的脏区定义适用于它）；M9 入口收成一次 ask；M10 `BlockFlagsSource` 端口（本文 B-1 建议把它提前到 P8a 之前作对照组）；M11 跟随圈；m1 同距收割优先；m3 甘蔗靠 type 变化。

**分歧 / 细化：**

| 项 | 前两份 | 本文 |
| --- | --- | --- |
| B3 `all_different_or_unreach → 可刷新` | 整体可刷新 | 拆 `no_leaf`（可刷新）/ `other_field`（默认不刷新），见 M-2 |
| M2 任务板切分 A / B / C | 列利弊不定 | 倾向 **A**（P8b），理由：生命周期入口不动（M-3）、P7 约束不动、`CropRoute` 无队列；B / C 等 P8d 对齐 CropRoute 后再议 |
| 性能基准 | 建层 `getBlock` 次数 + `getBlocks` 次数 | 加上出发找路这一类，并先做缓存共享对照组，见 B-1 |
| 名单导出 | 「`blockPredicates` 导出能喂 `includeTypes` 的名单」 | 名单由构建期脚本从谓词**生成**，不手写，见 M-6 |
| 刷新半径 | 未涉及 | 8 邻 ∪ 同轴 `REVERSIBLE_REACH`，见 M-1 |

---

## 分期建议（只写增量，在原稿与前两份之上补）

| 阶段 | 增补 |
| --- | --- |
| **P8a 之前** | 三类来源计数器（建层 / 出发找路 / 工作扫描）；`DimRec` 每拍共享 flags 缓存作对照组（含 acquire 后失效钩子）；构建期名单生成脚本 |
| P8a | 验收指标改为「每拍总方块读取量」；`getBlocks` 体积先过 `clampBoundsToDimension`；交付物是不含 kind 的快照 |
| P8b | 倾向方向 A；生命周期端口清单（M-3）；候选窗口形状拍板（M-4）；成熟判定单点（m-6）；可可一次查询（m-1） |
| P8c | `FieldClaim` 拆 `no_leaf` / `other_field`（M-2）；脏区 = 8 邻 ∪ 轴向 `REVERSIBLE_REACH`（M-1）；半刷新层可见性与断点结构拍板（M-5）；`syncBusy` 批量化 |
| P8d | 瓜顶单独用例（m-2）；`getLands()` 去重与 soul_sand（m-4） |

---

## 建议增补的待拍板

1. **出发找路是否仍逐叶子重读**（B-1）：保留 / 只重读起点终点并沿途抽样 / 去掉并靠 follow fail 兜底。选后两者则 M-1 升 BLOCKER。
2. **`different` 拆分**（M-2）：是否拆 `no_leaf` / `other_field`；`other_field` 是否允许「自身场变化时一次」。
3. **候选窗口形状**（M-4）：按列窗口 / 接受变化 / 工作侧注入策略。
4. **半刷新层可见性**（M-5）：挡认领还是允许认领。
5. **名单生成方式**（M-6）：构建期生成 / 手写 / `includeTags` 先探。
6. **瓜顶落脚点**（m-2）：是否纳入，Arrive 朝向如何验收。

常数维持原稿：1200 tick、刷新扫描预算、N=5 改前请示。

---

## 评审记录

| 项 | 结果 |
| --- | --- |
| 评审模型 | Claude Fable 5.1 |
| BLOCKER | 1（B-1 稳态热点在出发找路，P8a 基准口径错位） |
| MAJOR | 6（M-1 刷新脏区半径；M-2 `different` 拆分；M-3 生命周期入口；M-4 候选窗口；M-5 半刷新层；M-6 名单生成） |
| MINOR | 7 |
| 与前两份一致项 | 见「交叉意见」，不重复计数 |
| 方案方向 | 通过（先补 B-1 的计数器与对照组，再按分期落地） |
| 是否按正文直接实现 | 否 |
| 最需先拍 | B-1 待拍板 1；M-2 `different` 拆分；M-4 候选窗口 |
