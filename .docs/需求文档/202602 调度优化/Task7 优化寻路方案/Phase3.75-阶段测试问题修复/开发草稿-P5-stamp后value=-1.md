# P5：挂上目标后将 `thlmt:value` 设为 -1

## 现象 / 诉求

Seek 槽位与目标 stamp 共用 `0..255`。整段追逐都占着 stamp 时，**同时被精准索敌的实体**上限≈256。希望：**锁上目标后立刻把 value 改回 -1**，让 stamp 身份只在「选中瞬间」占用，从而把同时追逐中的实体数量上限拉高（卡顿会先于逻辑上限出现）。

## 约束（Task6 已实测）

| NAT 配置 | `value → -1` 后 |
| --- | --- |
| **reeval**（现行：`reevaluate_description:true` / `persist_time:0`） | ≈0.25s **丢恨** → 不能只靠改属性释放锁 |
| **sticky**（`reevaluate:false` / `persist_time:5`） | 数秒内 **仍咬着** → 锁上后改 -1 可行 |

因此本机制 **必须把正式 Seek NAT 改成 sticky**；清恨仍靠 `quit` / `api:reset_target`（quit 事件里已有 `reset_target`）。

## 方案对比

| 方案 | 做法 | 优点 | 风险 |
| --- | --- | --- | --- |
| A | 仅脚本 release(-1)，不改 NAT | 改动小 | reeval 下立刻丢目标，不可用 |
| B（推荐） | sticky NAT + 锁上后 release(-1) + 丢目标时再 stamp | 追逐中 marker 不占 stamp；换点 teleport 仍同一实体 | 卸组必须 reset_target（已有） |
| C | B + 锁上后立刻 `Seek.free` 回收槽 | 连 follow 并发也可 ≫256 | 多女仆同 seekId 再 stamp 竞态；本轮不做 |

## 推荐方案（B）

1. **`MaidGenerator/modules/Seek.js` `makeNat`**  
   - `reevaluate_description: false`  
   - `persist_time: 5`（对齐 Phase0 sticky 探针）  
   - 执行 `npm run build:maid` 重生 `maid.json`。
2. **`Executor`**  
   - 会话字段 `markerStampReleased`。  
   - 每拍 `syncMarkerStamp`：已咬住本会话 marker 且尚未释放 → `Seek.release`；丢失目标 → 再 `stamp(seekId)`。  
   - 换路点只 teleport，不强制重 stamp（sticky 咬同一实体即可）。
3. **不**在本轮 early-free seekId（方案 C 留作后续）；allocate 并发 follow 仍 ≤256。

## 验收

1. FollowAI 锁上后 `thlmt:value === -1`，女仆仍追同一 marker。  
2. 人为 `reset_target` / teardown 后不再残留仇恨。  
3. 丢目标后能再 stamp 并重新锁上。  
4. `build:maid` 后进游戏确认 NAT 为 sticky。
