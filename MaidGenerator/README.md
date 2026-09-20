
## 女仆生成器

用于结构化生成女仆 json，减小新增功能的难度

流程：template.js 内的基础 json 经过 main.js 的处理，得到 maid.json

### 模块

- `modules/Skin.js` / `Seek.js`：历史枚举展开
- `modules/slots/`：脚本→JSON **槽位系统**（`slot:<id>_<token>` 原子组件装载/卸载），见仓库文档 `Task2 JSON逻辑迁移/槽位系统-脚本到JSON.md`
