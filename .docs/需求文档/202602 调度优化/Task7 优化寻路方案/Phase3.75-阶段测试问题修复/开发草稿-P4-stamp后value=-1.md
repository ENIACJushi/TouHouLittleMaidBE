# P4：挂上目标后将 `thlmt:value` 设为 -1

## 状态：**搁置**

**原因：** 在触达 Seek 槽位上限（0..255）之前，实体与寻路负载通常已把游戏卡到不可玩；保留固定上限对性能更友好，也避免 sticky NAT / `persist_time` 与 Task6 reeval 清恨契约的冲突。

**代码：** 不落地。正式 Seek 维持 Task6 定稿（`reevaluate_description: true` + `persist_time: 0`）；Path 追逐全程 stamp，teardown 再 release。

（以下为原方案存档，供日后若要重开时对照。）

---

## 现象 / 诉求（原）

Seek 槽位与目标 stamp 共用 `0..255`。整段追逐都占着 stamp 时，**同时被精准索敌的实体**上限≈256。希望：**锁上目标后立刻把 value 改回 -1**，让 stamp 身份只在「选中瞬间」占用，从而把同时追逐中的实体数量上限拉高（卡顿会先于逻辑上限出现）。

## 约束（Task6 已实测）

| NAT 配置 | `value → -1` 后 |
| --- | --- |
| **reeval**（现行：`reevaluate_description:true` / `persist_time:0`） | ≈0.25s **丢恨** → 不能只靠改属性释放锁 |
| **sticky**（`reevaluate:false` / `persist_time:5`） | 数秒内 **仍咬着** → 锁上后改 -1 可行 |

因此若重开，**必须把正式 Seek NAT 改成 sticky**；清恨仍靠 `quit` / `api:reset_target`。

## 方案对比（原）

| 方案 | 做法 | 优点 | 风险 |
| --- | --- | --- | --- |
| A | 仅脚本 release(-1)，不改 NAT | 改动小 | reeval 下立刻丢目标，不可用 |
| B | sticky NAT + 锁上后 release(-1) + 丢目标时再 stamp | 追逐中 marker 不占 stamp | sticky 与 Task6 清恨契约冲突；`persist_time` 难定 |
| C | B + 锁上后立刻 `Seek.free` | follow 并发也可 ≫256 | 多女仆同 seekId 再 stamp 竞态 |

## 评审摘要（搁置前）

- 未做 early-free 时，并发 follow 仍 ≤256，收益主要是「追逐中 value 不占 stamp」。
- sticky 的 `persist_time` 过短会中段丢恨，过长则像特例常量；与「上限本身有助于性能」的产品判断一致 → **不做更干净**。
