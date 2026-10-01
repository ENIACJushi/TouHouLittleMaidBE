# Phase0a 可站立 / 可穿过探针 — 代码归档

测完后已从行为包移除；此处保留可复现快照。结论见 [Phase0a-可站立与可穿过测试设计.md](../Phase0a-可站立与可穿过测试设计.md) §6；生产公式在 `maid/path/blockPredicates.ts` + `StandableCache.ts`。

## 内容

| 文件 | 说明 |
| --- | --- |
| `BlockProbeTest.ts` | 探针：`/scriptevent thlm:test block_probe_*`（含 LOCKED 对照） |
| `wiring/test-main.ts` | `initBlockProbe()` 入口 |
| `wiring/main.init-snippet.ts` | `main.ts` 中无条件调用 `initBlockProbe()` |
| `wiring/Command.test-snippet.js` | `Command.js` 未知命令提示可改回 `block_probe_help` |

## 临时恢复（仅复测时）

1. 将 `BlockProbeTest.ts` 放回 `typescripts/test/path/`。
2. 按 `wiring/` 接线 `test/main.ts`、`src/main.ts`（`initBlockProbe`）。
3. `Command.js` / `TestCommandRegister.tryInvoke` 一般已保留，无需覆盖。
4. 依赖生产侧 `maid/path/StandableCache`（dump 的 `LOCKED` 行）；勿删 path 模块。
5. `cd TouHouLittleMaid_BP/typescripts && npx tsc`，同步行为包后重进世界。

正式业务只依赖 `maid/path` 谓词与缓存，勿把本探针常驻进包。
