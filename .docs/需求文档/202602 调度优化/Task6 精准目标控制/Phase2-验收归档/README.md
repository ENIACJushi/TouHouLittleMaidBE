# Phase2 Seek 独占验收 — 代码归档

测完后已从行为包移除；此处保留可复现快照。结论见 [实现计划.md](../实现计划.md) Phase 2（游戏内 PASS：A→marker / B 无恨）。

## 内容

| 文件 | 说明 |
| --- | --- |
| `SeekTest.ts` | 验收脚本：`/scriptevent thlm:test seek_*` |
| `wiring/TestCommandRegister.ts` | 含 `tryInvoke`，供 `CommandManager.test` 转发 |
| `wiring/test-main.ts` | `initSeekAccept()` 入口 |
| `wiring/Command.test-snippet.js` | `Command.js` 中 `test()` 转发片段 |
| `wiring/main.init-snippet.ts` | `main.ts` 中无条件调用 `initSeekAccept()` |

## 临时恢复（仅复测时）

1. 将 `SeekTest.ts` 放回 `typescripts/test/maid/`。
2. 按 `wiring/` 接线 `test/main.ts`、`src/main.ts`（`initSeekAccept`）；`Command.js` / `TestCommandRegister` 若已保留 `tryInvoke` 可无需覆盖。
3. `cd TouHouLittleMaid_BP/typescripts && npx tsc`，同步行为包后重进世界。

正式业务只依赖 `EntityMaid.Seek` 门面，勿把本验收常驻进包。
