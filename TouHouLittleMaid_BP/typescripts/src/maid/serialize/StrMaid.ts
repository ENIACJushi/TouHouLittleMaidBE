/**
 * 字符串化的女仆信息
 * 格式 OoooHhhhhSssssMm
 *
 * 编码布局冻结：字段字符位置/长度必须与旧 StrMaid.js 逐字段一致，禁止改动。
 */
/**
 * 手工对照用例（与旧文件头测试注释等价）：
 *   let info = ""
 *   info = StrMaid.Owner.setID(info, "-4294967256");
 *   info = StrMaid.Health.set(info, 9961, 65535)
 *   info = StrMaid.Skin.set(info, 0, 10);
 *   info = StrMaid.Work.set(info, 6);
 *   info = StrMaid.backpackInvisibility.set(info, true);
 *   // get 结果应与旧实现一致：OwnerID / Health / Skin / Work / backpackInvisibility
 */

import { Work } from "../facets/Work";

/** 生命值对 */
export type StrMaidHealth = { current: number; max: number };
/** 皮肤包索引对 */
export type StrMaidSkin = { pack: number; index: number };

/**
 * 女仆状态字符串编解码（静态 API 与旧 StrMaid 同名）
 */
export class StrMaid {
  /**
   * 格式化输出 rawtext
   */
  static formatOutput(maidStr: string): object[] {
    let rawtext: object[] = [];
    // 标题
    rawtext.push({ "translate": "message.tlm.admin.item_info" });
    rawtext.push({ "text": "\n" });
    // 女仆名称
    rawtext.push({ "translate": "message.tlm.admin.maid.name" });
    rawtext.push({ "text": `${this.Str.getMaidName(maidStr)}\n` });
    // 主人名称
    rawtext.push({ "translate": "message.tlm.admin.maid.owner.name" });
    rawtext.push({ "text": `${this.Str.getOwnerName(maidStr)}\n` });
    // 主人ID
    rawtext.push({ "translate": "message.tlm.admin.maid.owner.id" });
    rawtext.push({ "text": `${this.Owner.getId(maidStr)}\n` });
    // 等级
    rawtext.push({ "translate": "message.tlm.admin.maid.level" });
    rawtext.push({ "text": `${this.Level.get(maidStr)}\n` });
    // 杀敌数
    rawtext.push({ "translate": "message.tlm.admin.maid.kill" });
    rawtext.push({ "text": `${this.Kill.get(maidStr)}\n` });
    // 生命值
    rawtext.push({ "translate": "message.tlm.admin.maid.health" });
    let health = this.Health.get(maidStr);
    rawtext.push({ "text": `${health!.current}/${health!.max}\n` });
    // 工作模式（facets.Work，不再依赖 EntityMaid）
    rawtext.push({ "translate": "message.tlm.admin.maid.work" });
    rawtext.push({ "text": `${Work.getName(this.Work.get(maidStr)!)}\n` });
    // 隐藏背包
    rawtext.push({ "translate": "message.tlm.admin.maid.backpack" });
    rawtext.push({ "text": `${this.backpackInvisibility.get(maidStr)}\n` });
    // 拾物模式
    rawtext.push({ "translate": "message.tlm.admin.maid.pick" });
    rawtext.push({ "text": `${this.Pick.get(maidStr)}\n` });
    // 静音模式
    rawtext.push({ "translate": "message.tlm.admin.maid.mute" });
    rawtext.push({ "text": `${this.Mute.get(maidStr)}\n` });

    return rawtext;
  }
  // L O H S W B P M N K
  // L 等级
  static Level = {
    /**
     * 获取等级
     */
    get(maidStr: string): number | undefined {
      let str = StrHelper.getValue(maidStr, "L", 1);
      if (str === undefined) return undefined;
      return StrHelper.str2short(str);
    },
    /**
     * 设置等级
     */
    set(maidStr: string, index: number): string {
      let str = StrHelper.short2str(index);
      return StrHelper.setValue(maidStr, "L", str);
    },
  };
  // K 杀敌数
  static Kill = {
    /**
     * 获取杀敌数
     */
    get(maidStr: string): number | undefined {
      let str = StrHelper.getValue(maidStr, "K", 2);
      if (str === undefined) return undefined;
      return StrHelper.str2int(str.slice(0, 2));
    },
    /**
     * 设置杀敌数
     */
    set(maidStr: string, amount: number): string {
      let str = StrHelper.int2str(amount);
      return StrHelper.setValue(maidStr, "K", str);
    },
  };
  // O 主人生物ID 可为空
  static Owner = {
    /**
     * 获取字符串包含的主人ID
     */
    getId(maidStr: string): string | undefined {
      let str = StrHelper.getValue(maidStr, "O", 5);
      if (str === undefined) return undefined;
      return `-${StrHelper.str2ID(str)}`;
    },
    /**
     * 为字符串设置主人ID
     */
    setID(maidStr: string, ownerID: string): string {
      let numID = parseInt(ownerID.slice(1));
      let strID = StrHelper.ID2str(numID);
      return StrHelper.setValue(maidStr, "O", strID);
    },
  };
  // H 生命值 左2当前值 右2最大值
  static Health = {
    /**
     * 获取生命值  {current:1, max:1}
     */
    get(maidStr: string): StrMaidHealth | undefined {
      let str = StrHelper.getValue(maidStr, "H", 4);
      if (str === undefined) return undefined;
      return {
        current: StrHelper.str2int(str.slice(0, 2)),
        max: StrHelper.str2int(str.slice(2, 4)),
      };
    },
    /**
     * 设置生命值 当前值和最大值需要同时设定
     */
    set(maidStr: string, current: number, max: number): string {
      let str = StrHelper.int2str(current) + StrHelper.int2str(max);
      return StrHelper.setValue(maidStr, "H", str);
    },
  };
  // S 皮肤 左2包 右2索引
  static Skin = {
    /**
     * 获取皮肤
     */
    get(maidStr: string): StrMaidSkin {
      let str = StrHelper.getValue(maidStr, "S", 4);
      if (str === undefined) {
        return { pack: 0, index: 0 };
      }
      return {
        pack: StrHelper.str2int(str.slice(0, 2)),
        index: StrHelper.str2int(str.slice(2, 4)),
      };
    },
    /**
     * 设置皮肤 包编号与索引需要同时设定
     */
    set(maidStr: string, pack: number, index: number): string {
      let str = StrHelper.int2str(pack) + StrHelper.int2str(index);
      return StrHelper.setValue(maidStr, "S", str);
    },
  };
  // W 工作模式
  static Work = {
    /**
     * 获取工作模式
     */
    get(maidStr: string): number | undefined {
      let str = StrHelper.getValue(maidStr, "W", 2);
      if (str === undefined) return undefined;
      return StrHelper.str2int(str.slice(0, 2));
    },
    /**
     * 设置工作模式
     */
    set(maidStr: string, index: number): string {
      let str = StrHelper.int2str(index);
      return StrHelper.setValue(maidStr, "W", str);
    },
  };
  // B 背包是否隐藏
  static backpackInvisibility = {
    /**
     * 获取是否隐藏
     */
    get(maidStr: string): boolean | undefined {
      let str = StrHelper.getValue(maidStr, "B", 1);
      if (str === undefined) return undefined;
      return StrHelper.str2bool(str);
    },
    /**
     * 设置是否隐藏
     */
    set(maidStr: string, value: boolean): string {
      let str = StrHelper.bool2str(value);
      return StrHelper.setValue(maidStr, "B", str);
    },
  };
  // C 背包类型
  static backpackType = {
    /**
     * 获取背包类型
     */
    get(maidStr: string): number | undefined {
      let str = StrHelper.getValue(maidStr, "C", 2);
      if (str === undefined) return undefined;
      return StrHelper.str2int(str.slice(0, 2));
    },
    /**
     * 设置背包类型
     */
    set(maidStr: string, type: number): string {
      let str = StrHelper.int2str(type);
      return StrHelper.setValue(maidStr, "C", str);
    },
  };
  // P 拾物模式
  static Pick = {
    /**
     * 获取模式
     */
    get(maidStr: string): boolean {
      let str = StrHelper.getValue(maidStr, "P", 1);
      if (str === undefined) return true;
      return StrHelper.str2bool(str);
    },
    /**
     * 设置模式
     */
    set(maidStr: string, value: boolean): string {
      let str = StrHelper.bool2str(value);
      return StrHelper.setValue(maidStr, "P", str);
    },
  };
  // M 静音模式
  static Mute = {
    /**
     * 获取模式
     */
    get(maidStr: string): boolean {
      let str = StrHelper.getValue(maidStr, "M", 1);
      if (str === undefined) return false;
      return StrHelper.str2bool(str);
    },
    /**
     * 设置模式
     */
    set(maidStr: string, value: boolean): string {
      let str = StrHelper.bool2str(value);
      return StrHelper.setValue(maidStr, "M", str);
    },
  };
  // I 是否坐下
  static Sit = {
    /**
     * 获取模式
     */
    get(maidStr: string): boolean {
      let str = StrHelper.getValue(maidStr, "I", 1);
      if (str === undefined) return false;
      return StrHelper.str2bool(str);
    },
    /**
     * 设置模式
     */
    set(maidStr: string, value: boolean): string {
      let str = StrHelper.bool2str(value);
      return StrHelper.setValue(maidStr, "I", str);
    },
  };
  /**
   * N 字符串数据，放在最后，使用json数组格式存储： ["12",0,0]
   * 数据为空时，设为数字 0，因为只占一个字符的位置
   * 包含数据：主人名称 女仆名称
   * 当数据没有被设置时，留空
   */
  static Str = {
    //// 指定键操作 ////
    // 数据数量，向少兼容
    amount: 2,
    /**
     * 获取主人名称
     */
    getOwnerName(maidStr: string): string | undefined {
      return this.getValue(maidStr, 0);
    },
    /**
     * 设置主人名称
     */
    setOwnerName(maidStr: string, value: string | undefined): string {
      return this.setValue(maidStr, 0, value);
    },
    /**
     * 获取女仆名称
     */
    getMaidName(maidStr: string): string | undefined {
      return this.getValue(maidStr, 1);
    },
    /**
     * 设置女仆名称
     */
    setMaidName(maidStr: string, value: string | undefined): string {
      return this.setValue(maidStr, 1, value);
    },

    //// 基础操作 ////
    /**
     * 获取所有字符串数据
     */
    get(maidStr: string): (string | number)[] | undefined {
      try {
        let str = StrHelper.getValue(maidStr, "N", undefined);
        if (str === undefined) return undefined;
        return JSON.parse(str);
      }
      catch {
        return undefined;
      }
    },
    /**
     * 设置所有字符串数据
     */
    set(maidStr: string, value: (string | number)[]): string {
      try {
        return StrHelper.setValue(maidStr, "N", JSON.stringify(value));
      }
      catch {
        return maidStr;
      }
    },
    /**
     * 设置指定位置的数据
     */
    setValue(maidStr: string, index: number, value: string | undefined): string {
      // 获取旧值
      let oldValue = this.get(maidStr);
      if (oldValue === undefined) {
        // 不存在则新建
        oldValue = [];
        for (let i = 0; i < this.amount; i++) {
          oldValue[i] = 0;
        }
      }
      else {
        // 若数组长度比数据量小，则补齐空字符串
        for (let i = oldValue.length - 1; i < this.amount; i++) {
          oldValue[i] = 0;
        }
      }

      // 设置新值
      oldValue[index] = value === undefined ? 0 : value;
      return this.set(maidStr, oldValue);
    },
    /**
     * 获取指定位置的数据
     */
    getValue(maidStr: string, index: number): string | undefined {
      let allValues = this.get(maidStr);
      if (allValues === undefined) {
        return undefined;
      }
      else {
        let result = allValues[index];
        return result === 0 ? undefined : (result as string);
      }
    },
  };
}

/**
 * 字符串字段读写与整数压缩（布局冻结）
 */
class StrHelper {
  /**
   * 由key搜索值
   * @param length 数据长度；为 undefined 代表一直截到末尾
   */
  static getValue(str: string, key: string, length: number | undefined): string | undefined {
    let start = str.search(key);
    if (start === -1) return undefined;
    return str.slice(start + 1, length === undefined ? undefined : start + 1 + length);
  }
  /**
   * 由key value设置值；值不存在则新建
   */
  static setValue(str: string, key: string, value: string): string {
    let start = str.search(key);
    if (start === -1) {
      return str + key + value;
    }
    else {
      return str.slice(0, start) + key + value + str.slice(start + 1 + value.length);
    }
  }

  /// 整数压缩
  /**
   * 将短整型转为两位字符
   * 为了避开特殊字符，选定特定范围的字符作为存储用字符
   */
  static int2str(num: number): string {
    let high8 = Math.floor(num / 0x100);
    let low8 = Math.floor(num % 0x100);
    return String.fromCodePoint(0xA000 + high8) + String.fromCodePoint(0xA000 + low8);
  }
  /**
   * 将两位字符转为短整型
   */
  static str2int(str: string): number {
    let high8 = str.charCodeAt(0) - 0xA000;
    let low8 = str.charCodeAt(1) - 0xA000;
    return high8 * 0x100 + low8;
  }

  /**
   * 将整数(0~4,095)转为 1 位字符
   */
  static short2str(num: number): string {
    return String.fromCodePoint(0xA000 + num);
  }
  /**
   * 将 1 位字符转为短整型
   */
  static str2short(str: string): number {
    return str.charCodeAt(0) - 0xA000;
  }

  /**
   * 将正整数转为 5 位字符
   */
  static ID2str(num: number): string {
    let low1_12 = num % 0x1000;
    let low2_12 = Math.floor(num % 0x1000000 / 0x1000);
    let mid_12 = Math.floor(num % 0x1000000000 / 0x1000000);
    let high1_12 = Math.floor(num % 0x1000000000000 / 0x1000000000);
    let high2_5 = Math.floor(num / 0x1000000000000);
    return String.fromCodePoint(0xA000 + high2_5)
      + String.fromCodePoint(0xA000 + high1_12)
      + String.fromCodePoint(0xA000 + mid_12)
      + String.fromCodePoint(0xA000 + low2_12)
      + String.fromCodePoint(0xA000 + low1_12);
  }
  /**
   * 将 5 位字符转为正整数
   */
  static str2ID(str: string): number {
    let high2_5 = str.charCodeAt(0) - 0xA000;
    let high1_12 = str.charCodeAt(1) - 0xA000;
    let mid_12 = str.charCodeAt(2) - 0xA000;
    let low2_12 = str.charCodeAt(3) - 0xA000;
    let low1_12 = str.charCodeAt(4) - 0xA000;
    return high2_5 * 0x1000000000000
      + high1_12 * 0x1000000000
      + mid_12 * 0x1000000
      + low2_12 * 0x1000
      + low1_12;
  }
  // 布尔转换
  static str2bool(str: string): boolean {
    if (str === "0") return false;
    return true;
  }
  static bool2str(value: boolean): string {
    return value === true ? "1" : "0";
  }
}
