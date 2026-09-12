# 根目录 npm 构建转发设计

日期：2026-09-12

## 目标

在仓库根目录通过 `npm run <script>` 调用各分模块已有构建入口，并在 `.docs/开发README.md` 中文档化全部指令。

## 决策摘要

| 项 | 选择 |
|----|------|
| 入口位置 | 仓库根目录 `package.json` |
| 聚合指令 | 提供 `pack:all`（全量构建 + version + pack）；不提供泛化的 `build` / `build:all` |
| SkinPacksConvertor | 转发 `build:single`（仅网站，不含内置模型包） |
| 依赖安装 | 各模块各自 `npm install`，不引入 workspaces |
| 实现方式 | 薄转发（方案 1） |

## 工作目录约束

MaidGenerator、MemorizableGensokyo、`.tools` 内脚本使用相对路径（如 `../TouHouLittleMaid_BP/...`），依赖 **进程 cwd 为模块目录**。因此根目录不得直接 `node MaidGenerator/main.js`，应使用：

```text
npm run <script> --prefix <模块目录>
```

并在各模块 `package.json` 中提供对应 script。

## 根目录 scripts

| 指令 | 转发目标 |
|------|----------|
| `build:maid` | `MaidGenerator` → `build` → `node main.js` |
| `build:book` | `MemorizableGensokyo` → `build` → `node main.js` |
| `build:skin` | `SkinPacksConvertor` → `build:single` |
| `build:scripts` | `TouHouLittleMaid_BP/typescripts` → `build` → `tsc` |
| `version` | `.tools` → `version` → `node version.js` |
| `pack` | `.tools` → `pack` → `node pack.js` |
| `pack:all` | 依次：`build:maid` → `build:book` → `build:scripts` → `build:skin` → `version` → `pack`（发版前需先手改 `.tools/version.js`） |

## 子模块最小改动

- `MaidGenerator` / `MemorizableGensokyo`：增加 `"build": "node main.js"`
- `.tools`：增加 `version` / `pack` scripts
- `typescripts`：增加 `"build": "tsc"`，并添加 `typescript` 为 `devDependency`（当前未安装）
- `SkinPacksConvertor`：不改

## 文档

- 新建 `.docs/开发README.md`
- 根 `README.md` 增加开发文档链接
- 可选：更新 `.docs/需求文档/202602 调度优化/构建优化.md` 指向落地文档

## 明确不做

- workspaces / 根目录统一依赖
- 聚合 build / release
- 修改各模块构建业务逻辑
- CI / turbo / nx
- 处理 `.tools` 大小写目录并存问题
