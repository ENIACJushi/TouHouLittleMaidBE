# 移动代理探针归档（path_mov / path_proxy / path_pjump）

测完已从行为包卸线；此处保留可复现快照。  
生产路径：`ScriptDrive` + `Executor`（Gap / AI 超时 ScriptFollow）；日常回归 **`path_go`**。

**勿卸** `initPathFollow` / `PathFollowTest.ts`（永久冒烟）。

## 本轮结论（摘要）

| 探针 | 命令前缀 | 真值 / 用途 |
| --- | --- | --- |
| 原版采集 | `PATHMOV\|` / `path_mov_*` | Walk 巡航 ≈0.135；Jump1 `peakVy≈0.42`、`air≈8`（采集日志 1–2） |
| 冲量代理 | `PATHPROXY\|` / `path_proxy_*` | 契约：一次 facing、`mountLook`、`reach_cone`；日志13 |
| 玩家起跳 | `PATHPJUMP\|` / `path_pjump*` | `hy` 默认 0.42（日志11） |

Executor：日志14 正常 Gap；日志15 人为原版卡 via → AI 超时 ScriptFollow → Gap 收尾（现 `ai_timeout`=240 tick）。

权威方案：同级目录 `代理运动实现方案.md`、`实验设计.md`；代表性日志仍在同级 `采集日志*.log`。

## 内容

| 文件 | 说明 |
| --- | --- |
| `MovementCaptureTest.ts` | `path_mov_help/run/stop/dump` |
| `MovementProxyTest.ts` | `path_proxy_help/run/tune/stop/dump` |
| `PlayerJumpCaptureTest.ts` | `path_pjump_help/pjump/stop/dump` |
| `wiring/test-main.ts` | `test/main.ts` 入口片段 |
| `wiring/main.init-snippet.ts` | `src/main.ts` 调用片段 |

## 临时恢复（仅复测时）

1. 将三个 `*Test.ts` 拷回 `TouHouLittleMaid_BP/typescripts/test/path/`。
2. 按 `wiring/` 接线 `test/main.ts`、`src/main.ts`。
3. `cd TouHouLittleMaid_BP/typescripts && npx tsc`，重进世界。
4. `/scriptevent thlm:test path_mov_help` / `path_proxy_help` / `path_pjump_help`。

正式业务勿常驻本探针。
