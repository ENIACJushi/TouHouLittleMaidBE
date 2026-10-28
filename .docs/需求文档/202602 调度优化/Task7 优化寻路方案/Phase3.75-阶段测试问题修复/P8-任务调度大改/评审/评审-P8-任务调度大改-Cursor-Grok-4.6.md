# 评审：P8 任务调度大改

对照稿：`../开发草稿-P8-任务调度大改.md`  
对照实现：`StandField` / `StandableCache` / `blockPredicates` / `Farm` / `CropRoute` / `FarmBlocks` / `activityCircle` / `budgets` / `MaidTarget` / `MaidScheduleEvents`  
维度：DRY / OCP / DIP / LSP / 最少知识（得墨忒耳）。分级：BLOCKER / MAJOR / MINOR。

评审模型：**Cursor Grok 4.6**  
日期：2026-10-27

本文件只写评审与建议，不改方案正文、不落代码。常数（1200 tick、刷新扫描预算、N=5）仍按原稿「待拍板」，此处不另拟合。

同目录另有一份 `评审-P8-任务调度大改.md`。本文件是独立对照代码后的评审，结论方向一致处会收敛，不重复抄写；本文件多出来的条目，是对照实现后认为原稿还必须补的契约。

---

## 结论

方向正确：**可达场 + 区块共享扫描 + 女仆只查缓存**，能同时打到多女仆重复扫、空田按人节流、落脚点只建不补。三层拆分、刷新方案 A、不订阅方块事件、瓜蒂不查朝向，这些已拍板项建议维持。

**不宜按当前正文直接开工 P8a，更不宜在契约补齐前让 P8b 退场 `collectTasks`。**

正文把「一次 getBlocks 扫描」同时写成了建层算法、兴趣点生产线和刷新触发器。对照现实现，有几处**契约互相打架**；还有一处架构缺口：兴趣点跟着已建层走，但圈内首建没有扫描单元。按字面实现，P8a「与旧路径一致」和 P8b「同一块田只扫一次」会对不上。

没有 100% 证据的只给方向，不指定唯一做法。

---

## 与现状对齐（评审前提）

这些是代码里已经成立、方案必须接住的事实，不是新需求。

| 现状 | 对 P8 的含义 |
| --- | --- |
| `StandNode` 存**支撑格**；`Farm.goalStandOfTask` 是作物格 `y-1` | `InterestPoint.standKeys` 必须是支撑格，不能是脚位或动手格 |
| `scanChunk` 按格 `createLeaf`，合并结果依赖访问顺序 | P8a 验收不能要求「场编号数字相同」，只能要求连通分量相同 |
| `rereadLeaf` / `reversibleSteps` / `expandEdges` 都走 `StandableCache.getFlags` | 扫描快照必须能替换这套读口，不能再并存另一套「按 typeId 猜 flags」 |
| `StandableCache.getFlags` 未加载 → `MISSING`（`passable=false`，不当空气） | `getBlocks` 没返回的格**不能**直接当空气 |
| `evalBlockFlags` 对未知方块看 `isSolid`：非 solid 默认可过 | 「nonAir 且不在薄片组 → 不可过」会改变未知方块语义 |
| `layerReady`：`pendingY.length > 0` 则**整块**未就绪，不只当前层 | 圈内首建 / 刷新若把多层推进 `pendingY`，已建层的认领也会变 `unready` |
| `ensureStandHeight` 只请求一点的 `y-1,y,y+1` | 它不是「把活动圈铺满」的扫描单元 |
| 活动圈只有 XZ，没有 Y | 「范围内已建层」可能远多于 3 层；未建的竖直窗口没有默认高度 |
| Farm 已有 `getBlocks(土地 ∪ 成熟 permutation, allowUnloadedChunks=true)` + P7 队列 | P8 不是给 Farm 第一次引入 getBlocks；`collectTasks` 退场前必须先有圈内首建 |
| `FarmBlocks` 按模组 tester 动态装作物 / 土地 / permutation；`landHasSeed` 按土地种类配种子 | Farm 兴趣名单和补种过滤的权威源是 `FarmBlocks`，不是「背包里有没有任意种子」 |
| 甘蔗 `collectTasks` 以脚位为中心上下追 `MAX=3`，并改写搜索 y | 兴趣点若只挂在女仆脚下 3 层，斜坡 / 高差甘蔗会漏 |
| 可可扫描高度是脚位 `+4`～`-1`；建层只保支撑层 `y-1..y+1` | 兴趣点体积若跟落脚点层绑死，会漏高处可可 |
| `CropRoute` 的 `cellClaims` 与 Farm 不互通，且**没有**认领 N 队列 | 任务板不能共用一张占用表；P8d 前不能假装队列语义已对齐 |
| 调度入口有三处（pulse / 9s search / follow 完成） | `SpeedController` 退场后应收敛成一次索要，不要留空转 `runJob` |

---

## BLOCKER

### B1. 「没出现在 nonAir」当作空气 —— 建层正确性

**原则：LSP**（与现 `StandableCache` 契约不一致）

正文扫描步骤 1：不在 `nonAir` 里的格即空气，直接当净空。  
现实现：未加载 / `getBlock` 失败记 `MISSING`，**不当**可过、不当可支撑。

`Farm.collectTasks` 已经用 `getBlocks(..., true)`（第三参即 `allowUnloadedChunks`）。它能在生产路径里跑，是因为命中后再 `getBlock`，读不到就跳过，不会把空洞建成落脚点。P8 若把「没返回」写成空气：

- 未加载格会建成假落脚点；或
- diff 刷新时把真落脚点当成「消失」删掉。

风险节写「需实测」，算法却已经把「缺省 = 空气」写成默认。P8a 验收「同一块地落脚点集合相同」在区块边缘会系统性失败。

**建议（先补契约，再写 P8a）：**

1. 扫描结果分三态：空气 / 非空气 / **未知（未加载或 API 未覆盖）**。
2. 未知格：不 `createLeaf`、不 `removeLeaf`、不写兴趣点；与今天 `MISSING` 一样跳过。
3. `allowUnloadedChunks` 的实测放到 **P8a 开工前**。Farm 现有调用只能证明「这个 API 能跑」，不能证明「没返回 = 空气」。未测之前刷新范围只能扫已加载区块。

---

### B2. 「名单缺项只影响性能」与步骤 3 字面算法矛盾

**原则：LSP**（谓词结果必须与 `evalBlockFlags` 可互换）

风险节：子串盖不住的模组方块在第 3 步逐格 `getBlock`，缺名单只慢不快错。  
步骤 3：「脚 / 头格若在 `nonAir` 且不在薄片组 → 不可穿过，无需读。」

这两句不能同时成立。未知非空气若跳过 `getBlock`，就会把「引擎 `isSolid=false`、今天默认可过」的方块判成墙。

`evalBlockFlags` 还依赖 `Block.isSolid` / `isLiquid` / `isAir`，不是 typeId 的纯函数。按 typeId 缓存 flags 只对「已证明与状态、与实例无关」的类型合法；活板门正文已排除，但默认分支不行。

**建议：flags 的权威来源仍是 `evalBlockFlags`。** getBlocks 只负责缩小「必须 `getBlock` 的集合」。

| 格子 | 做法 |
| --- | --- |
| 确认空气 | 不读，flags = 空气 |
| 已导出名单且无状态 | 可用 typeId 缓存的 `evalBlockFlags` 结果 |
| 特殊组（活板门等） | 必须 `getBlock` |
| 非空气但未入任何组 | **必须 `getBlock`**，不得判不可过 |

P8a 验收应改成：同一块地、同一加载范围内，**可站支撑格集合相同，连通分量相同**（场 id 数字允许因 `getBlocks` 遍历序变化）。

---

### B3. 「找不到可派项」没把「有候选、无就绪」分开

**原则：LSP**（刷新闸门的输入契约不完整）

触发节把未命中分成「没有 / 被占 / 场不同 / unready」。漏了农作里最常见的一种：

- 兴趣点候选在（麦田、空耕地），查询时无一就绪（没熟、没种子、`plantCooldown`、这块土对不上背包里的种子）。
- 这不是地形过期，正文自己也说「无需为等作物长熟而重扫」。
- 按「缓存里找不到可派项」字面，空闲女仆每 60s 会对活动圈 16～25 个区块做 diff。空田痛点只是从「按人慢扫」换成「按圈慢扫」，没有消掉。

被占不刷新是对的；但「全是未成熟 / 全是自己种不了的空地」必须与「表是空的」分开。

**建议：索要结果用判别联合，闸门只吃「表可能过期」的原因。** 示例：

```
AskMiss =
  | { reason: "no_candidate" }             → 可刷新
  | { reason: "all_claimed" }              → 不刷新
  | { reason: "none_ready" }               → 不刷新（熟了靠查询时 permutation）
  | { reason: "none_usable" }              → 不刷新（没种子、土地-种子不配、补种冷却）
  | { reason: "all_different_or_unreach" } → 可刷新
  | { reason: "unready" }                  → 不刷新，等建层
  | { reason: "paused" }                   → 不刷新，等 merge/probe（见 M6）
```

`none_ready` / `none_usable` 与 `no_candidate` 必须在任务板里能区分，不能都叫「未命中」。

---

### B4. 兴趣点规则写进落脚点扫描，依赖方向会反转

**原则：DIP、OCP**

架构节写：工作适配层只注册规则，任务板经导出函数问场，不碰 `DimRec`。这是对的。

同文「使用 getBlocks 优化的扫描」步骤 2 却把作物 / 土地 / 甘蔗 / 瓜 / 瓜蒂 / 可可写进**建层扫描的分组列表**，步骤 4「写落脚点的同时挂兴趣点」。若按此落在 `StandField` / `ChunkRec` 上：

- 寻路基础设施依赖农作种类（DIP）。
- 新工作只能改核心扫描，不能只注册（OCP）。
- `discardIdle` 丢区块时顺带清兴趣点，会把工作缓存的生命周期绑死在场模块私有结构上（最少知识）。

**建议：一次扫描、两套消费者，不要一个函数包办。**

```
ChunkSnapshot          ← 只含坐标分组 + 按需 flags（不含 kind）
    ├─ StandField      ← 只消费可站 / 连边
    └─ InterestIndex   ← 只消费已注册规则 + 快照 +「问场」导出函数
```

- `includeTypes` 的名单 = 谓词导出 ∪ 各规则声明的 typeId（Farm 走 `FarmBlocks`，见 M3）。
- `ChunkRec` 不出现 `InterestPoint`。
- 兴趣点与区块同生共死，用**同一套卸载信号**（例如 `onChunkDiscard(dim, chunkKey)`），兴趣索引自己清，不读 `DimRec`。
- 若任务板只问场导出、从不 `peekStandField`，还要决定谁碰 `chunk.lastUsed`；否则场被 `discardIdle` 丢掉、兴趣点还挂着。

分期也要接得住：P8a 只替换建层读方块，扫描结果要能在 P8b 挂上规则，而不是 P8a 把作物写进 `scanChunk`、P8b 再挖出来。

---

### B5. 兴趣点跟着已建层走，但圈内首建没有扫描单元

**原则：LSP**（`collectTasks` 退场后，覆盖范围必须不缩小）

这是对照实现后认为原稿最缺的一块。

当前链路是两段：

1. `collectTasks` **不依赖**落脚点表，直接按女仆脚下扫方块（Farm：水平 `claimRange`，竖直 `y-2..y+2`）。
2. `assignNext` 才对起点和每个候选调用 `ensureStandHeight`。

P8 把兴趣点改成「建层时顺手标」。后果：

- 表里没有的层，就没有兴趣点。
- 刷新节写「对范围内**已建**的层做 diff」；未建层「按现有 `ensureStandHeight` 首建」。
- `ensureStandHeight(x,y,z)` 只点亮**这一点**的三层，不是把活动圈铺满。
- 女仆第一次进田、或田在圈内但她还没走过：已建层为空 → 任务板 `no_candidate` → 刷新已建层什么都不做 → 首建若只在女仆脚下点一次，圈对面的田进不了表。

按字面实现，P8b「退场 `collectTasks`」会把「先扫后建」收成「没建就看不见」。冷启动和圈内远侧田会系统性漏目标。这不是性能问题，是调度覆盖回归。

圈内首建怎么铺，正文没写死，下面三种都能接，需要拍板，不在这里指定唯一：

| 方向 | 做法 | 利 | 弊 |
| --- | --- | --- | --- |
| 1 | 未命中时，对活动圈覆盖的每个区块，在工作竖直窗口上 `requestLayers`（或等价首建） | 覆盖对齐「圈内可见」 | 一次最多 25 个区块 × 多层；必须和 B3、M5、M6 一起做，否则冷启动会把整圈认领打成 `unready` |
| 2 | 任务板在已建层里查；圈内未建区块单独走「轻量兴趣预扫」（只写兴趣点，不建落脚点），认领时再 `ensureStandHeight` | 冷启动快 | 两套扫描，要防 DRY；未建层的同场判定仍是 `unready` |
| 3 | P8b 仍保留一次圈内 `collectTasks` 作冷启动，只把「重复扫」从热路径拿掉 | 行为最接近现状 | 与「女仆只查缓存」不完全一致，只能当过渡 |

**P8b 验收「同一块田两个女仆只扫一次」之前，必须先写下：圈内未建区域的兴趣点从哪来。** 否则 `collectTasks` 不能退场。

---

## MAJOR

### M1. `InterestPoint.state` 与「查询时确认就绪」双源

**原则：DRY、LSP**

模型里有 `state: "candidate" | "ready"`，同时写就绪在查询时用 `ListBlockVolume` + permutation 筛。  
`farm_plant` 的就绪还依赖**这名女仆**的背包、`plantCooldown`，以及 `Farm.landHasSeed`（这块土接受哪种种子）。这些都不是区块表上的全局状态。

若把 `ready` 写回共享表：作物长熟或换背包会脏。  
若只存 candidate：`state` 字段多余，调用方若当全局 ready 用会错派。

**建议：** 表里只存 candidate（加 `extra`）。就绪是查询视图，按 kind 策略计算，不要落盘。`farm_plant` 的策略入参是女仆，不是方块。

---

### M2. TaskBoard 与 `assignNext` 的职责切在哪；候选池不能先裁成 N

**原则：DRY、DIP、LSP**

正文：任务板「套用 `cellClaims`、活动圈、同场，取最近 N」；P7 队列语义不变。  
现 `Farm.assignNext` 已经做完：空闲、圈、种子、占用、`classifyFieldClaim`、`unreachableCache`、同距收割优先、认领 N、逐格 `follow`。  
`CropRoute.assignNext` 还多了 `standsBeside` / `standDrop` / `goalBlocksAbove`，且**没有**队列。

还有一个比切分更硬的契约：Farm 现在是 **先收最多 25 个候选，再按场过滤后取 5 个**。若任务板只交出最近 5 个就绪点，这 5 个全是 `unready` / `different` / 不可达时，更远的可派项就看不见。N 是认领上限，不是查询窗口。

三种切法，利弊如下（未拍板，不指定唯一）：

| 方向 | 做法 | 利 | 弊 |
| --- | --- | --- | --- |
| A | 任务板 = 缓存查询 + 就绪确认，交出大于 N 的候选池；认领 / 队列 / follow 仍在 Farm、CropRoute | 改动面小，P7 硬约束不动 | 圈 / 同场 / 占用会滤两遍，要抽共享谓词才不违反 DRY |
| B | 任务板负责查询到认领 N；工作只留 `acquireAt` + 规则 | 调度入口能收成一次 `ask` | CropRoute 必须先有队列，否则 N>1 会占坑不干（LSP） |
| C | 任务板产出带 `standKeys` 的候选，工作自己选 stand、认领、follow | 瓜 / 可可多落脚点仍由工作解释 | 「同场」若在两边各做一次，规则会漂 |

**建议至少先拍：**

1. 任务板**不**直接引用 `Farm` / 某个 `CropRoute` 的 `cellClaims`（DIP）。占用用端口：`isFree` / `claim` / `release`。四种工作占用表本来就不互通，全局一张板会串模式。
2. 任务板必须按**当前工作模式**过滤 kind。共享兴趣表可以一张，索要不能把瓜派给耕地女仆。
3. P8b 只接 Farm 时，认领 N 与「每格必 follow」仍走现有 `assignNext` / `tryFollowTask`，不要在任务板里开近距直收。
4. 查询窗口 > 认领 N。窗口大小测完再定，不在方案里先写死。
5. P8d 删 `collect` 之前，CropRoute 要么补上与 Farm 同契约的队列，要么任务板对该类工作 N=1。

---

### M3. 名单有三处权威，Farm 必须继续认 `FarmBlocks`

**原则：DRY、OCP**

正文要把 `blockPredicates` 的子串提成完整 typeId，供 `includeTypes`。这只覆盖**可站谓词**。  
农作 typeId / 成熟 permutation / 「这块土能种哪颗种子」的权威已在 `FarmBlocks`（原版 + 农夫乐事 / 玉米乐事 / 餐厨工艺，按 tester 物品动态装）。`landList` 还会按种子-土地组合重复 push，喂给 `includeTypes` 前必须去重。

若建层扫描再写一份作物 / 土地名单：

- 模组田在兴趣表里消失，但 `acquireAt` / `taskStillValid` 仍认（或相反）；
- 新模组只能改扫描核心。

**建议：**

- 可站：`blockPredicates` 导出「能喂 `includeTypes` 的名单」+「必须 `getBlock` 的特殊组」。
- Farm 兴趣：规则声明 `includeTypes = FarmBlocks.getLands() ∪ 作物 typeId`，就绪 permutation = `getCorpPermutations()`，补种过滤走 `getLand` + 背包，不是「有任意种子」。
- 甘蔗 / 瓜 / 可可：规则自己声明少量原版 id。
- 扫描器只合并「本层已注册规则要的 typeId」，不写死五种 kind。

---

### M4. 兴趣点高度层与可可 / 甘蔗 / 活动圈对不齐

**原则：LSP**（迁移后工作应覆盖原扫描高度）

落脚点首建：`ensureStandHeight` 只请求支撑 `y-1, y, y+1`。  
可可现状：脚位 `+4`～`-1`。  
甘蔗现状：从脚位上下追，并随着找到的甘蔗改写搜索 y，斜坡田靠这个跟上。  
Farm 现状：女仆脚下 `y-2..y+2` 的列。  
活动圈：只有 XZ。

兴趣点「归属层按 `pos` 的区块与高度」没问题；问题是**候选什么时候进表**，以及**刷新扫哪些 Y**。

- 若只在建落脚点层时顺手标：树干上偏高的可可、脚下三层以外的甘蔗 / 梯田进不了表。
- 若「范围内已建层」全刷：女仆走过山坡后，一个区块里的 `scannedY` 可能远多于 3，25 个区块会把刷新预算打爆。
- 正文预算按「约 16～25 个区块 × 已建 3 层」估，这个「3」不是现状上界。

**建议：规则自带「相对本层还要看的 y 偏移」**，快照体积取「可站窗口 ∪ 各规则窗口」的并。P8a 体积可以仍是支撑层窗口；P8d 接可可 / 甘蔗前必须把并集体积和「刷新扫哪些 Y」写进验收。

另：甘蔗落脚点写成「根下方的土」过窄。现状是 `standDrop: 2` 的支撑格（沙、草、泥都有）。规则应认落脚点表，不要认「土」typeId。

---

### M5. `layerReady` 会把「正在建的整块」打成不可认领

**原则：最少知识、LSP**

`classifyFieldClaim` 用的 `layerReady` 是：区块里**只要还有** `pendingY`，这个区块上的点一律 `unready`，包括已经 `scannedY` 的层。

今天能忍受，是因为 `ensureStandHeight` 只点亮女仆脚下和少数目标点，同时处于 `pendingY` 的区块很少。P8 若在未命中时对活动圈铺首建 / 刷新：

- 最多约 25 个区块同时进 `pendingY`；
- 这些区块上已经能走的田也会变成 `unready`；
- 闸门又规定 `unready` 不刷新，只能等预算。

建层预算仍是每拍 64 个新点。25 × 256 × 3 即使只有一部分能站，冷启动也会让整圈认领停住若干拍。这与否决方案 B「整层重建导致认领全 paused」是同一类症状，入口换成了首建。

**建议与 B5 一起拍：**

- 刷新扫层、首建、merge、probe 四份上限继续分开（现 `budgets.ts` 已是这个模型）。
- `layerReady` 是否改成「只看目标那一层是否已在 `scannedY`、且不是当前正在扫的那一层」，这是对 StandField 的行为收紧，要单独验收，不能顺便改。
- 未改 `layerReady` 之前，圈内首建必须限流：同一拍不要把整圈推进 `pendingY`。
- 局部列刷新与圈 diff 走同一套 diff 函数（DRY），但局部列**插队**，体积封顶为「动手格列 + 四邻 × 已建层」。
- 冷却键用 `dim + cx + cz + y层`。正文「每区块 `lastRefreshTick`」和「冷却从该区块层做完起算」不一致。

---

### M6. `paused` 未进入刷新闸门

**原则：LSP**（与现 `FieldClaim` 四值不对齐）

`classifyFieldClaim` 现有 `same | different | unready | paused`。闸门写了前三个，没写 `paused`。  
merge/probe 期间目标场暂停是正常忙碌，再触发圈刷新会叠风暴（见 M5）。

**建议：** `paused` 与 `unready` 一样：不刷新，等预算把牌刷回可认领。

---

### M7. 查询时就绪确认可能比建层更撞 `getBlocks` 上限

**原则：最少知识 / 风险与已拍板 5 冲突**

已拍板 5：构建用不上大体积 / `closest`，不预先实测上限。  
查询时却要把活动圈内一批候选做成 `ListBlockVolume` 再 `getBlocks`。家模式 ±32 的麦田，候选可以到上千格。`ListBlockVolume` 仓库里已有使用（`MultiBlockStructrueManagerV2`），API 可用，但批大小仍未测。

另外：分组分类本身也是多次 `getBlocks`（空气排除 + 薄片 / 危险 / 特殊 / 各兴趣类型）。基准若只数 `getBlock`、不数 `getBlocks` 次数，会低估新路径。

**建议：**

1. 就绪确认按**区块或固定批**切，不要一次塞满圈。
2. 先按距离（及同距收割优先、同距列序）取出大于 N 的前缀再确认。
3. 这一项的上限实测应算 P8b 开工条件，不要沿用已拍板 5。
4. 同一拍多名女仆索要同一圈，确认结果应能共用（DRY）。
5. P8a 基准脚本：旧路径 `getBlock` 次数 / 耗时 vs 新路径 `getBlocks` 次数 + `getBlock` 次数 / 耗时；测完归档，不常驻 BP。

---

### M8. P8c 验收「收瓜后走廊立即走」早于瓜迁移

**原则：LSP**（阶段验收与阶段能力不一致）

局部列刷新写在 P8c，瓜规则在 P8d。P8c 若只给 Farm 的 `acquireAt` 挂钩，瓜仍走 `CropRoute`，走廊问题不会在 P8c 消失。

**方向（二选一，需拍板）：**

1. P8c 验收去掉瓜走廊，只验耕地收后补种改写 + 空田 60s 一刷；走廊放到 P8d。
2. P8c 提供与工作无关的 `refreshColumns(dim, xz列…)`，`CropRoute` 在 `acquireAt` 成功后也调用（得墨忒耳：工作只报「这些列变了」，不碰 `DimRec`）。

方向 2 能更早验证「只建不补」，且不依赖兴趣点 kind。

可可增量回写也要对齐现状：`Cocoa.acquireAt` 收完可能立刻补种 `age=0`。正文「收割 → 删」对可可过粗，应改成「有补种 → 写回 candidate；没豆 → 删」。

---

### M9. SpeedController 退场后，三个调度入口没有收口

**原则：DRY、OCP**

退场 `target_lack` 之后，`search` 里 `system.runJob(collectTasks)` 不再有扫描可做。若 pulse、9s search、`onFollowComplete` 仍各写一遍「索要 + 派」，会留下空 `runJob`，新工作还要再抄入口。

**建议：** 工作侧只留一个 `askAndAssign(maid)`（或任务板 `ask` + 现有 `assignNext`）。  
`onSchedulePulse`：卡住兜底 + 空闲则 ask。  
`onFollowComplete`：队列空则 ask。  
`MaidTarget.search`：可删或变成对 `askAndAssign` 的别名。

缺目标加扫范围（现 `lackmode` 时 `range+10`）随活动圈缓存一起消失。这是行为变化，应写进方案「有意放弃」，不要 silently 消失。刷新范围用活动圈 ±32，相对现状 `claimRange=15` 是**范围放大**，跟随时更明显（M11）。

---

### M10. 连边仍走 `StandableCache` 时，P8a 只换建层读口不够

**原则：DIP、DRY**

正文：`reversibleSteps` 底层取 flags 改为读本次扫描结果。  
现 `reversibleSteps` → `expandEdges(cache)` → `cache.getFlags`；`rereadLeaf` 自己 `new StandableCache`。`rec.reread` 每拍清一次，同一拍同一叶子只重读一次——diff 不能指望对刚 `createLeaf` 的点再 `rereadLeaf`。出发找路仍会 `rereadLeaf`。

若只有 `scanChunk` 改 getBlocks，出发路径仍逐格 `getBlock`，且两套 flags 可能不一致。

**建议：** 先抽「按坐标给 `BlockFlags`」的端口（内存快照实现 + 现 `StandableCache` 实现）。`reversibleSteps` / `rereadLeaf` / 建层只依赖端口。P8a 建层填快照；未覆盖坐标再回退 `getBlock`。不要让 `StandField` 认识 `ListBlockVolume`。

`createLeaf` 里的 `isSunkSupportBlock` 现在每次 `getBlock`、不走 flags 缓存。P8a 快照里已有耕地分组的话，沉陷支撑应走同一端口，不要留第三条读口。

---

### M11. 跟随圈移动时，「按区块冷却」会漏扫也会重复扫

**原则：最少知识**

跟随：圈心是主人脚，主人走一步，活动圈覆盖的区块集合就变。  
只给圈内区块记 `lastRefreshTick` 是对的；但「未命中 → 刷新圈内冷却外区块」在跟随模式下等于沿路刷新区。这与家模式「一块田 60s 一刷」不是同一负载。

未测，只列方向：

1. 跟随与家用同一闸门，接受走一圈多刷新区（实现简单，可能卡）。
2. 跟随只首建新区、不因「未命中」diff 已建层（漏自然生长，靠局部列刷新）。
3. 冷却键加上圈心所在区块，圈心未跨区块则不新开刷新（折中，需拍板，不是拟合常数）。

P8c 写验收前要选定一种，并写「跟随」用例，不要只写家模式空田。

---

## MINOR

### m1. 同距排序丢掉「收割优先」

**原则：LSP**（相对 P7 已落地行为）

P7a 已测：同距 `harvest > plant`。正文只留「同距按列序」。两键应同时在：先距离，同距收割优先，再列序。任务板若统一排序，Farm 策略必须能注入这两键，避免核心写死 Farm 知识（OCP）。

---

### m2. `kind` 写成闭集

**原则：OCP**

`"farm_harvest" | "farm_plant" | ...` 适合文档举例。实现里应为规则 id 字符串 + 注册表。扫描器、任务板、刷新都只对注册表迭代。索要时用「当前工作 → 规则 id 列表」，不要在核心写 `switch (work)`。

---

### m3. 甘蔗「候选即就绪」与「长高靠刷新」

**原则：DRY**

甘蔗从 1 节变 2 节是 typeId 变化（空气 → `reeds`），不是 permutation，必须靠 diff 或局部列。与小麦不同。风险节「冷却期内漏新目标」已覆盖，建议在规则表再标一列「生长靠 permutation / 靠 type 变化」，避免有人给甘蔗也做成熟 permutation 查询。

瓜：不查 `growth` 时，未长满的瓜蒂旁边若已有别人的瓜，会多收一个成熟瓜——已拍板可接受。建议补一句：不查 `growth` 后，**未成熟瓜蒂**旁边的成熟瓜也会入表；与「朝向误判」是同一类，不要事后再加 `growth===7`（那会回到 `getBlock`）。

---

### m4. `standKeys` 跨区块与 `discardIdle`

**原则：最少知识**

兴趣点在 A 块，`standKeys` 指向 B 块。B 被 `discardIdle` 丢掉后，A 上的键变悬空。  
任务板应经导出函数问「这个支撑格还在不在 / 场牌如何」，缺席当 `unready` 或跳过该键，不要读已删 `Leaf`。  
丢 B 时不要让兴趣模块去翻 A 的私有表；靠查询时容错即可（与「不监听外界破坏」一致）。

---

### m5. 文档与实现的用词

- 「1200 tick（60s）」成立（20 tick/s）；不要和 `FIELD_CHUNK_IDLE_MS = 60_000`（墙钟）混成同一个冷却。刷新用 tick，卸载用墙钟，正文应写明两套时钟。`plantCooldown` 也是墙钟 30s。
- 流程图 `claimQueue["cellClaims + P7队列"]` 易读成任务板拥有队列。若选 M2 方向 A，图应改成 `TaskBoard → assignNext`。
- 「64×64 约 16 个区块，未对齐最多 25」正确；刷新预算和首建预算都要按 25 估，验收不要按 16 写死。已建层不要按 3 写死。
- Farm 现用 `claimRange=15` 扫女仆脚下，P8 改扫活动圈 ±32：家模式是放大，跟随且主人远离时中心也会变。这是有意行为变化，应写进方案。

---

## 分期建议（在原稿上补洞，不推翻）

| 阶段 | 原稿 | 建议补上的验收 / 前置 |
| --- | --- | --- |
| P8a | getBlocks 建层；名单导出；基准 | 先有 `BlockFlagsSource` 端口；三态（空气 / 非空气 / 未知）；未知不建不删；验收改为「可站集合 + 连通分量」；`isSunkSupport` 走同一端口；基准含 `getBlocks` 次数；**未加载表现测完再合**；扫描结果是快照，不挂五种兴趣点 |
| P8b | 兴趣表 + 任务板接 Farm | **先拍 B5 圈内首建**；表只存 candidate；就绪按批、可共用；Farm 名单与 `landHasSeed` 来自 `FarmBlocks`；认领 N 仍走现 `assignNext`；查询窗口 > N；同距收割优先保留；实测 `ListBlockVolume` 批大小 |
| P8c | 闸门 + diff + 局部列 | 先定 `AskMiss`（B3）和 `paused`（M6）；冷却键精确到层；先处理 `layerReady` 与整圈 `pendingY`（M5）；P8c 验收是否含瓜走廊要拍板（M8）；加跟随圈移动用例（M11） |
| P8d | 甘蔗 / 瓜 / 可可；删 collect 与 SpeedController | 规则自带竖直窗口；甘蔗认落脚点不认「土」；可可收后按是否补种改写；CropRoute 先对齐队列或 N=1；调度入口收成一次 ask |

P8a 与 P8b 之间不要出现「`scanChunk` 里 `if (wheat)`」。P8a 交付物应是快照，不是挂好的五种兴趣点。

---

## 建议增补的待拍板

原稿待拍板只剩常数。建议把下面这些也标成待拍，避免实现时各写各的：

1. **圈内首建**：B5 的方向 1 / 2 / 3。
2. **任务板切分**：M2 的 A / B / C。
3. **`AskMiss` 分类**：是否采用 B3 的判别联合；`none_usable`（没种子 / 土地不配）是否单独分出。
4. **`layerReady` 是否改成按层**：M5。这是对现网认领契约的收紧，不能顺便改。
5. **P8c 是否包含瓜走廊**：M8 方向 1 或 2。
6. **跟随模式刷新策略**：M11 的 1 / 2 / 3。
7. **就绪确认批大小 / 查询窗口**：测完再定，不在方案里先写死数字。
8. **P8a 验收**：连通分量相同，还是坚持场 id 也相同（后者很可能因 `getBlocks` 遍历序失败）。

常数 1200 tick / 刷新预算 / N=5：维持原稿，改前请示。N=5 已在 P7 落地，P8 任务板不要擅自改。

---

## 可以维持的已拍板

1. 刷新范围用活动圈，不另做「工作半径 15」。注意这是相对现状 `claimRange=15` 的**范围放大**，跟随时更明显（M11）；圈内首建必须另写（B5）。
2. 刷新方式 A（diff），不整层重建。
3. 瓜不查朝向；误收成熟瓜可接受。不要再把 `growth` / `facing_direction` 从后门加回来。
4. 不订阅放置 / 破坏。过期靠 `acquireAt` 校验、出发 `rereadLeaf`、冷却 diff。
5. 构建路径不测 `closest`。但 **查询就绪确认要测批上限**（M7），与这条不冲突。

---

## 评审记录

| 项 | 结果 |
| --- | --- |
| 评审模型 | Cursor Grok 4.6 |
| BLOCKER | 5（B1 未加载当空气；B2 未知方块当墙；B3 刷新触发过粗；B4 扫描依赖反向；B5 圈内首建无扫描单元） |
| MAJOR | 11 |
| MINOR | 5 |
| 方案方向 | 通过（先补契约再分阶段落地） |
| 是否按正文直接实现 | 否 |
| 最需先拍 | B5 圈内首建；B3 `AskMiss`；M2 任务板切分 |
