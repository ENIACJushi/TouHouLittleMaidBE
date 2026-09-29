
## 女仆生成器

用于结构化生成女仆 json，减小新增功能的难度

流程：template.js 内的基础 json 经过 main.js 的处理，得到 maid.json；同时将槽位 min/max/step 同步到 BP 脚本 `slots/slots.gen.ts`（不自动 tsc）。

### 模块

- `modules/Skin.js` / `Seek.js`：历史枚举展开（Seek 已改为 Task6 `slot:seek_<n>` 0..255 + `api:reset_target`）
- `modules/slots/`：脚本→JSON **槽位系统**（`slot:<id>_<token>` 原子组件装载/卸载），见仓库文档 `Task2 JSON逻辑迁移/槽位系统-脚本到JSON.md`
- `modules/slots/types.js`：槽位通用 JSDoc 类型（`IntSlotDef` / `IntSlotRuntimeDef` / `EnumSlotDef` 等）
- `modules/slots/sync.js`：build 时写出 `TouHouLittleMaid_BP/typescripts/src/maid/slots/slots.gen.ts`

### 改槽位数值

1. 改 `modules/slots/*.js`（或 `Skin.js` 的 variant 区间）
2. `npm run build` → 更新 `maid.json` + `slots.gen.ts`
3. 需要时再在 typescripts 目录手动 `npx tsc`（本生成器不代劳）
