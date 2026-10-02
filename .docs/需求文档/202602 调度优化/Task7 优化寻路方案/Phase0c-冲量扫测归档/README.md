# Phase0c 冲量扫测 — 代码与日志归档

测完后已从行为包移除；此处保留可复现快照。  
用途：自动生成女仆、多组 `(hx,hy)×trials` 记录落点，拟合水平射程关系，供 `ImpulseTable.resolveImpulse` 反解 hx。

生产冲量：`TouHouLittleMaid_BP/typescripts/src/maid/path/ImpulseTable.ts`（拟合系数见源码 `FIT`）。

## 本轮结论（2026-10-02 平地跑道）

### 首轮（settle+卸 Seek，已弃用）

- 150 组；`SETTLE_AFTER=10`、卸 Seek
- 拟合：`H ≈ 3.98·hx + 0.23·hy + 3.06·hx·hy − 0.11`（RMSE≈0.08）
- 日志：`logs/ContentLog2026-10-02_16-33-05_1.txt`
- 问题：相对 Gap 首触地偏长 ≈0.25，曾用 `firstTouchSolveExtra` 补偿

### 复测（首触地 + Seek=on，现行）

- 150 组完成；`SETTLE_AFTER=0`、挂 Seek+远端 marker
- 拟合：`H ≈ 2.960·hx − 0.082·hy + 3.737·hx·hy + 0.192`（RMSE≈0.095）
- 日志：`logs/ContentLog2026-10-02_19-41-34_1.txt`（搜 `PATHIMP|`）
- 已写入 `ImpulseTable.ts` 的 `FIT`；不再使用首触地额外补偿

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

### 本轮复测改动（相对 2026-10-02 归档）

- **首触地**：`SETTLE_AFTER=0`，`leftGround` 后再 `onGround` 立刻记 IMP（对齐 Gap LAND）。
- **保留 Seek**：spawn 后挂 Seek + 跑道远端 marker + `pursue_via`（对齐 Gap 飞行中 Seek）。
- 启动日志含 `META,start,mode=first_touch,seek=on`。

正式业务勿常驻本探针；日常 Gap 回归用 `path_go`。与 Phase0b 九桶手标、`PathFollow` 永久冒烟分开。

## 已知未决（归档后）

- 连跳末段 **dist=2 平跨** 相对格心仍常欠冲（`along≈−0.25～−0.5`），短距并非偶发。
- 已回退「飞行卸 Seek / DOWN_SOLVE_SCALE」试修；现行：格心瞄准 + 本复测 FIT + 落地清水平动量。
- 后续诊断方案见同级目录 `短距Gap欠冲诊断/README.md`。
