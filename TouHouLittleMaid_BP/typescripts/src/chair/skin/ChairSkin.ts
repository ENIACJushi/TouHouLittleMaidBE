import { world } from "@minecraft/server";
import { getRandomInteger } from "../../libs/ScarletToolKit";
import { SkinPackConfig, SkinPackDisplayInfo } from "../../maid/skin/MaidSkinTypes";
import {
  DEFAULT_MOUNTED_HEIGHT_PIXEL,
  normalizeMountedHeightPixel,
} from "../ChairMountedHeight";
// ##### BUILT_IN_CHAIR_PACKS_START #####
const BUILT_IN_CHAIR_DEFAULT_PACKS: [number, number][] = [
  [1, 33], // touhou_little_maid
  [2, 1], // geckolib
  [3, 29], // next_update_model
];
// ##### BUILT_IN_CHAIR_PACKS_END #####
// ##### BUILT_IN_CHAIR_HEIGHTS_START #####
const BUILT_IN_CHAIR_DEFAULT_HEIGHTS: number[][] = [
  [3, 15, 6, 13, 1, 15, 8, 16, 2, 7, 15, 15, 5, 0, 3, 17, 7, 7, 7, 7, 0, 14, 7, 13, 11, 2, 0, 0, 0, 3, 3, 3, 14], // touhou_little_maid
  [0], // geckolib
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // next_update_model
];
// ##### BUILT_IN_CHAIR_HEIGHTS_END #####
/**
 * 坐垫皮肤包配置
 *
 * 与女仆皮肤包（MaidSkin）相互独立，拥有自己的动态属性 `thlm_chair_packs` 与包序号空间。
 * 内置坐垫包列表见 `BUILT_IN_CHAIR_DEFAULT_PACKS`（由 `npm run convert:built-in` 按标签块自动同步）；
 * 附加包使用 `PLACEHOLDER + 1 + i`（与转换器 CHAIR_BASE_PACK_INDEX 保持一致，即附加包序号 >= 1000）。
 */
export class ChairSkin {
  /* 预置模型包参数 */
  static readonly PLACEHOLDER: number = 1000; // 最大预置模型包预留序号（与转换器 CHAIR_BASE_PACK_INDEX 一致）
  static readonly DEFAULT_PACKS: [number, number][] = BUILT_IN_CHAIR_DEFAULT_PACKS;
  static readonly DEFAULT_HEIGHTS: number[][] = BUILT_IN_CHAIR_DEFAULT_HEIGHTS;
  /* 通用参数 */
  static readonly PROPERTY_KEY = 'thlm_chair_packs'; // 附加坐垫包 JSON 动态属性
  static skinPacks: Map<number, number> = new Map(ChairSkin.DEFAULT_PACKS); // 坐垫皮肤包列表，记录 id - 皮肤包拥有的皮肤数量
  /** 各坐垫包的 mounted_height 像素列表（packId → heights[]） */
  static heightsByPack: Map<number, number[]> = ChairSkin.buildDefaultHeightsMap();
  static extraPacks: SkinPackConfig[] = []; // 附加坐垫包配置，与网站 JSON 对应

  /**
   * 由内置常量构建高度表
   */
  static buildDefaultHeightsMap(): Map<number, number[]> {
    const map = new Map<number, number[]>();
    for (let i = 0; i < ChairSkin.DEFAULT_PACKS.length; i++) {
      const [packId, count] = ChairSkin.DEFAULT_PACKS[i];
      const raw = ChairSkin.DEFAULT_HEIGHTS[i] ?? [];
      const heights: number[] = [];
      for (let j = 0; j < count; j++) {
        heights.push(normalizeMountedHeightPixel(raw[j]));
      }
      map.set(packId, heights);
    }
    return map;
  }

  ///// 配置 /////
  /**
   * 初始化，世界初始化时调用
   */
  static init(): void {
    const stored = world.getDynamicProperty(ChairSkin.PROPERTY_KEY);
    if (typeof stored !== 'string') {
      return;
    }
    const packs = ChairSkin.parsePackConfig(stored);
    if (packs === undefined) {
      return;
    }
    ChairSkin.applyExtraPacks(packs);
  }

  /**
   * 设置附加坐垫包列表
   * @param packs 网站生成的坐垫包 JSON，如 [{"count":20,"heights":[3,15]},{"count":10}]
   */
  static setSkin(packs: SkinPackConfig[]): void {
    ChairSkin.applyExtraPacks(packs);
    world.setDynamicProperty(ChairSkin.PROPERTY_KEY, JSON.stringify(packs));
  }

  /**
   * 将附加坐垫包应用到内存表
   */
  static applyExtraPacks(packs: SkinPackConfig[]): void {
    ChairSkin.extraPacks = packs;
    ChairSkin.skinPacks = new Map(ChairSkin.DEFAULT_PACKS);
    ChairSkin.heightsByPack = ChairSkin.buildDefaultHeightsMap();

    for (let i = 0; i < packs.length; i++) {
      let id = ChairSkin.PLACEHOLDER + 1 + i;
      const count = packs[i].count;
      ChairSkin.skinPacks.set(id, count);
      ChairSkin.heightsByPack.set(id, ChairSkin.normalizeHeights(packs[i], count));
      console.log(`ChairSkin >> Add pack: id=${id}, amount=${count}`);
    }
  }

  /**
   * 从包配置规范化 heights 数组（长度对齐 count，缺省补 0）
   */
  static normalizeHeights(pack: SkinPackConfig, count: number): number[] {
    const raw = pack.heights;
    const heights: number[] = [];
    for (let j = 0; j < count; j++) {
      const h = Array.isArray(raw) ? raw[j] : undefined;
      heights.push(normalizeMountedHeightPixel(typeof h === 'number' ? h : DEFAULT_MOUNTED_HEIGHT_PIXEL));
    }
    return heights;
  }

  /**
   * 解析网站生成的坐垫包 JSON
   * @returns 解析失败时返回 undefined
   */
  static parsePackConfig(text: string): SkinPackConfig[] | undefined {
    const trimmed = text.trim();
    if (trimmed === '') {
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return undefined;
    }

    if (!Array.isArray(parsed)) {
      return undefined;
    }

    const result: SkinPackConfig[] = [];
    for (const item of parsed) {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) {
        return undefined;
      }
      const count = (item as { count?: unknown }).count;
      if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
        return undefined;
      }
      const heights = (item as { heights?: unknown }).heights;
      if (heights !== undefined) {
        if (!Array.isArray(heights)) {
          return undefined;
        }
        for (const h of heights) {
          if (typeof h !== 'number' || !Number.isFinite(h)) {
            return undefined;
          }
        }
      }
      result.push(item as SkinPackConfig);
    }
    return result;
  }

  /**
   * 将附加坐垫包配置转为 JSON 字符串
   */
  static stringifyPackConfig(packs: SkinPackConfig[] = ChairSkin.extraPacks): string {
    return JSON.stringify(packs);
  }

  /**
   * 获取一个随机皮肤 {pack, seq}
   */
  static getRandom(): { pack: number; seq: number } {
    // 计算皮肤总数
    let total = 0;
    ChairSkin.skinPacks.forEach(amount => {
      total += amount;
    });

    // 选中一个
    let seqAll = getRandomInteger(0, total - 1);
    // 找到对应包 id 和皮肤 id
    let packId = 0;
    let seq = 0;
    for (const [pack, amount] of ChairSkin.skinPacks.entries()) {
      if (seqAll < amount) {
        packId = pack;
        seq = seqAll;
        break;
      }
      seqAll -= amount;
    }
    return { pack: packId, seq: seq };
  }

  ///// 信息获取 /////
  /**
   * 获取当前加载的坐垫皮肤包数量（包含预置）
   */
  static size(): number {
    return ChairSkin.skinPacks.size;
  }

  /**
   * 获取默认坐垫包数量
   */
  static getDefaultPackAmount() {
    return ChairSkin.DEFAULT_PACKS.length;
  }

  /**
   * 获取指定坐垫包的皮肤数量
   */
  static getSkinAmount(packId: number): number {
    return ChairSkin.skinPacks.get(packId) ?? 0;
  }

  /**
   * 获取指定坐垫模型的骑乘高度像素（已规范化）
   */
  static getMountedHeightPixel(packId: number, index: number): number {
    const heights = ChairSkin.heightsByPack.get(packId);
    if (!heights || index < 0 || index >= heights.length) {
      return normalizeMountedHeightPixel(DEFAULT_MOUNTED_HEIGHT_PIXEL);
    }
    return heights[index];
  }

  /**
   * 判断坐垫皮肤是否已注册（坐垫包存在且序号在有效范围内）
   */
  static isRegistered(packId: number, index: number): boolean {
    if (!Number.isInteger(packId) || !Number.isInteger(index) || index < 0) {
      return false;
    }
    return index < ChairSkin.getSkinAmount(packId);
  }

  ///// 展示文本获取 /////
  /**
   * 获取坐垫包的显示名称（translate）
   */
  static getPackDisplayName(id: number): { translate: string } {
    return { translate: `chair_pack.${id}.name` };
  }

  /**
   * 获取坐垫包的描述（translate）
   */
  static getPackDesc(id: number): { translate: string } {
    return { translate: `chair_pack.${id}.desc` };
  }

  /**
   * 获取坐垫包的图标
   * @return 图标路径
   */
  static getPackIcon(id: number): string {
    return `textures/thlm/chair_pack_pack_${id}.png`;
  }

  /**
   * 获取坐垫包的作者（translate）
   */
  static getAuthors(id: number): { translate: string } {
    return { translate: `chair_pack.${id}.authors` };
  }

  /**
   * 获取坐垫皮肤的显示名称（translate）
   * @param id 坐垫包序号
   * @param index 坐垫皮肤在包内的顺序
   */
  static getSkinDisplayName(id: number, index: number): { translate: string } {
    return { translate: `tlm.chair.model.${id}.${index}.name` };
  }

  /**
   * 获取所有坐垫包展示信息，用于坐垫包选择弹窗（按 id 大小排序）
   */
  static getAllPackInfos(): SkinPackDisplayInfo[] {
    const ids = Array.from(ChairSkin.skinPacks.keys());
    ids.sort((a, b) => a - b);
    return ids.map(id => ({
      id: id,
      name: ChairSkin.getPackDisplayName(id),
      icon: ChairSkin.getPackIcon(id),
      count: ChairSkin.getSkinAmount(id),
    }));
  }
}
