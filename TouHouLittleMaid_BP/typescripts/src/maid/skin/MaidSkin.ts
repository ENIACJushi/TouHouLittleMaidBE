import { world } from "@minecraft/server";
import { getRandomInteger } from "../../libs/ScarletToolKit";
import { SkinPackDisplayInfo } from './MaidSkinTypes';

export class MaidSkin {
  /* 预置模型包参数 */
  static readonly PLACEHOLDER: number = 1000; // 最大预置模型包预留序号（不可更改此常量，否则皮肤包会出问题）
  static readonly DEFAULT_PACKS: [number, number][] = [
    [0, 120]
  ];
  /* 通用参数 */
  static readonly SCOREBOARD_NAME_OLD = 'thlmskin'; // 旧计分板 id，因为在默认模型包的记录上有缺陷，不再使用
  static readonly SCOREBOARD_NAME = 'thlm_skin'; // 计分板 id
  static skinPacks: Map<number, number> = new Map(MaidSkin.DEFAULT_PACKS); // 皮肤包列表，记录 id - 皮肤包拥有的皮肤数量

  ///// 配置 /////
  /**
   * 初始化，世界初始化时调用
   */
  static init(): void {
    let scoreboard = world.scoreboard.getObjective(MaidSkin.SCOREBOARD_NAME);
    if (!scoreboard) {
      console.log(`MaidSkin init >> Create scoreboard.`);
      // 计分板未初始化时，创建计分板
      world.scoreboard.addObjective(MaidSkin.SCOREBOARD_NAME, 'THLMSkin');
      // 删除旧的计分板
      let oldScoreboard = world.scoreboard.getObjective(MaidSkin.SCOREBOARD_NAME_OLD);
      if (oldScoreboard) {
        world.scoreboard.removeObjective(MaidSkin.SCOREBOARD_NAME_OLD);
      }
      return;
    }
    // 计分板已初始化，则读取已加载的皮肤包
    scoreboard.getScores().forEach(info => {
      console.log(`MaidSkin init >> Add pack: id=${info.participant.displayName}, amount=${info.score}`);
      this.skinPacks.set(Number(info.participant.displayName), info.score);
    });
  }

  /**
   * 获取皮肤包计分板
   */
  static getSkinScoreboard() {
    let res = world.scoreboard.getObjective(MaidSkin.SCOREBOARD_NAME);
    if (!res) {
      res = world.scoreboard.addObjective(MaidSkin.SCOREBOARD_NAME, 'THLMSkin');
    }
    return res;
  }

  /**
   * 设置附加皮肤列表
   */
  static setSkin(list: number[]): void {
    // 清空计分板
    let scoreboard = MaidSkin.getSkinScoreboard();
    scoreboard.getParticipants().forEach(value => {
      scoreboard.removeParticipant(value);
    });

    // 重置内存表
    MaidSkin.skinPacks = new Map(MaidSkin.DEFAULT_PACKS);

    // 更新缓存和计分板
    for (let i = 0; i < list.length; i++) {
      let id = MaidSkin.PLACEHOLDER + 1 + i;
      MaidSkin.skinPacks.set(id, list[i]);
      scoreboard.setScore(id.toString(), list[i]);
    }
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
    return { translate: `model.${id}.${index}.name` };
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
