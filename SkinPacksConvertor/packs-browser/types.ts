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
