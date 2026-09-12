
# 开发文档

## 模块一览

+ MaidGenerator：生成女仆实体定义 maid.json
+ MemorizableGensokyo：生成指南书
+ SkinPacksConvertor：生成女仆皮肤和转换器网站
+ TouHouLittleMaid_BP/typescripts：行为包脚本
+ .tools：打包脚本（version、pack）

## 构建

仓库根目录提供统一的 `npm` 指令入口，用于转发各子模块已有构建流程。根目录不安装各模块业务依赖，也不提供一键全量构建。

### 前置条件

1. 安装 [Node.js](https://nodejs.org/)（建议 LTS）
2. 按需进入对应目录执行 `npm install`（见下表）
3. 在**仓库根目录**执行下文的 `npm run …`

| 根目录指令 | 需要先安装依赖的目录 |
|------------|----------------------|
| `build:maid` | 无（仅需 Node） |
| `build:book` | 无（仅需 Node） |
| `build:skin` | `SkinPacksConvertor/` |
| `build:scripts` | `TouHouLittleMaid_BP/typescripts/` |
| `version` | 无（仅需 Node） |
| `pack` | `.tools/`（需要 `adm-zip`） |

示例：

```bash
cd SkinPacksConvertor && npm install && cd ..
cd TouHouLittleMaid_BP/typescripts && npm install && cd ../..
cd .tools && npm install && cd ..
```

### 指令一览

在仓库根目录执行：

| 指令 | 作用 | 主要产物 |
|------|------|----------|
| `npm run build:maid` | 生成女仆实体定义 | `TouHouLittleMaid_BP/entities/maid/maid.json` |
| `npm run build:book` | 生成指南书文本与页数脚本 | `TouHouLittleMaid_RP/texts/*.lang`、`TouHouLittleMaid_BP/typescripts/src/book/MemorizableGensokyoUI.js` 等 |
| `npm run build:skin` | 构建皮肤/模型包转换器单文件网站 | `SkinPacksConvertor/SkinPacksConvertor.html` |
| `npm run build:scripts` | 编译行为包 TypeScript | `TouHouLittleMaid_BP/scripts/` |
| `npm run version` | 按 `.tools/version.js` 写入版本信息 | BP/RP `manifest.json`、lang 等 |
| `npm run pack` | 打包发布 zip（含 BP、RP、转换器网页） | `.tools/` 下生成的发布包 |

等价地，也可在各模块目录内直接运行其本地 script（例如 `SkinPacksConvertor` 内 `npm run build:single`）。

### 全量打包步骤

- 构建女仆实体json → `npm run build:maid`
- 生成指南书内容 → `npm run build:book`（若改了脚本页数相关，则需要 `npm run build:scripts`）
- 构建行为包脚本 → `npm run build:scripts`
- 构建转换器网站 → `npm run build:skin`（注意：这个指令仅构建网站，不会生成内置模型包）
- 应用版本号 -> 修改`.tools/version.js` 中的版本常量 → `npm run version`
- 执行打包 → `npm run pack`
