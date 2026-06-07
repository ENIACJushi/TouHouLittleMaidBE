import { world, system } from "@minecraft/server";
import { getRandomInteger } from "../../libs/ScarletToolKit";

export class MaidSkin {
  static DEFAULTAMOUNT: number = 1; // 默认模型包数量
  static PLACEHOLDER: number = 100; // 最大默认模型包预留序号
  static SkinList: any[] = [
    120
  ];

  /**
   * 初始化模型包计分板
   */
  static initScoreboard(): void {
    let scoreboard = world.scoreboard.getObjective("thlmskin");
    if (scoreboard == null) {
      world.getDimension("overworld").runCommand("scoreboard objectives add thlmskin dummy THLMSkin");
      system.runTimeout(() => {
        scoreboard = world.scoreboard.getObjective("thlmskin");
        for (let i = 0; i < this.SkinList.length; i++) {
          scoreboard!.setScore(`${i}`, this.SkinList[i]);
        }
      }, 1);
    } else {
      let i = 0;
      while (true) {
        try {
          let score = scoreboard!.getScore(`${i}`);
          if (score === undefined) break;
          this.SkinList[i] = score;
          i++;
        } catch {
          break;
        }
      }
    }
  }

  /**
   * 获取一个随机皮肤 {pack, seq}
   */
  static getRandom(): { pack: number; seq: number } {
    // 计算总数
    let total = 0;
    for (let amount of this.SkinList) {
      total += amount;
    }
    let seqAll = getRandomInteger(0, total - 1);

    // 获取一个
    let pack = 0;
    let seq = seqAll;
    for (let amount of this.SkinList) {
      seqAll -= amount;
      if (seqAll < 1) {
        break;
      }
      seq = seqAll;
      pack++;
    }
    if (pack > this.DEFAULTAMOUNT) pack += 100;

    return { pack: pack, seq: seq };
  }

  /**
   * 设置皮肤列表，使用重置-追加模式，从1开始
   */
  static setSkin(list: number[]): void {
    // 更新缓存
    this.SkinList = [this.SkinList[0]].concat(list);

    // 更新计分板
    world.getDimension("overworld").runCommand("scoreboard objectives remove thlmskin");
    system.runTimeout(() => {
      this.initScoreboard();
    }, 2);
  }

  /**
   * 注册皮肤包
   * @param name 皮肤包命名空间
   * @param index 皮肤包编号
   * @param length 数量
   * @returns 已存在同名或同序号皮肤包时返回false
   */
  static register(name: string, index: number, length: number): boolean {
    for (let pack of this.SkinList) {
      if (typeof pack === 'object' && pack !== null) {
        if (pack.name === name || pack.index === index) {
          return false;
        }
      }
    }
    this.SkinList.push({
      name: name,
      index: index,
      length: length
    });
    //TODO: 计分板存储
    return true;
  }

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
   * 由展示顺序获取皮肤包的所有数据
   * @param index 展示顺序
   */
  static getPack(index: number): any {
    return this.SkinList[index];
  }

  /**
   * 由ID获取皮肤包的所有数据
   */
  static getPack_ID(index: number): any | undefined {
    for (let pack of this.SkinList) {
      // @ts-ignore
      if (pack["index"] === index) {
        return pack;
      }
    }
    return undefined;
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
   * 输入 translate文本（`model.${id}.${index}.name`）， 获取皮肤信息
   */
  static decodeName(translate: string): { pack: number; index: number } {
    let str = translate.split('.');
    return {
      pack: Number(str[1]),
      index: Number(str[2])
    };
  }

  /**
   * 获取作者
   */
  static getAuthors(id: number): { translate: string } {
    return { translate: `maid_pack.${id}.authors` };
  }

  static size(): number {
    return this.SkinList.length;
  }

  /**
   * 获取模型包的模型数量
   */
  static getSkinAmount(packId: number): number {
    if (packId > this.DEFAULTAMOUNT) {
      return this.SkinList[packId - 100];
    } else {
      return this.SkinList[packId];
    }
  }
}
