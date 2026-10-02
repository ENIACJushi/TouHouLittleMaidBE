# Phase0c 冲量扫测 — 代码与日志归档

测完后已从行为包移除；此处保留可复现快照。  
用途：自动生成女仆、多组 `(hx,hy)×trials` 记录落点，拟合水平射程关系，供 `ImpulseTable.resolveImpulse` 反解 hx。

生产冲量：`TouHouLittleMaid_BP/typescripts/src/maid/path/ImpulseTable.ts`（拟合系数见源码 `FIT`）。

## 本轮结论（2026-10-02 平地跑道）

- 150 组完成（`hx∈[0.35,0.80]/0.05` × `hy∈[0.30,0.70]/0.10` × 3 trials）
- 拟合：`H ≈ 3.98·hx + 0.23·hy + 3.06·hx·hy − 0.11`（RMSE≈0.08）
- 日志：`logs/ContentLog2026-10-02_16-33-05_1.txt`（搜 `PATHIMP|`）

## 内容

| 文件 | 说明 |
| --- | --- |
| `ImpulseSweepTest.ts` | `path_imp_help/run/stop/dump/dump_trj` |
| `wiring/test-main.ts` | `initImpulseSweep()` 入口片段 |
| `wiring/main.init-snippet.ts` | `main.ts` 调用片段 |
| `logs/ContentLog…` | 本轮 content 日志 |
| `logs/_parse_imp_log.py` | 日志解析辅助（可选） |

## 临时恢复（仅复测时）

1. 将 `ImpulseSweepTest.ts` 放回 `typescripts/test/path/`。
2. 按 `wiring/` 接线 `test/main.ts`、`src/main.ts`。
3. `cd TouHouLittleMaid_BP/typescripts && npx tsc`，重进世界。
4. 站平地朝向跑道：`/scriptevent thlm:test path_imp_run`；抓取控制台 `PATHIMP|`。

正式业务勿常驻本探针；日常 Gap 回归用 `path_go`。与 Phase0b 九桶手标、`PathFollow` 永久冒烟分开。
