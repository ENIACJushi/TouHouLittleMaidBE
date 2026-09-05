import cssText from './styles.css';
import { filterAndSortPacks } from './filter';
import { INFO_JSON_URL } from './i18n';
import type { PackCategory, PackInfo, PackSortKey, UiLang } from './types';
import {
  mountPacksChrome,
  renderPacksList,
  type PacksListState,
  type PacksUiRefs,
} from './ui';

type State = {
  packs: PackInfo[] | null;
  loading: boolean;
  error: string | null;
  category: PackCategory;
  query: string;
  sort: PackSortKey;
  lang: UiLang;
};

const STYLE_ID = 'packs-browser-style';
const SEARCH_DEBOUNCE_MS = 200;

let state: State = {
  packs: null,
  loading: false,
  error: null,
  category: 'all',
  query: '',
  sort: 'time_desc',
  lang: 'zh-CN',
};

let refs: PacksUiRefs | null = null;
let visible = false;
let searchTimer: ReturnType<typeof setTimeout> | null = null;
/** 用于忽略过期的 fetch 回调 */
let fetchSeq = 0;

function injectStylesOnce(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = cssText;
  document.head.appendChild(style);
}

function filterOpts() {
  return {
    category: state.category,
    query: state.query,
    sort: state.sort,
    lang: state.lang,
  };
}

function currentListState(): PacksListState {
  if (state.loading) return 'loading';
  if (state.error) return 'error';
  // init 后、首次 show 前：packs 仍为 null，不展示假 loading
  if (!state.packs) return 'ready';
  const filtered = filterAndSortPacks(state.packs, filterOpts());
  return filtered.length === 0 ? 'empty' : 'ready';
}

function rerender(): void {
  if (!refs) return;
  const total = state.packs?.length ?? 0;
  const packs =
    state.packs && !state.loading && !state.error
      ? filterAndSortPacks(state.packs, filterOpts())
      : [];
  renderPacksList(refs, {
    packs,
    total,
    state: currentListState(),
    lang: state.lang,
    filter: filterOpts(),
    errorMessage: state.error ?? undefined,
  });
}

/** 仅允许请求 INFO_JSON_URL；禁止自动拉取其它资源 */
async function fetchInfoJson(force: boolean): Promise<void> {
  if (!force && state.packs !== null) {
    rerender();
    return;
  }

  const seq = ++fetchSeq;
  state.loading = true;
  state.error = null;
  if (force) {
    state.packs = null;
  }
  rerender();

  try {
    const res = await fetch(INFO_JSON_URL);
    if (seq !== fetchSeq) return;
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`.trim());
    }
    const data: unknown = await res.json();
    if (seq !== fetchSeq) return;
    if (!Array.isArray(data)) {
      throw new Error('Invalid info.json: expected array');
    }
    state.packs = data as PackInfo[];
    state.error = null;
  } catch (err) {
    if (seq !== fetchSeq) return;
    state.packs = null;
    state.error = err instanceof Error ? err.message : String(err);
  } finally {
    if (seq === fetchSeq) {
      state.loading = false;
      rerender();
    }
  }
}

function bindEvents(ui: PacksUiRefs): void {
  ui.searchInput.addEventListener('input', () => {
    if (searchTimer !== null) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchTimer = null;
      state.query = ui.searchInput.value;
      rerender();
    }, SEARCH_DEBOUNCE_MS);
  });

  for (const btn of ui.categoryButtons) {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.category as PackCategory | undefined;
      if (!cat) return;
      state.category = cat;
      rerender();
    });
  }

  ui.sortSelect.addEventListener('change', () => {
    state.sort = ui.sortSelect.value as PackSortKey;
    rerender();
  });

  ui.refreshBtn.addEventListener('click', () => {
    void fetchInfoJson(true);
  });

  ui.retryBtn.addEventListener('click', () => {
    void fetchInfoJson(true);
  });
}

function init(root: HTMLElement): void {
  injectStylesOnce();
  refs = mountPacksChrome(root);
  bindEvents(refs);
  // 仅挂载 UI，不立即请求
  rerender();
}

function show(): void {
  visible = true;
  if (state.packs === null) {
    void fetchInfoJson(false);
  } else {
    rerender();
  }
}

function hide(): void {
  visible = false;
}

function setLang(lang: UiLang): void {
  state.lang = lang;
  // 隐藏时只更新状态；下次 show 会带新语言重绘
  if (visible) rerender();
}

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

export { init, show, hide, setLang };
