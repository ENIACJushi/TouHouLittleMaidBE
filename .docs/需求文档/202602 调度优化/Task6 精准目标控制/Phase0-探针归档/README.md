# Phase0 仇恨清除探针 — 代码归档

测完后已从行为包移除；此处保留可复现快照。结论见 [Phase0-仇恨清除手动测试.md](../Phase0-仇恨清除手动测试.md)。

## 内容

| 文件 | 说明 |
| --- | --- |
| `SeekHateClearTest.ts` | 脚本探针：`/scriptevent thlm:test seek_hate_*` |
| `debug_fairy.with-probe.json` | 带 `probe:seek_sticky` / `seek_reeval` / `seek_off` 与 `api:reset_target` 的妖精实体快照 |
| `wiring/TestCommandRegister.ts` | 含 `tryInvoke`，供 `CommandManager.test` 转发 |
| `wiring/test-main.ts` | `initSeekHateProbe()` 入口 |
| `wiring/Command.test-snippet.js` | `Command.js` 中 `test()` 转发片段 |
| `wiring/main.init-snippet.ts` | `main.ts` 中无条件调用 `initSeekHateProbe()` |

## 临时恢复（仅复测时）

1. 用 `debug_fairy.with-probe.json` 覆盖 `TouHouLittleMaid_BP/entities/debug_fairy.json`（或 diff 合并探针组/事件）。
2. 将 `SeekHateClearTest.ts` 放回 `typescripts/test/maid/`，按 `wiring/` 接线 `test/main.ts`、`src/main.ts`、`Command.js`、`TestCommandRegister.ts`。
3. `cd TouHouLittleMaid_BP/typescripts && npx tsc`，同步行为包后重进世界。

正式 Seek（Phase 1）勿依赖本探针；清恨规则以 Phase0 结果表为准。
