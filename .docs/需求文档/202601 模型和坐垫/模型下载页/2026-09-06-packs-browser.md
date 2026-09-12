# Packs Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `SkinPacksConvertor` 单页内增加「模型包」浏览视图：展示 / 搜索 / 排序 / 下载 `tlmdl.cfpa.team` 上的模型包，且进入该视图前或未操作时只请求 `info.json`。

**Architecture:** 单页双视图。转换器仍在 `src/`；浏览逻辑独立于 `packs-browser/`（纯函数过滤 + UI 渲染 + 入口控制器）。顶栏切换 `#view-convert` / `#view-packs`，用 `?view=packs` 记忆。webpack 双 entry，`build:single` 内联两个 bundle。

**Tech Stack:** TypeScript、webpack 5（`asset/source` 读 CSS）、现有 `tsx` + Node `assert` 测纯函数、无新运行时依赖（不用 Vue/axios）。

## Global Constraints

- 用户主动操作前仅允许请求 `https://tlmdl.cfpa.team/info.json`，禁止自动拉 zip/图标/其它资源
- `packs-browser` 不得 import `src/convertor/**`；转换器不得 import `packs-browser/**`
- 不引入后端代理
- 中英双语；浏览页独立轻量样式，不强制绑定转换器深浅主题
- 下载 URL：`https://tlmdl.cfpa.team` + `item.url`
- 视图记忆：查询参数 `?view=packs`；缺省为转换器

---

## File Structure

| 路径 | 职责 |
|------|------|
| `SkinPacksConvertor/packs-browser/types.ts` | `info.json` 条目类型与 UI 状态类型 |
| `SkinPacksConvertor/packs-browser/filter.ts` | 分类 / 搜索 / 排序纯函数 |
| `SkinPacksConvertor/packs-browser/i18n.ts` | 浏览页中英文案 + 条目本地化 |
| `SkinPacksConvertor/packs-browser/styles.css` | 浏览视图样式 |
| `SkinPacksConvertor/packs-browser/ui.ts` | 工具栏与列表 DOM 渲染 |
| `SkinPacksConvertor/packs-browser/index.ts` | 挂载、拉数据、状态、防抖、暴露 `window.PacksBrowser` |
| `SkinPacksConvertor/test/packs-browser-filter.ts` | filter 单测 |
| `SkinPacksConvertor/src/index.html` | 顶栏、双视图壳、script 标签 |
| `SkinPacksConvertor/webpack.config.js` | 双 entry + css `asset/source` |
| `SkinPacksConvertor/scripts/build-single-html.js` | 内联两个 bundle |
| `SkinPacksConvertor/package.json` | `test:packs-browser` 脚本 |
| `SkinPacksConvertor/tsconfig.json` | include `packs-browser` |

---

### Task 1: types + filter（TDD）

**Files:**
- Create: `SkinPacksConvertor/packs-browser/types.ts`
- Create: `SkinPacksConvertor/packs-browser/filter.ts`
- Create: `SkinPacksConvertor/test/packs-browser-filter.ts`
- Modify: `SkinPacksConvertor/package.json`（加 script）
- Modify: `SkinPacksConvertor/tsconfig.json`（include `packs-browser/**/*`）

**Interfaces:**
- Produces:
  - `PackInfo`（见下方 types）
  - `PackCategory = 'all' | 'maid' | 'chair' | 'sound'`
  - `PackSortKey = 'time_desc' | 'time_asc' | 'size_desc' | 'size_asc'`
  - `resolveLocalizedText(pack, key, lang): string`
  - `filterAndSortPacks(packs, opts): PackInfo[]`
  - `opts = { category, query, sort, lang: 'zh-CN' | 'en-US' }`

- [ ] **Step 1: 写 types.ts**

```ts
/** tlmdl info.json 单条 */
export type PackInfo = {
  checksum?: number;
  version?: string;
  upload_time: number;
  name: string;
  author: string[];
  desc: string;
  file_name: string;
  file_size: number;
  url: string;
  type: string[];
  language: {
    en_us?: Record<string, string>;
    zh_cn?: Record<string, string>;
  };
  keyword?: string;
  old_version?: number[];
};

export type PackCategory = 'all' | 'maid' | 'chair' | 'sound';
export type PackSortKey = 'time_desc' | 'time_asc' | 'size_desc' | 'size_asc';
export type UiLang = 'zh-CN' | 'en-US';

export type FilterOptions = {
  category: PackCategory;
  query: string;
  sort: PackSortKey;
  lang: UiLang;
};
```

- [ ] **Step 2: 写失败测试 `test/packs-browser-filter.ts`**

```ts
import assert from 'assert';
import { filterAndSortPacks, resolveLocalizedText } from '../packs-browser/filter';
import type { PackInfo } from '../packs-browser/types';

const sample: PackInfo[] = [
  {
    upload_time: 2000,
    name: 'a.name',
    desc: 'a.desc',
    author: ['Alice'],
    file_name: 'a.zip',
    file_size: 100,
    url: '/file/a.zip',
    type: ['maid'],
    language: {
      zh_cn: { 'a.name': '女仆甲', 'a.desc': '描述甲' },
      en_us: { 'a.name': 'Maid A', 'a.desc': 'Desc A' }
    },
    keyword: '明日方舟 arknights'
  },
  {
    upload_time: 3000,
    name: 'b.name',
    desc: 'b.desc',
    author: ['Bob'],
    file_name: 'b.zip',
    file_size: 500,
    url: '/file/b.zip',
    type: ['chair', 'sound'],
    language: {
      zh_cn: { 'b.name': '坐垫乙', 'b.desc': '描述乙' }
    },
    keyword: ''
  },
  {
    upload_time: 1000,
    name: 'c.name',
    desc: 'c.desc',
    author: ['Carol'],
    file_name: 'c.zip',
    file_size: 200,
    url: '/file/c.zip',
    type: ['sound'],
    language: {
      en_us: { 'c.name': 'Sound C', 'c.desc': 'Desc C' }
    },
    keyword: 'voice'
  }
];

assert.strictEqual(resolveLocalizedText(sample[0], 'name', 'zh-CN'), '女仆甲');
assert.strictEqual(resolveLocalizedText(sample[2], 'name', 'zh-CN'), 'Sound C'); // 缺 zh 回退 en
assert.strictEqual(resolveLocalizedText(sample[1], 'name', 'en-US'), '坐垫乙'); // 缺 en 回退 zh

let r = filterAndSortPacks(sample, { category: 'maid', query: '', sort: 'time_desc', lang: 'zh-CN' });
assert.deepStrictEqual(r.map(p => p.file_name), ['a.zip']);

r = filterAndSortPacks(sample, { category: 'all', query: 'arknights', sort: 'time_desc', lang: 'zh-CN' });
assert.deepStrictEqual(r.map(p => p.file_name), ['a.zip']);

r = filterAndSortPacks(sample, { category: 'all', query: 'bob', sort: 'size_desc', lang: 'en-US' });
assert.deepStrictEqual(r.map(p => p.file_name), ['b.zip']);

r = filterAndSortPacks(sample, { category: 'all', query: '', sort: 'time_desc', lang: 'zh-CN' });
assert.deepStrictEqual(r.map(p => p.file_name), ['b.zip', 'a.zip', 'c.zip']);

r = filterAndSortPacks(sample, { category: 'sound', query: '', sort: 'size_asc', lang: 'zh-CN' });
assert.deepStrictEqual(r.map(p => p.file_name), ['c.zip', 'b.zip']);

console.log('packs-browser-filter: ok');
```

- [ ] **Step 3: 跑测试确认失败**

Run: `cd SkinPacksConvertor && npx tsx test/packs-browser-filter.ts`  
Expected: 模块找不到 / 导出不存在而失败。

- [ ] **Step 4: 实现 `filter.ts`**

```ts
import type { FilterOptions, PackInfo, UiLang } from './types';

function packLangMaps(pack: PackInfo, lang: UiLang): Array<Record<string, string> | undefined> {
  if (lang === 'zh-CN') {
    return [pack.language?.zh_cn, pack.language?.en_us];
  }
  return [pack.language?.en_us, pack.language?.zh_cn];
}

/** 按 UI 语言解析 name/desc；缺省回退另一语言，再回退 key */
export function resolveLocalizedText(pack: PackInfo, field: 'name' | 'desc', lang: UiLang): string {
  const key = pack[field];
  for (const map of packLangMaps(pack, lang)) {
    if (map && typeof map[key] === 'string' && map[key]) {
      return map[key];
    }
  }
  return key;
}

function matchesQuery(pack: PackInfo, query: string, lang: UiLang): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = resolveLocalizedText(pack, 'name', lang).toLowerCase();
  const desc = resolveLocalizedText(pack, 'desc', lang).toLowerCase();
  const authors = (pack.author || []).join(' ').toLowerCase();
  const keyword = (pack.keyword || '').toLowerCase();
  return name.includes(q) || desc.includes(q) || authors.includes(q) || keyword.includes(q);
}

export function filterAndSortPacks(packs: PackInfo[], opts: FilterOptions): PackInfo[] {
  const { category, query, sort, lang } = opts;
  let list = packs.filter((p) => {
    if (category !== 'all' && !(p.type || []).includes(category)) return false;
    return matchesQuery(p, query, lang);
  });
  list = list.slice();
  list.sort((a, b) => {
    switch (sort) {
      case 'time_asc': return a.upload_time - b.upload_time;
      case 'size_desc': return b.file_size - a.file_size;
      case 'size_asc': return a.file_size - b.file_size;
      case 'time_desc':
      default: return b.upload_time - a.upload_time;
    }
  });
  return list;
}
```

- [ ] **Step 5: tsconfig include + package script**

`tsconfig.json` 的 `include` 改为：`["src/**/*", "test/**/*", "packs-browser/**/*"]`

`package.json` scripts 增加：

```json
"test:packs-browser": "tsx test/packs-browser-filter.ts"
```

- [ ] **Step 6: 跑测试确认通过**

Run: `cd SkinPacksConvertor && npm run test:packs-browser`  
Expected: 打印 `packs-browser-filter: ok`，exit 0。

- [ ] **Step 7: Commit**

```bash
git add SkinPacksConvertor/packs-browser/types.ts SkinPacksConvertor/packs-browser/filter.ts \
  SkinPacksConvertor/test/packs-browser-filter.ts SkinPacksConvertor/package.json SkinPacksConvertor/tsconfig.json
git commit -m "feat(packs-browser): add pack filter/sort pure functions"
```

---

### Task 2: i18n + 样式

**Files:**
- Create: `SkinPacksConvertor/packs-browser/i18n.ts`
- Create: `SkinPacksConvertor/packs-browser/styles.css`

**Interfaces:**
- Consumes: `UiLang` from `types.ts`
- Produces: `packsT(lang, key): string`；文案 key 至少含：`navConvert`, `navPacks`, `searchPlaceholder`, `catAll`, `catMaid`, `catChair`, `catSound`, `sortTimeDesc`, `sortTimeAsc`, `sortSizeDesc`, `sortSizeAsc`, `refresh`, `loading`, `empty`, `error`, `retry`, `openOfficial`, `download`, `count`, `authors`, `version`, `heroPacksTitle`, `heroPacksDesc`

- [ ] **Step 1: 写 `i18n.ts`**

完整中英字典，`count` 用函数或模板：`共 {total} / 显示 {shown}` / `Total {total} / Showing {shown}`。导出：

```ts
export function packsT(lang: UiLang, key: string, vars?: Record<string, string | number>): string
export function formatFileSize(bytes: number, lang: UiLang): string
export function formatUploadTime(ts: number): string  // YYYY-MM-DD HH:mm:ss，与 Java 站一致
export const INFO_JSON_URL = 'https://tlmdl.cfpa.team/info.json'
export const DOWNLOAD_ORIGIN = 'https://tlmdl.cfpa.team'
export const OFFICIAL_DIR_URL = 'https://tlmdl.cfpa.team/'
```

`formatFileSize`：B / KB / MB，两位小数（对齐 Java `formatFileSize`）。

- [ ] **Step 2: 写 `styles.css`**

覆盖：`.site-nav`、`#view-packs`、工具栏、分类 tab、列表卡片、chip、错误/空态。用简单变量（如 `--pb-bg`, `--pb-text`, `--pb-accent`），**不要**依赖转换器的 `--primary` 等主题变量。列表纵向卡片即可。

- [ ] **Step 3: Commit**

```bash
git add SkinPacksConvertor/packs-browser/i18n.ts SkinPacksConvertor/packs-browser/styles.css
git commit -m "feat(packs-browser): add i18n and styles"
```

---

### Task 3: UI 渲染模块

**Files:**
- Create: `SkinPacksConvertor/packs-browser/ui.ts`

**Interfaces:**
- Consumes: `PackInfo`, `FilterOptions`, `packsT`, `formatFileSize`, `formatUploadTime`, `resolveLocalizedText`, `DOWNLOAD_ORIGIN`
- Produces:
  - `mountPacksChrome(root: HTMLElement): PacksUiRefs`（创建工具栏 + 状态区 + 列表容器的 DOM，返回 refs）
  - `renderPacksList(refs, args)`：根据 packs/total/state/error/loading 重绘列表与文案
  - `PacksUiRefs`：`searchInput`, `categoryButtons`, `sortSelect`, `refreshBtn`, `statusEl`, `listEl`, `retryBtn` 等

- [ ] **Step 1: 实现 `ui.ts`**

要点：
- 每张卡片：标题、描述、作者、大小、时间、类型 chips、版本、`<a target="_blank" rel="noopener noreferrer" href="{DOWNLOAD_ORIGIN}{url}">` 下载（**不要**用 fetch 下 zip）
- `renderPacksList` 在 loading / error / empty / 有数据 四种态切换
- 错误态含「重试」按钮与「打开官方目录」链接（`OFFICIAL_DIR_URL`）
- 分类按钮 `data-category`；排序 `<select>` 的 option value 为 `PackSortKey`

- [ ] **Step 2: 目测导出齐全（无自动化 UI 测）**

确认 `mountPacksChrome` / `renderPacksList` 已导出。

- [ ] **Step 3: Commit**

```bash
git add SkinPacksConvertor/packs-browser/ui.ts
git commit -m "feat(packs-browser): add list and toolbar renderer"
```

---

### Task 4: 入口控制器 `index.ts`

**Files:**
- Create: `SkinPacksConvertor/packs-browser/index.ts`

**Interfaces:**
- Consumes: Task 1–3 全部导出
- Produces: `window.PacksBrowser = { init, setLang, show, hide }`  
  - `init(root: HTMLElement)`：挂载 UI，不立即请求  
  - `show()`：显示后若尚无缓存则请求 `info.json`  
  - `hide()`：仅标记不可见（可不卸载 DOM）  
  - `setLang(lang: UiLang)`：更新语言并重渲染

- [ ] **Step 1: 实现状态机**

```ts
type State = {
  packs: PackInfo[] | null;
  loading: boolean;
  error: string | null;
  category: PackCategory;
  query: string;
  sort: PackSortKey;
  lang: UiLang;
};
```

行为：
1. `show()` 首次：`loading=true` → `fetch(INFO_JSON_URL)` → 成功写入 `packs`；失败写 `error`（CORS/网络原文或简短说明）
2. 再次 `show()`：有缓存则不请求
3. 刷新按钮：清空缓存并强制重新 `fetch`
4. 搜索 input：`input` 事件 200ms 防抖更新 `query` 再 `filterAndSortPacks` + `renderPacksList`
5. 分类 / 排序变更立即过滤
6. **禁止**任何对其它 URL 的自动请求

挂到 window：

```ts
declare global {
  interface Window {
    PacksBrowser: {
      init: (root: HTMLElement) => void;
      show: () => void;
      hide: () => void;
      setLang: (lang: UiLang) => void;
    };
  }
}
window.PacksBrowser = { init, show, hide, setLang };
```

入口文件顶部：`import cssText from './styles.css';` 并在 `init` 时若无 `#packs-browser-style` 则注入 `<style id="packs-browser-style">`。

- [ ] **Step 2: Commit**

```bash
git add SkinPacksConvertor/packs-browser/index.ts
git commit -m "feat(packs-browser): add browser controller and lazy info.json fetch"
```

---

### Task 5: HTML 壳 + 视图切换 + 语言桥

**Files:**
- Modify: `SkinPacksConvertor/src/index.html`

**Interfaces:**
- Consumes: `window.PacksBrowser`
- Produces: 顶栏导航、`#view-convert`、`#view-packs`、`?view=` 同步

- [ ] **Step 1: 调整 DOM 结构**

在 `.page` 内、现有 `header.hero` 之前增加站点导航：

```html
<nav class="site-nav" aria-label="Site">
  <button type="button" id="nav_convert" data-view="convert">转换器</button>
  <button type="button" id="nav_packs" data-view="packs">模型包</button>
</nav>
```

将现有转换器主体（原 `header.hero` + `main.content-grid` + `#error_log`）包进：

```html
<div id="view-convert"> ...原内容... </div>
<div id="view-packs" hidden>
  <header class="packs-hero">
    <h1 id="packs_page_title"></h1>
    <p id="packs_page_desc"></p>
  </header>
  <div id="packs_root"></div>
</div>
```

语言/主题控件：保留在转换器 hero 内；**同时**在浏览页 hero 旁放一套只含语言的控件，或把语言 select 挪到 `site-nav` 右侧共用。推荐：把 `#language_select` 移到 `site-nav`，两视图共用；主题按钮可留在转换器视图内（浏览页不强制主题）。

- [ ] **Step 2: 视图切换脚本（写在现有 inline script 中）**

```js
function getViewFromUrl() {
  const v = new URLSearchParams(location.search).get('view');
  return v === 'packs' ? 'packs' : 'convert';
}
function setView(view) {
  const packs = view === 'packs';
  document.getElementById('view-convert').hidden = packs;
  document.getElementById('view-packs').hidden = !packs;
  // 更新 nav aria-current / active class
  const url = new URL(location.href);
  if (packs) url.searchParams.set('view', 'packs');
  else url.searchParams.delete('view');
  history.replaceState(null, '', url);
  if (packs && window.PacksBrowser) window.PacksBrowser.show();
  else if (window.PacksBrowser) window.PacksBrowser.hide();
}
```

在 `DOMContentLoaded` / 现有 init 末尾：`PacksBrowser.init(document.getElementById('packs_root')); setView(getViewFromUrl());`

在 `setLanguage` / `applyLanguage` 末尾调用：

```js
if (window.PacksBrowser) window.PacksBrowser.setLang(currentLang);
```

并更新 nav 按钮文案（可把 `navConvert`/`navPacks` 加进现有 `I18N`，或从 PacksBrowser 侧在 `setLang` 时改 nav——推荐在 HTML inline I18N 增加两键，避免循环依赖）。

- [ ] **Step 3: 改 packDesc 外链**

将 TLM 下载链接从 `https://tlmdl.cfpa.team/` 改为同页：`?view=packs`（可用 `<a href="?view=packs" id="link_to_packs">`，点击时 `setView('packs'); return false;` 或让浏览器带 query 刷新——优先 JS `setView` 免整页重载）。

- [ ] **Step 4: 增加 script 标签**

在 `SkinConvertor.bundle.js` 旁增加：

```html
<script src="../dist/PacksBrowser.bundle.js"></script>
```

保证在调用 `PacksBrowser.init` 之前已加载（init 放在该 script 之后，或延后到 bundle 后的小脚本）。

- [ ] **Step 5: Commit**

```bash
git add SkinPacksConvertor/src/index.html
git commit -m "feat(packs-browser): wire dual-view shell and language bridge"
```

---

### Task 6: webpack + build:single

**Files:**
- Modify: `SkinPacksConvertor/webpack.config.js`
- Modify: `SkinPacksConvertor/scripts/build-single-html.js`

**Interfaces:**
- Produces: `dist/PacksBrowser.bundle.js`；单文件内联两个 bundle

- [ ] **Step 1: 改 webpack 为多入口**

```js
const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    SkinConvertor: './src/SkinConvertor.ts',
    PacksBrowser: './packs-browser/index.ts'
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  resolve: { extensions: ['.ts', '.js'] },
  module: {
    rules: [
      { test: /\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ },
      { test: /\.css$/, type: 'asset/source' }
    ]
  },
  optimization: { minimize: false }
};
```

- [ ] **Step 2: 改 `build-single-html.js`**

同时匹配并内联：

- `<script src="../dist/SkinConvertor.bundle.js"></script>`
- `<script src="../dist/PacksBrowser.bundle.js"></script>`

任一缺失则 throw。

- [ ] **Step 3: 构建验证**

Run:

```bash
cd SkinPacksConvertor
npm run build
npm run build:single
npm run test:packs-browser
```

Expected:
- `dist/SkinConvertor.bundle.js` 与 `dist/PacksBrowser.bundle.js` 存在
- `SkinPacksConvertor.html` 生成且含两段内联 script
- filter 测试通过

- [ ] **Step 4: Commit**

```bash
git add SkinPacksConvertor/webpack.config.js SkinPacksConvertor/scripts/build-single-html.js
git commit -m "build: bundle packs-browser into single-file site"
```

---

### Task 7: 手工验收（对照 spec）

**Files:** 无必须代码变更（若失败则修 bug 并补 commit）

- [ ] **Step 1: 本地打开**

用浏览器打开 `SkinPacksConvertor/src/index.html`（需先 `npm run build`），或打开生成的 `SkinPacksConvertor.html`。

- [ ] **Step 2: 验收清单**

1. 默认视图为转换器；DevTools Network 无对 `tlmdl` 的请求  
2. 点「模型包」后**仅**出现对 `info.json` 的请求；无 zip/图标  
3. 分类 / 搜索 / 排序 / 计数正常  
4. 点下载才出现对 `/file/...zip` 的导航  
5. 切换中英，浏览页与导航文案正确；转换器仍可用  
6. `?view=packs` 刷新仍停在浏览页  
7. 断网或 CORS 失败时显示错误 + 重试 + 官方目录链接  

- [ ] **Step 3: 若有修复则 commit**

```bash
git commit -m "fix(packs-browser): <具体问题>"
```

---

## Self-Review (plan vs spec)

| Spec 要求 | Task |
|-----------|------|
| 独立 `packs-browser/` | 1–4 |
| 同站双视图 + `?view=packs` | 5 |
| 仅懒加载 `info.json` | 4 |
| 分类 / 搜索 / 排序 / 下载 | 1, 3, 4 |
| 中英 + 独立样式 | 2, 5 |
| webpack + build:single | 6 |
| CORS 错误兜底 | 3, 4 |
| 转换器隔离 / 不改核心转换 | 全程不碰 `convertor/**` |
| 验收标准 | 7 |

无 TBD 占位；类型名在 Task 1–4 一致。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-06-packs-browser.md`. Two execution options:

**1. Subagent-Driven (recommended)** — 每个 Task 派一个新 subagent，Task 间复核，迭代快  

**2. Inline Execution** — 本会话用 executing-plans 按 Task 推进，设检查点  

Which approach?
