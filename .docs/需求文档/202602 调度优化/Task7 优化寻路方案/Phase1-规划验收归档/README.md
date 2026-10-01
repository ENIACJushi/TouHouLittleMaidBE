# Phase1 规划验收 — 代码归档

测完后已从行为包移除；此处保留可复现快照。  
游戏内 **`path_all` PASS**（2026-10-01：flat / jump1 / fall / gap2 / gap3 / gap4）。  
生产规划 API：`EntityMaid.Path.find` / `canReach`（`maid/path/*`）。

## 内容

| 文件 | 说明 |
| --- | --- |
| `PathPlanTest.ts` | 验收：`/scriptevent thlm:test path_*` |
| `wiring/test-main.ts` | `initPathPlan()` 入口 |
| `wiring/main.init-snippet.ts` | `main.ts` 中无条件调用 `initPathPlan()` |

## 临时恢复（仅复测时）

1. 将 `PathPlanTest.ts` 放回 `typescripts/test/path/`。
2. 按 `wiring/` 接线 `test/main.ts`、`src/main.ts`。
3. `cd TouHouLittleMaid_BP/typescripts && npx tsc`，重进世界。

正式业务勿常驻本验收。
