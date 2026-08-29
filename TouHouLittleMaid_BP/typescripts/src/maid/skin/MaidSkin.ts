import { world } from "@minecraft/server";
import { getRandomInteger } from "../../libs/ScarletToolKit";
import { SkinPackConfig, SkinPackDisplayInfo } from './MaidSkinTypes';

/**
 * 手动转换的内置女仆包（东方 Project，来自 maid_basic），不由 `npm run convert:built-in` 覆写。
 */
const MANUAL_BUILT_IN_MAID_DEFAULT_PACKS: [number, number][] = [
  [0, 120], // 东方
];
// ##### BUILT_IN_MAID_PACKS_START #####
const BUILT_IN_MAID_DEFAULT_PACKS: [number, number][] = [
  [1, 41], // geckolib
  [2, 11], // authors_and_credits
  [3, 4], // minecraft_15th
];
// ##### BUILT_IN_MAID_PACKS_END #####
/**
 * 女仆皮肤包配置
 *
 * 内置自动转换包列表见 `BUILT_IN_MAID_DEFAULT_PACKS`（由 `npm run convert:built-in` 按标签块自动同步）；
 * 手动东方包见 `MANUAL_BUILT_IN_MAID_DEFAULT_PACKS`；
 * 附加包使用 `PLACEHOLDER + 1 + i`（与转换器 BASE_PACK_INDEX 保持一致，即附加包序号 >= 1000）。
 */
export class MaidSkin {
  /* 预置模型包参数 */
  static readonly PLACEHOLDER: number = 1000; // 最大预置模型包预留序号（不可更改此常量，否则皮肤包会出问题）
  static readonly DEFAULT_PACKS: [number, number][] = [
    ...MANUAL_BUILT_IN_MAID_DEFAULT_PACKS,
    ...BUILT_IN_MAID_DEFAULT_PACKS,
  ];
  /* 通用参数 */
  static readonly PROPERTY_KEY = 'thlm_skin_packs'; // 附加皮肤包 JSON 动态属性
  static skinPacks: Map<number, number> = new Map(MaidSkin.DEFAULT_PACKS); // 皮肤包列表，记录 id - 皮肤包拥有的皮肤数量
  static extraPacks: SkinPackConfig[] = []; // 附加皮肤包配置，与网站 JSON 对应

  ///// 配置 /////
  /**
   * 初始化，世界初始化时调用
   */
  static init(): void {
    const stored = world.getDynamicProperty(MaidSkin.PROPERTY_KEY);
    if (typeof stored !== 'string') {
      return;
    }
    const packs = MaidSkin.parsePackConfig(stored);
    if (packs === undefined) {
      return;
    }
    MaidSkin.applyExtraPacks(packs);
  }

  /**
   * 设置附加皮肤列表
   * @param packs 网站生成的皮肤包 JSON，如 [{"count":20},{"count":10}]
   */
  static setSkin(packs: SkinPackConfig[]): void {
    MaidSkin.applyExtraPacks(packs);
    world.setDynamicProperty(MaidSkin.PROPERTY_KEY, JSON.stringify(packs));
  }

  /**
   * 将附加皮肤包应用到内存表
   */
  static applyExtraPacks(packs: SkinPackConfig[]): void {
    MaidSkin.extraPacks = packs;
    MaidSkin.skinPacks = new Map(MaidSkin.DEFAULT_PACKS);

    for (let i = 0; i < packs.length; i++) {
      let id = MaidSkin.PLACEHOLDER + 1 + i;
      MaidSkin.skinPacks.set(id, packs[i].count);
      console.log(`MaidSkin >> Add pack: id=${id}, amount=${packs[i].count}`);
    }
  }

  /**
   * 解析网站生成的皮肤包 JSON
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
      result.push(item as SkinPackConfig);
    }
    return result;
  }

  /**
   * 将附加皮肤包配置转为 JSON 字符串
   */
  static stringifyPackConfig(packs: SkinPackConfig[] = MaidSkin.extraPacks): string {
    return JSON.stringify(packs);
  }

  /**
   * 获取一个随机皮肤 {pack, seq}
   */
  static getRandom(): { pack: number; seq: number } {
    // 计算皮肤总数
    let total = 0;
    MaidSkin.skinPacks.forEach(amount => {
      total += amount;
    });

    // 选中一个
    let seqAll = getRandomInteger(0, total - 1);
    // 找到对应包 id 和皮肤 id
    let packId = 0;
    let seq = 0;
    for (const [pack, amount] of MaidSkin.skinPacks.entries()) {
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
   * 获取当前加载的皮肤包数量（包含预置）
   */
  static size(): number {
    return MaidSkin.skinPacks.size;
  }

  /**
   * 获取默认皮肤包数量
   */
  static getDefaultPackAmount() {
    return MaidSkin.DEFAULT_PACKS.length;
  }

  /**
   * 获取指定皮肤包的皮肤数量
   */
  static getSkinAmount(packId: number): number {
    return MaidSkin.skinPacks.get(packId) ?? 0;
  }

  /**
   * 判断皮肤是否已注册（皮肤包存在且序号在有效范围内）
   */
  static isRegistered(packId: number, index: number): boolean {
    if (!Number.isInteger(packId) || !Number.isInteger(index) || index < 0) {
      return false;
    }
    return index < MaidSkin.getSkinAmount(packId);
  }

  ///// 展示文本获取 /////
  /**
   * 获取皮肤包的显示名称（translate）
   */
  static getPackDisplayName(id: number): { translate: string } {
    return { translate: `maid_pack.${id}.name` };
  }

  /**
   * 获取皮肤包的描述（translate）
   */
  static getPackDesc(id: number): { translate: string } {
    return { translate: `maid_pack.${id}.desc` };
  }

  /**
   * 获取皮肤包的图标
   * @return 图标路径
   */
  static getPackIcon(id: number): string {
    return `textures/thlm/pack_pack_${id}.png`;
  }

  /**
   * 获取皮肤包的作者（translate）
   */
  static getAuthors(id: number): { translate: string } {
    return { translate: `maid_pack.${id}.authors` };
  }

  /**
   * 获取皮肤的显示名称（translate）
   * @param id 皮肤包序号
   * @param index 皮肤在皮肤包内的顺序
   */
  static getSkinDisplayName(id: number, index: number): { translate: string } {
    return { translate: `tlm.maid.model.${id}.${index}.name` };
  }

  /**
   * 获取所有皮肤包展示信息，用于皮肤包选择弹窗（按 id 大小排序）
   */
  static getAllPackInfos(): SkinPackDisplayInfo[] {
    const ids = Array.from(MaidSkin.skinPacks.keys());
    ids.sort((a, b) => a - b);
    return ids.map(id => ({
      id: id,
      name: MaidSkin.getPackDisplayName(id),
      icon: MaidSkin.getPackIcon(id),
      count: MaidSkin.getSkinAmount(id),
    }));
  }
}
