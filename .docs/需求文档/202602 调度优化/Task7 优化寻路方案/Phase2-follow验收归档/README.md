# Phase2 follow 验收 — 代码与日志归档

测完后已从行为包移除；此处保留可复现快照。  
**`path_acc_all` PASS 6/6**（2026-10-07）：flat / jump1 / fall / gap2 / gap3 / gap4。

生产执行：`EntityMaid.Path.follow`（`maid/path/Executor.ts`）。  
永久冒烟入口保留：`PathFollowTest`（`path_go` / `path_cancel` / `path_status`）。

## 本轮结论

| 用例 | 规划边 | 会话 | 落点 errH | 说明 |
| --- | --- | --- | --- | --- |
| flat / jump1 / fall | 期望类型齐全 | Done | ~1.5～1.9 | 终点触及 `ARRIVE_GOAL_H=2.0`（对齐 pursue≈2.1），提前结束预期内 |
| gap2 / gap3 / gap4 | SprintGap | Done | 0.04～0.13 | 格心级落点；marker 偏置 + 空中 FIT 修正已合入生产 |

日志摘录见同目录 `logs/`（若有）或对话中 `PATHACC|` / `PATHGAP|` 段。

## 内容

| 文件 | 说明 |
| --- | --- |
| `PathFollowAcceptTest.ts` | 一键搭场+follow：`path_acc_all` 等 |
| `wiring/test-main.ts` | `initPathFollowAccept()` 入口片段 |
| `wiring/main.init-snippet.ts` | `main.ts` 调用片段 |

## 临时恢复（仅复测时）

1. 将 `PathFollowAcceptTest.ts` 放回 `typescripts/test/path/`。
2. 按 `wiring/` 接线 `test/main.ts`、`src/main.ts`。
3. `cd TouHouLittleMaid_BP/typescripts && npx tsc`，重进世界。
4. 面向开阔平地：`/scriptevent thlm:test path_acc_all`；抓取 `PATHACC|` / `PATHGAP|`。

正式业务勿常驻本验收；**勿卸**永久 `initPathFollow()`。
