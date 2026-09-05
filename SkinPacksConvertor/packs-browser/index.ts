import cssText from './styles.css';
import embeddedInfo from './data/info.json';
import { filterAndSortPacks } from './filter';
import { packsT } from './i18n';
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

function listStateFor(filteredLen: number): PacksListState {
  if (state.loading) return 'loading';
  if (state.error) return 'error';
  // init 后、首次 show 前：packs 仍为 null，不展示假 loading
  if (!state.packs) return 'ready';
  return filteredLen === 0 ? 'empty' : 'ready';
}

function rerender(): void {
  if (!refs) return;
  const opts = filterOpts();
  const total = state.packs?.length ?? 0;
  const packs =
    state.packs && !state.loading && !state.error
      ? filterAndSortPacks(state.packs, opts)
      : [];
  renderPacksList(refs, {
    packs,
    total,
    state: listStateFor(packs.length),
    lang: state.lang,
    filter: opts,
    errorMessage: state.error ?? undefined,
  });
}

/**
 * 从构建时内嵌的 info.json 载入列表（无运行时网络请求，避免 CORS）。
 * force：刷新按钮重新应用内嵌数据并清空筛选。
 */
function loadEmbeddedPacks(force: boolean): void {
  if (!force && state.packs !== null) {
    rerender();
    return;
  }

  state.loading = true;
  state.error = null;
  rerender();

  try {
    if (!Array.isArray(embeddedInfo)) {
      throw new Error('embedded info.json is not an array');
    }
    state.packs = embeddedInfo as PackInfo[];
    state.error = null;
    if (force) {
      state.category = 'all';
      state.query = '';
      state.sort = 'time_desc';
      if (refs) {
        refs.searchInput.value = '';
        refs.sortSelect.value = 'time_desc';
      }
    }
  } catch (err) {
    state.packs = null;
    const detail = err instanceof Error ? err.message : String(err);
    state.error = `${packsT(state.lang, 'errorEmbedded')}${detail ? ` (${detail})` : ''}`;
  } finally {
    state.loading = false;
    rerender();
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

  // 「刷新」：重新应用打包时内嵌的列表并重置筛选（不发起网络请求）
  ui.refreshBtn.addEventListener('click', () => {
    loadEmbeddedPacks(true);
  });

  ui.retryBtn.addEventListener('click', () => {
    loadEmbeddedPacks(true);
  });
}

function init(root: HTMLElement): void {
  injectStylesOnce();
  refs = mountPacksChrome(root);
  bindEvents(refs);
  // 仅挂载 UI，进入「模型包」视图后再载入内嵌数据
  rerender();
}

function show(): void {
  visible = true;
  if (state.packs === null) {
    loadEmbeddedPacks(false);
  } else {
    rerender();
  }
}

function hide(): void {
  visible = false;
}

function setLang(lang: UiLang): void {
  state.lang = lang;
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
