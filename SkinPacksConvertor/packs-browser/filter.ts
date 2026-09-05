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
