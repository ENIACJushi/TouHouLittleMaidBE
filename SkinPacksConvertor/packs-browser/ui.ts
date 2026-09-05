import { resolveLocalizedText } from './filter';
import {
  DOWNLOAD_ORIGIN,
  OFFICIAL_DIR_URL,
  formatFileSize,
  formatUploadTime,
  packsT,
} from './i18n';
import type { FilterOptions, PackCategory, PackInfo, PackSortKey, UiLang } from './types';

export type PacksListState = 'loading' | 'error' | 'empty' | 'ready';

export type PacksUiRefs = {
  searchInput: HTMLInputElement;
  categoryButtons: HTMLButtonElement[];
  sortSelect: HTMLSelectElement;
  refreshBtn: HTMLButtonElement;
  countEl: HTMLElement;
  statusEl: HTMLElement;
  listEl: HTMLElement;
  retryBtn: HTMLButtonElement;
  officialLink: HTMLAnchorElement;
};

export type RenderPacksListArgs = {
  packs: PackInfo[];
  total: number;
  state: PacksListState;
  lang: UiLang;
  filter: FilterOptions;
  errorMessage?: string;
};

const CATEGORIES: PackCategory[] = ['all', 'maid', 'chair', 'sound'];

const SORT_KEYS: PackSortKey[] = ['time_desc', 'time_asc', 'size_desc', 'size_asc'];

const CATEGORY_I18N: Record<PackCategory, string> = {
  all: 'catAll',
  maid: 'catMaid',
  chair: 'catChair',
  sound: 'catSound',
};

const SORT_I18N: Record<PackSortKey, string> = {
  time_desc: 'sortTimeDesc',
  time_asc: 'sortTimeAsc',
  size_desc: 'sortSizeDesc',
  size_asc: 'sortSizeAsc',
};

const TYPE_CHIP_CLASS: Record<string, string> = {
  maid: 'pack-chip pack-chip--maid',
  chair: 'pack-chip pack-chip--chair',
  sound: 'pack-chip pack-chip--sound',
};

function typeChipLabel(type: string, lang: UiLang): string {
  if (type === 'maid' || type === 'chair' || type === 'sound') {
    return packsT(lang, CATEGORY_I18N[type]);
  }
  return type;
}

function syncToolbarLabels(refs: PacksUiRefs, lang: UiLang, filter: FilterOptions): void {
  refs.searchInput.placeholder = packsT(lang, 'searchPlaceholder');
  refs.refreshBtn.textContent = packsT(lang, 'refresh');
  refs.retryBtn.textContent = packsT(lang, 'retry');
  refs.officialLink.textContent = packsT(lang, 'openOfficial');

  for (const btn of refs.categoryButtons) {
    const cat = btn.dataset.category as PackCategory;
    btn.textContent = packsT(lang, CATEGORY_I18N[cat]);
    const active = cat === filter.category;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  }

  for (const opt of Array.from(refs.sortSelect.options)) {
    const key = opt.value as PackSortKey;
    opt.textContent = packsT(lang, SORT_I18N[key]);
  }
  refs.sortSelect.value = filter.sort;
}

function renderPackCard(pack: PackInfo, lang: UiLang): HTMLElement {
  const card = document.createElement('article');
  card.className = 'pack-card';

  const title = document.createElement('h2');
  title.className = 'pack-card-title';
  title.textContent = resolveLocalizedText(pack, 'name', lang);

  const desc = document.createElement('p');
  desc.className = 'pack-card-desc';
  desc.textContent = resolveLocalizedText(pack, 'desc', lang);

  const meta = document.createElement('div');
  meta.className = 'pack-card-meta';

  const sizeSpan = document.createElement('span');
  sizeSpan.textContent = formatFileSize(pack.file_size, lang);

  const timeSpan = document.createElement('span');
  timeSpan.textContent = formatUploadTime(pack.upload_time);

  meta.append(sizeSpan, timeSpan);

  if (pack.author?.length) {
    const authorsSpan = document.createElement('span');
    authorsSpan.textContent = `${packsT(lang, 'authors')}: ${pack.author.join(', ')}`;
    meta.append(authorsSpan);
  }

  if (pack.version) {
    const versionSpan = document.createElement('span');
    versionSpan.textContent = `${packsT(lang, 'version')}: ${pack.version}`;
    meta.append(versionSpan);
  }

  for (const type of pack.type || []) {
    const chip = document.createElement('span');
    chip.className = TYPE_CHIP_CLASS[type] ?? 'pack-chip';
    chip.textContent = typeChipLabel(type, lang);
    meta.append(chip);
  }

  const actions = document.createElement('div');
  actions.className = 'pack-card-actions';

  const download = document.createElement('a');
  download.className = 'pack-card-download';
  download.href = `${DOWNLOAD_ORIGIN}${pack.url}`;
  download.target = '_blank';
  download.rel = 'noopener noreferrer';
  download.textContent = packsT(lang, 'download');

  actions.append(download);
  card.append(title, desc, meta, actions);
  return card;
}

function showStatus(refs: PacksUiRefs, className: string, message: string, showErrorActions: boolean): void {
  refs.statusEl.className = `packs-status ${className}`;
  refs.statusEl.hidden = false;
  refs.listEl.hidden = true;
  refs.listEl.replaceChildren();

  refs.statusEl.replaceChildren();

  const msg = document.createElement('p');
  msg.className = showErrorActions ? 'packs-error-message' : '';
  msg.textContent = message;
  refs.statusEl.append(msg);

  if (showErrorActions) {
    const actions = document.createElement('div');
    actions.className = 'packs-error-actions';
    actions.append(refs.retryBtn, refs.officialLink);
    refs.statusEl.append(actions);
  }
}

/** 创建工具栏、状态区与列表容器，返回控件 refs（事件由 controller 绑定；hero 由壳层 index.html 提供） */
export function mountPacksChrome(root: HTMLElement): PacksUiRefs {
  root.replaceChildren();

  const toolbar = document.createElement('div');
  toolbar.className = 'packs-toolbar';

  const row = document.createElement('div');
  row.className = 'packs-toolbar-row';

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'packs-search';
  searchInput.autocomplete = 'off';

  const sortSelect = document.createElement('select');
  sortSelect.className = 'packs-sort';
  for (const key of SORT_KEYS) {
    const opt = document.createElement('option');
    opt.value = key;
    sortSelect.append(opt);
  }

  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.className = 'packs-refresh-btn';

  const countEl = document.createElement('span');
  countEl.className = 'packs-count';

  row.append(searchInput, sortSelect, refreshBtn, countEl);

  const tabs = document.createElement('div');
  tabs.className = 'packs-tabs';

  const categoryButtons = CATEGORIES.map((cat) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'packs-tab';
    btn.dataset.category = cat;
    tabs.append(btn);
    return btn;
  });

  toolbar.append(row, tabs);

  const statusEl = document.createElement('div');
  statusEl.className = 'packs-status';
  statusEl.hidden = true;

  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.className = 'packs-retry-btn';

  const officialLink = document.createElement('a');
  officialLink.className = 'packs-official-link';
  officialLink.href = OFFICIAL_DIR_URL;
  officialLink.target = '_blank';
  officialLink.rel = 'noopener noreferrer';

  const listEl = document.createElement('div');
  listEl.className = 'packs-list';
  listEl.hidden = true;

  root.append(toolbar, statusEl, listEl);

  return {
    searchInput,
    categoryButtons,
    sortSelect,
    refreshBtn,
    countEl,
    statusEl,
    listEl,
    retryBtn,
    officialLink,
  };
}

/** 按 loading / error / empty / ready 重绘列表与状态文案 */
export function renderPacksList(refs: PacksUiRefs, args: RenderPacksListArgs): void {
  const { packs, total, state, lang, filter, errorMessage } = args;

  syncToolbarLabels(refs, lang, filter);

  const shown = packs.length;
  refs.countEl.textContent = packsT(lang, 'count', { total, shown });

  if (state === 'loading') {
    showStatus(refs, 'packs-loading', packsT(lang, 'loading'), false);
    return;
  }

  if (state === 'error') {
    const message = errorMessage?.trim() || packsT(lang, 'error');
    showStatus(refs, 'packs-error', message, true);
    return;
  }

  if (state === 'empty') {
    showStatus(refs, 'packs-empty', packsT(lang, 'empty'), false);
    return;
  }

  refs.statusEl.hidden = true;
  refs.statusEl.replaceChildren();
  refs.listEl.hidden = false;
  refs.listEl.replaceChildren(...packs.map((pack) => renderPackCard(pack, lang)));
}
