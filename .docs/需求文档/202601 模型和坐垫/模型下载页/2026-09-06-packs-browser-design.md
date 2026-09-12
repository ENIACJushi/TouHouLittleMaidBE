# 模型包浏览页设计

日期：2026-09-06  
范围：`SkinPacksConvertor` 同站新增「模型包」浏览视图  
参考：[MaidCustomPack 官网展示逻辑](https://github.com/TartaricAcid/MaidCustomPack)、数据源 [tlmdl.cfpa.team](https://tlmdl.cfpa.team/)

## 目标

在转换器网站内增加基础模型包信息展示、搜索与下载能力，替代目前仅提供下载目录外链的体验。

## 非目标

- 不自动下载 zip、图标或其它资源（运行时不请求 `info.json`；列表由构建时下载并内嵌）
- 不引入后端代理
- 不修改转换器核心转换逻辑
- 不强制与转换器深浅主题系统绑定

## 方案选型

采用**单页双视图**：顶栏切换「转换器 / 模型包」；浏览逻辑放在独立目录 `packs-browser/`，构建时与转换器一并内联进单文件 HTML。

未选双 HTML / 完全外链独立站：与已确认的「同站切换」及现有单文件部署习惯不符。

## 目录与职责

```
SkinPacksConvertor/
  src/                    # 现有转换器（尽量不动）
  packs-browser/          # 新建：模型包浏览（与转换器隔离）
    data/info.json        # 构建时从 tlmdl 下载，打包进网页
    index.ts              # 入口：挂载、载入内嵌列表、绑定 UI
    types.ts              # info.json 类型
    filter.ts             # 分类 / 搜索 / 排序（纯函数）
    ui.ts                 # 渲染列表与控件
    i18n.ts               # 中英文本
    styles.css            # 浏览页独立轻量样式
  scripts/fetch-info-json.js  # 构建前拉取 info.json
  src/index.html          # 顶栏切换 + 浏览视图容器
  webpack / build:single  # 额外打包 packs-browser 并内联
```

边界：

- 转换逻辑不 import `packs-browser`；浏览逻辑不 import 转换器内部模块。
- 同站切换只改变 `#view-convert` / `#view-packs` 的显示；默认仍是转换页。

## 视图切换与数据流

### 顶栏

- 两项：`转换器` | `模型包`
- 切换时只切换视图可见性；语言选择可共用（浏览页读同一语言状态，文案用自己的 `i18n.ts`）
- URL：用查询参数 `?view=packs` 记住当前视图，刷新可还原；缺省或其它值视为 `convert`

### 浏览页数据流

1. **首次进入**「模型包」视图时，从**构建时内嵌**的 `info.json` 载入内存（同步，无网络）。
2. UI 状态：`category`（`all` / `maid` / `chair` / `sound`）+ `query` + `sort`（默认上传时间降序）。
3. `filter.ts` 纯函数产出列表 → `ui.ts` 渲染。
4. 下载：`https://tlmdl.cfpa.team` + `item.url`，仅用户点击时由浏览器导航/打开；不预拉图标、不预加载 zip。
5. 「重置筛选」：重新应用内嵌数据并清空筛选；**不**在运行时重新请求远端。

### 失败与回退

- 内嵌数据缺失/损坏：显示错误 +「重试」+「打开官方目录」外链。
- 单条缺 `zh_cn` / `en_us`：回退另一语言，再回退 `name` / `desc` key 本身。

## 列表 UI、搜索与排序

### 工具栏

- 分类 Tab：全部 / 女仆 / 坐垫 / 声音（对齐 Java 站；`type` 含对应字符串即入选，一条可多类型）
- 搜索框：防抖约 200ms；匹配当前语言下的 name、desc、author 数组、`keyword`（大小写不敏感）
- 排序：上传时间 ↓/↑、文件大小 ↓/↑；默认「上传时间 ↓」
- 结果计数：如「共 169 / 显示 12」
- 「重置筛选」：重新应用内嵌列表并清空筛选

### 列表项

- 标题、描述、作者（逗号拼接）
- 元信息：大小、上传时间、类型 chip、版本号
- 主操作：下载（新标签打开直链）
- **无图标**（避免隐式额外请求）

### 空态与样式

- 无匹配：提示改关键词/分类
- 加载中：简单 loading
- 独立 CSS，布局为简洁列表；不跟转换器主题强绑定

## 数据契约（info.json）

每条记录字段（与现网一致）：

| 字段 | 用途 |
|------|------|
| `name` / `desc` | 语言 key |
| `language.zh_cn` / `language.en_us` | 本地化文案 |
| `author` | 作者字符串数组 |
| `file_size` / `upload_time` / `version` | 元信息与排序 |
| `type` | 分类（可含 `maid` / `chair` / `sound`） |
| `keyword` | 搜索补充 |
| `url` / `file_name` | 下载路径与文件名 |
| `checksum` / `old_version` | 本页不展示（可忽略） |

下载完整 URL：`https://tlmdl.cfpa.team` + `url`（例：`/file/xxx.zip`）。

## 构建

- `npm run fetch:info`：下载 `https://tlmdl.cfpa.team/info.json` → `packs-browser/data/info.json`（失败则回退已有本地文件）
- `npm run build`：先 `fetch:info`，再 webpack（`packs-browser` entry 将 JSON 打进 bundle）
- `build:single` 同时内联转换器与浏览模块进 `SkinPacksConvertor.html`

## CORS / 网络约束

- **运行时不 fetch `info.json`**，避免跨域。列表数据来自构建产物。
- 用户点击下载为导航到文件 URL，通常不受 CORS 限制。
- **硬性约束**：运行时除用户点击下载外，不自动请求 tlmdl 其它资源。

## 验收标准

1. 打开站点默认是转换器；切到「模型包」才载入内嵌列表，Network 中无对 `info.json` 的请求。
2. 分类 / 搜索 / 排序可用；下载仅在点击后出现。
3. 中英切换浏览页文案正确；转换器原功能不受影响。
4. `npm run build:single` 仍产出可用单文件，且构建过程会更新 `packs-browser/data/info.json`。

## 参考实现

Java 官网 [`docs/js/index.js`](https://github.com/TartaricAcid/MaidCustomPack/blob/main/docs/js/index.js)：axios 拉列表、按 `type` 分桶、展示本地化名称/描述/作者/大小/时间。本设计在此基础上增加搜索、排序、同站双视图；数据源在**构建时**从 `tlmdl.cfpa.team` 拉取并内嵌。
