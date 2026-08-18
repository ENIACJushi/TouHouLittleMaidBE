/**
 * Yes Steve Model（YSM）`ysm.json` 类型定义。
 *
 * 参考：
 * - 官方结构文档：https://ysm.cfpa.team/wiki/struct/
 * - 样例包：`.ref/koishi/ysm.json`（spec: 2）
 *
 * 约定：
 * - 一个模型文件夹（或其 zip）对应一个模型 ID（通常为文件夹名）。
 * - `ysm.json` 固定位于模型包根目录，UTF-8 无 BOM。
 * - 路径均相对模型包根目录，大小写敏感。
 */

/** YSM 贴图：纯路径或带 PBR 通道的对象 */
export type YsmTextureEntry =
  | string
  | {
      uv: string;
      normal?: string;
      specular?: string;
    };

/** 玩家模型动画角色键 */
export type YsmAnimationRole =
  | 'main'
  | 'arm'
  | 'extra'
  | 'tac'
  | 'carryon'
  | 'parcool'
  | 'swem'
  | 'slashblade'
  | 'tlm'
  | 'fp_arm';

/** 作者信息 */
export interface YsmAuthorInfo {
  name: string;
  avatar?: string;
  role?: string;
  contact?: Record<string, string>;
  comment?: string;
}

/** 元数据 */
export interface YsmMetadata {
  /** 显示名（有 metadata 时通常必填） */
  name: string;
  tips?: string;
  license?: { type: string; desc?: string };
  authors?: YsmAuthorInfo[];
  link?: { home?: string; donate?: string };
}

/** 轮盘分类项 */
export interface YsmExtraAnimationClassify {
  id: string;
  extra_animation: Record<string, string>;
}

/** 轮盘按钮表单项 */
export interface YsmConfigForm {
  type: 'range' | 'checkbox' | 'radio';
  title: string;
  description?: string;
  value: string;
  step?: number;
  min?: number;
  max?: number;
  labels?: Record<string, string>;
}

export interface YsmExtraAnimationButton {
  id: string;
  name: string;
  config_forms: YsmConfigForm[];
}

/** 属性（缩放、轮盘、预览等） */
export interface YsmProperties {
  height_scale?: number;
  width_scale?: number;
  extra_animation?: Record<string, string>;
  extra_animation_classify?: YsmExtraAnimationClassify[];
  extra_animation_buttons?: YsmExtraAnimationButton[];
  preview_animation?: string;
  /** 贴图文件 basename（不含 .png） */
  default_texture?: string;
  free?: boolean;
  render_layers_first?: boolean;
  disable_preview_rotation?: boolean;
  gui_no_lighting?: boolean;
  gui_foreground?: string;
  gui_background?: string;
  all_cutout?: boolean;
  /** 2.6.4+ 合并多行 Molang */
  merge_multiline_expr?: boolean;
}

/** 玩家模型文件索引 */
export interface YsmPlayerFiles {
  model: {
    main: string;
    arm: string;
  };
  animation?: Partial<Record<YsmAnimationRole, string>>;
  animation_controllers?: string[];
  texture: YsmTextureEntry[];
}

/** 投射物 / 载具等扩展（转换器暂不处理，仅保留类型） */
export interface YsmMatchModelFiles {
  match: string[];
  model: string;
  animation?: string;
  controller?: string;
  texture: string | YsmTextureEntry;
}

/** `files` 段 */
export interface YsmFiles {
  player: YsmPlayerFiles;
  projectiles?: YsmMatchModelFiles[];
  vehicles?: YsmMatchModelFiles[];
  sound_path?: string;
  function_path?: string;
  language_path?: string;
}

/**
 * `ysm.json` 顶层对象（spec 2）。
 */
export interface YsmJson {
  /** 结构版本，当前实现要求为 2 */
  spec: number;
  metadata?: YsmMetadata;
  properties?: YsmProperties;
  files: YsmFiles;
}
