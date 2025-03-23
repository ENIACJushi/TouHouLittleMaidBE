
import { Data as Vallina } from "./Vallina";
import { Data as FarmersDelight } from "./FarmersDelight";
import { Data as CornDelight } from "./CornDelight";
import { Data as ccgy } from "./ccgy";

var checkList = [
  Vallina,       // 原版
  FarmersDelight,// 农夫乐事
  CornDelight,   // 玉米乐事
  ccgy           // 餐厨工艺
];

//////////////////////////////////////////////////////////////////////

import { BlockPermutation, ItemStack } from "@minecraft/server";
import { logger, logger_debug } from "../../src/libs/ScarletToolKit";

class FarmBlocks {
  Data = {
    crops: {}, // 作物
    seeds: {}, // 种子
    lands: {}  // 耕地（根据种子自动生成）
  }
  corpList = [];
  landList = [];
  constructor() {
    for (let addonData of checkList) {
      try {
        new ItemStack(addonData.tester, 1);
        // logger("添加了一个模组" + addonData.tester);

        for (let crop in addonData.crops) {
          this.addCrop(crop, addonData.crops[crop]);
        }
        for (let seed in addonData.seeds) {
          this.addSeed(seed, addonData.seeds[seed]);
        }
      }
      catch { }
    }
    // logger(JSON.stringify(this.Data.crops));
    // logger(JSON.stringify(this.Data.seeds))
  }

  // 添加作物信息
  addCrop(key, value) {
    this.Data.crops[key] = value;
    try {
      this.corpList.push(BlockPermutation.resolve(key, value.state));
    }
    catch { };
  }

  // 添加种子信息
  addSeed(key, value) {
    if (this.Data.seeds[key] === undefined) {
      this.Data.seeds[key] = value;
    }
    else {
      for (let data of value) {
        this.Data.seeds[key].push(data);
      }
    }

    // 耕地
    for (let data of value) {
      for (let land of data.land) {
        if (this.Data.lands[land] === undefined) this.Data.lands[land] = [];
        this.Data.lands[land].push(key);
        this.landList.push(land);
      }
    }

  }

  /**
   * 获取作物信息
   * @param {string} name 
   * @returns {{state:object; seed: string; keep: {block:string; state:object; loot:string} | undefined}}}
   */
  getCorp(name) {
    return this.Data.crops[name];
  }

  /**
   * 获取种子信息
   * @param {string} name
   * @returns {{block:string; state:object; land: string[]}[]}
   */
  getSeed(name) {
    return this.Data.seeds[name];
  }

  /**
   * 获取耕地能种植的种子列表
   * @param {string} name 
   * @returns {string[] | undefined}
   */
  getLand(name) {
    return this.Data.lands[name];
  }
  /**
   * 获取所有耕地方块的名称 ，查找时使用
   * @returns {string[]}
   */
  getLands() {
    return this.landList;
  }
  /**
   * 获取所有作物方块的 Permutation ，查找时使用
   * @returns {BlockPermutation[]}
   */
  getCorpPermutations() {
    return this.corpList;
  }
}

export const farmBlocks = new FarmBlocks();