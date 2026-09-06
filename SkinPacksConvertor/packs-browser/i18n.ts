import type { UiLang } from './types';

export const INFO_JSON_URL = 'https://tlmdl.cfpa.team/info.json';
export const DOWNLOAD_ORIGIN = 'https://tlmdl.cfpa.team';
export const OFFICIAL_DIR_URL = 'https://tlmdl.cfpa.team/';

type I18nKey =
  | 'navConvert'
  | 'navPacks'
  | 'searchPlaceholder'
  | 'catAll'
  | 'catMaid'
  | 'catChair'
  | 'catSound'
  | 'sortTimeDesc'
  | 'sortTimeAsc'
  | 'sortSizeDesc'
  | 'sortSizeAsc'
  | 'refresh'
  | 'loading'
  | 'empty'
  | 'error'
  | 'errorCors'
  | 'errorNetwork'
  | 'errorEmbedded'
  | 'retry'
  | 'openOfficial'
  | 'download'
  | 'count'
  | 'authors'
  | 'version'
  | 'heroPacksTitle'
  | 'heroPacksDesc';

const MESSAGES: Record<UiLang, Record<I18nKey, string>> = {
  'zh-CN': {
    navConvert: '转换器',
    navPacks: '模型包',
    searchPlaceholder: '搜索名称、描述、作者或关键词…',
    catAll: '全部',
    catMaid: '女仆',
    catChair: '坐垫',
    catSound: '声音',
    sortTimeDesc: '上传时间 ↓',
    sortTimeAsc: '上传时间 ↑',
    sortSizeDesc: '文件大小 ↓',
    sortSizeAsc: '文件大小 ↑',
    refresh: '重置筛选',
    loading: '加载中…',
    empty: '没有匹配的模型包，请尝试其他关键词或分类。',
    error: '无法加载模型包列表',
    errorCors:
      '无法加载模型包列表：浏览器跨域（CORS）限制或网络失败。可重试，或打开官方目录。',
    errorNetwork:
      '无法加载模型包列表：网络请求失败。请检查连接后重试，或打开官方目录。',
    errorEmbedded: '无法读取打包时内嵌的模型包列表。请重新执行构建以更新 info.json。',
    retry: '重试',
    openOfficial: '打开官方目录',
    download: '下载',
    count: '共 {total} / 显示 {shown}',
    authors: '作者',
    version: '版本',
    heroPacksTitle: '模型包浏览',
    heroPacksDesc: '浏览并下载 TLM 官方模型包。',
  },
  'en-US': {
    navConvert: 'Converter',
    navPacks: 'Model Packs',
    searchPlaceholder: 'Search name, description, author or keyword…',
    catAll: 'All',
    catMaid: 'Maid',
    catChair: 'Chair',
    catSound: 'Sound',
    sortTimeDesc: 'Upload time ↓',
    sortTimeAsc: 'Upload time ↑',
    sortSizeDesc: 'File size ↓',
    sortSizeAsc: 'File size ↑',
    refresh: 'Reset filters',
    loading: 'Loading…',
    empty: 'No matching packs. Try another keyword or category.',
    error: 'Failed to load pack list',
    errorCors:
      'Failed to load pack list: blocked by CORS or network. Retry, or open the official directory.',
    errorNetwork:
      'Failed to load pack list: network request failed. Check your connection, retry, or open the official directory.',
    errorEmbedded:
      'Failed to read the pack list embedded at build time. Rebuild the site to refresh info.json.',
    retry: 'Retry',
    openOfficial: 'Open official directory',
    download: 'Download',
    count: 'Total {total} / Showing {shown}',
    authors: 'Authors',
    version: 'Version',
    heroPacksTitle: 'Model Pack Browser',
    heroPacksDesc: 'Browse and download official TLM model packs.',
  },
};

/** 浏览页 UI 文案；count 等模板键可通过 vars 替换 {name} 占位符 */
export function packsT(
  lang: UiLang,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const table = MESSAGES[lang] as Record<string, string>;
  let text = table[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
    }
  }
  return text;
}

/** 对齐 Java 站 formatFileSize：B / KB / MB，两位小数 */
export function formatFileSize(bytes: number, _lang: UiLang): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)}KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** YYYY-MM-DD HH:mm:ss，与 Java 站 formatTime 一致 */
export function formatUploadTime(ts: number): string {
  const date = new Date(ts);
  const Y = date.getFullYear();
  const M = pad2(date.getMonth() + 1);
  const D = pad2(date.getDate());
  const h = pad2(date.getHours());
  const m = pad2(date.getMinutes());
  const s = pad2(date.getSeconds());
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}
