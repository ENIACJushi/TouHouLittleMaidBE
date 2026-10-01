# Phase0b 冲量标定 — 代码归档

测完后已从行为包移除；此处保留可复现快照。  
游戏内 **九桶 PASS**（2026-10-01：`dist∈{2,3,4}` × `dy∈{-1,0,1}`，单格对岸 + 稳定期无 slip）。  
生产冲量表：`TouHouLittleMaid_BP/typescripts/src/maid/path/ImpulseTable.ts`。

## 定稿表

| 桶 | hx | hy |
| --- | --- | --- |
| 2:0 | 0.44 | 0.42 |
| 2:1 | 0.42 | 0.55 |
| 2:-1 | 0.46 | 0.28 |
| 3:0 | 0.65 | 0.48 |
| 3:1 | 0.55 | 0.62 |
| 3:-1 | 0.6 | 0.32 |
| 4:0 | 0.7 | 0.52 |
| 4:1 | 0.67 | 0.68 |
| 4:-1 | 0.74 | 0.35 |

## 内容

| 文件 | 说明 |
| --- | --- |
| `PathGapCalibTest.ts` | 标定：`path_gap_help/build/try/set/dump`（自动搭地形） |
| `wiring/test-main.ts` | `initPathGapCalib()` 入口 |
| `wiring/main.init-snippet.ts` | `main.ts` 中调用 `initPathGapCalib()` |

## 临时恢复（仅复测时）

1. 将 `PathGapCalibTest.ts` 放回 `typescripts/test/path/`。
2. 按 `wiring/` 接线 `test/main.ts`、`src/main.ts`。
3. 需保留 `TestCommandRegister` 的「首词 + 参数」分发（`path_gap_try 3 1 …`）。
4. `cd TouHouLittleMaid_BP/typescripts && npx tsc`，重进世界。

正式业务勿常驻本标定台；日常 Gap 回归用 `path_go` follow。
