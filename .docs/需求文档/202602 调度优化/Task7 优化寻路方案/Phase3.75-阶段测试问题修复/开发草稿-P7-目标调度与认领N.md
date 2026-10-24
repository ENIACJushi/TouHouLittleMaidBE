# P7：目标调度与认领 N（多格任务队列）

> 承接已恢复的 `开发草稿-P3-目标调度.md`（历史梳理 + H0～H4 待拍板清单）。  
> 本文件给出**推荐实现方案**与分期；常数若需改，按仓库规则请示后再改。

## 1. 目标

1. **一次认领多格**：女仆出发前预占最近若干作物/空地，减少双女仆扫→锁之间的竞态。  
2. **多格目标处理**：占住的格排成队列；`follow` 完成后收/种，再对下一项继续 `follow`，不必每格都等下一次 3s/9s 心跳重扫。  
3. **勿恢复农作目标实体**：继续坐标 + `cellClaims` + `Path.follow`。

**硬约束：凡正式收/种，必须先经 `Path.follow`（含已贴身格）。**  
禁止「判定 near 就直接 `acquireAt`」——会未看向目标就收割。`onSchedulePulse` 里「完成通知丢失」的 near 兜底可保留，但不作为队列连做的主路径。

非目标：把多格编进一条 Path 多途经「逛田路线」（作物中途消失、场变更时难维护）。

## 2. 现状（相对 P3 稿）

| 项 | 现状 |
| --- | --- |
| 占用 | `cellClaims`：1 女仆 × 1 格 |
| 任务 | DP `thlm:farm_job`：单任务 JSON |
| 派出 | `assignNext` 锁 1 格 → `followResult` → `onFollowComplete` 再扫再派 |
| 近距 | 注释已要求先 follow；密田吞吐靠完成回调后再派，仍可能空等整次 search |
| 路径 | 选点与出发已共用一次 `reversiblePathResult`（P3 的 M1 已满足） |
| H0 收割优先 | P3 称已落地；**请核对** `Farm.assignNext` 排序是否仍含同距 `harvest > plant`（若丢失则本项一并修） |

CropRoute（瓜/甘蔗/可可）与 Farm 同构，P7 **先 Farm，再抽共用或跟抄**。

## 3. 方案对比

| 方案 | 做法 | 优点 | 缺点 |
| --- | --- | --- | --- |
| A | 仅预占 N，仍只 follow 当前 1；其余占着不派 | 改动小、防抢 | 占坑不干活；完成仍要重扫才能跟下一项 |
| B（推荐） | **预占 N + 任务队列**；每项都 `follow` → `acquire`；完成后对下一项再规划再 `follow` | 对齐「一次认领 + 多格」；朝向/Seek 与现链路一致 | 贴身格也多一次短 follow（可接受） |
| C | 一条 Path 串多个作物途经点 | 少几次规划 | 中途作物没了难改路；与现 Executor 单会话语义耦合深 |
| ~~B′~~ | ~~近则跳过 follow 直接 acquire~~ | ~~吞吐高~~ | **否决**：未看向目标就收割 |

**采用 B（每格必 follow）。**

## 4. 推荐设计（B）

### 4.1 数据

```
cellClaims: 不变（格 → maidId）；预占时对队列内每格 claimCell
maid 侧：
  - farm_job：仍表示「当前正在 follow / 等待完成的一项」
  - farm_queue：新增 — 已预占、尚未派出的后续任务
```

建议：`farm_queue` 用 **进程内 `Map<maidId, FarmTask[]>`** 为主（与 `cellClaims` 同命运：脚本重启清空）；可选再镜像到 DP 以便调试。卸载走现有 `releaseOwner` / `markStale` **一并清队列**。

### 4.2 入队（一次认领）

在 `assignNext`（空闲且无 follow）时：

1. 与现逻辑相同过滤：活动圈、种子、`isCellFreeFor`、场 `same`、非 unreachable。  
2. 按距离（及收割优先）取最多 **N** 个候选。  
3. 对这 N 格全部 `claimCell`；队首写入 `farm_job`，其余进 `farm_queue`。  
4. **无论远近**，对队首一律 `reversiblePathResult` + `followResult`（零步/已在终点的路径仍走 follow，由 Executor 完成朝向与 done）。

N 的语义：**预占上限**，不是「必须凑满 N」。不足 N 有多少锁多少。

### 4.3 出队（多格处理）

`onFollowComplete`：

1. `done`：`acquireAt` 当前项 → `releaseCell` 该项。  
2. 从 `farm_queue` 取下一项并校验：仍成熟/仍可种、仍在圈内、仍是自己的 claim；否则丢弃该项并 `releaseCell`，试再下一项。  
3. 有效下一项：写入 `farm_job`，从**当前脚**再 `reversiblePathResult` → **`followResult`（再次，不论 near）**。  
4. 队列空：清 job；非 cancel 时可 `collectTasks` 再尝试入队（保持现「干完续派」）。

`fail`：释放当前 claim；队列其余 **默认全部释放**（避免坏路径占一片田）。`cancel` / 切模式：`releaseOwner` + 清队列（与现 abandon 一致）。

### 4.4 卡住 job（并入，原 H3）

有 `farm_job`、未 follow、连续 **P** 次 `onSchedulePulse` 仍未完成 → 作废当前项（release + 出队）并尝试对下一项 **follow**，或重入队。避免「半路丢通知永久停搜」。  
（pulse 的 near 补收仅作通知丢失兜底，不替代队列主路径。）

### 4.5 扫描截断（原 H2，可同 PR 或紧随）

`collectTasks`：扫满 `maxCount` 再按距离砍，改为**按距离维护最近 K**（K 可与 `maxCount` 同一常数，避免两套上限）。成熟优先在排序阶段做（H0）。

### 4.6 明确不做

- 恢复 `thlmt:farm` 等多实体目标堆。  
- Path 一次 follow 多个作物 goal（方案 C）。  
- **跳过 follow 的队列内连收**（会未看向目标）。  
- 用 Seek stamp / `thlmt:value` 做格子所有权（已由 `cellClaims` 承担）。

## 5. 常数（建议默认，改前请示）

| 符号 | 建议 | 依据（非特例拟合） |
| --- | --- | --- |
| N 预占 | **5** | 小于现扫描上限 25；约覆盖贴身一圈作业量，又避免一人锁半田 |
| 卡住 pulse 次数 P | **3** | 约 3×调度步（现约 3s/步 → ~9s），与正式 search 周期同量级 |

（已取消「每拍近距连做上限」——不再有无 follow 连做。）

若你指定其它 N / P，以你的值为准。

## 6. 分期落地

| 阶段 | 内容 | 验收 |
| --- | --- | --- |
| P7a | 队列 + 预占 N；完成后续项一律再 follow；abandon/stale 清队列 | 双女仆少撞车；一人连续多格均先朝向再收；无需空等整次 search |
| P7b | 卡住 job 作废后接下一项 follow | 半路丢通知后能恢复 |
| P7c | 扫描最近 K；核对/恢复 H0 收割优先 | 远处成熟不被扫到的空地挤掉 |
| P7d | CropRoute 对齐 | 瓜/甘蔗/可可行为一致 |

## 7. 风险

- **占坑饿死**：N 过大 → 一人锁多、他人无活。靠 N=5 + fail 整队释放 + abandon 清理。  
- **队列陈旧**：作物被玩家收走 → 出队前校验方块状态。  
- **场暂停**：续 follow 时 `classifyFieldClaim` 非 same → 单项跳过并释放该 claim。  
- **贴身短 follow**：零步路径仍进 Executor，依赖现有 done/朝向行为；若零步过快无转头，属 Path/Seek 问题另开，不退回直接 acquire。

## 8. 与文档关系

| 文档 | 关系 |
| --- | --- |
| `开发草稿-P3-目标调度.md` | 历史现状与 H0～H4 清单；**保留只读**（其中「身边连收可跳过 follow」以本 P7 为准否决） |
| `农作链路改进方案.md` §B | 「身边连续收」落实为**连续 follow→acquire**，不是无朝向连砸 |
| Phase3 共享可达场「双女仆靠 Seek stamp」 | **过时**；所有权以 `cellClaims` + 本 P7 预占为准 |

## 9. 落地进度

| 阶段 | 状态 |
| --- | --- |
| P7a | **已实现 + 已测过**（Farm）：`CLAIM_BATCH_N=5`、`farmQueues`、预占+逐格 follow、fail/cancel/abandon 清队列；同距收割优先 |
| P7b～P7d | 未做（卡住作废 / 扫描最近 K / CropRoute） |

形状：无几何约束，按距女仆距离取最近 N（已确认）。

## 10. 代码评审（P7a，测试通过后）

维度：DRY / OCP / DIP / LSP / 最少知识。分级：BLOCKER / MAJOR / MINOR。

### BLOCKER

无。

### MAJOR

无（与方案硬约束一致：队列项均 `tryFollowTask`，无 near 直收主路径；`releaseOwner`/`releaseQueue`/`fail`/`cancel` 释放闭环可核对）。

### MINOR

1. **DRY**：`assignNext` 的 pending 循环与 `tryStartNextFromQueue` 均「出队 → tryFollow → unready/unknown 整队释放」，可抽 `shiftAndFollow` 一类私有过程，减少双处维护。  
2. **LSP / 返回值契约**：`tryFollowTask` 混用 `true|false|"unready"|"unknown"`，调用方必须写 `=== true`；宜改为判别联合（如 `{ ok:true } | { ok:false, reason }`）以免日后漏判。  
3. **DRY**：`taskStillValid` 成熟判定与 `collectTasks` 内成熟循环重复；可抽 `isMatureCropBlock`。  
4. **OCP**：瓜/甘蔗/可可仍单格 `CropRoute`，与 Farm 队列行为不一致，属文档 P7d 技术债，非本轮回归。  
5. **最少知识**：`search` 直接读 `farmQueues.get`；与 `releaseQueue` 并列尚可，若队列状态再增，宜收成 `hasPendingWork(maid)`。

### 结论

**通过。** 可合入；MINOR 不强制本轮改。后续按 P7b～d 推进。
