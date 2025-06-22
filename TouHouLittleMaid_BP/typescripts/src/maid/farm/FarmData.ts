/**
 * 农作数据定义
 */

import {
  BlockJNbt,
  ItemJNbt,
} from '../../common/main';
import {Vector} from "../../libs/VectorMC";


/**
 * 定义方块达到成熟时的状态（state），以及何种种子（seed）能种出这种作物
 */
export interface CropData {
  block: BlockJNbt.BlockJNbt; // 方块JsonNbt
  seeds_id: string[]; // 种子id
  loots: CorpLootData[]; // 破坏方块后的掉落
}

export interface CorpLootData {
  /**
   * 掉落物类型
   *  break: 直接破坏方块
   *  item: 掉落指定物品
   *  block: 放置方块
   */
  type: 'break' | 'item' | 'block';
  item?: ItemJNbt.ItemStackJNbt; // 类型为item时掉落的物品
  block?: SeedlingBlockData; // 类型为block时放置的方块
}

/**
 * 种子数据
 */
export interface SeedData {
  id: string;
  item?: ItemJNbt.ItemStackJNbt; // 物品，不指定时使用和id同名的物品
  seedling_blocks: SeedlingBlockData[]; // 种植后得到的幼苗方块，可指定多格
  lands: BlockJNbt.BlockJNbt[]; // 需要种在何种方块上
}

export interface SeedlingBlockData extends BlockJNbt.BlockJNbt{
  pos?: Vector; // 位置，以耕地上方一格为 0,0,0，不指定时即为地上方一格
}


let sample: CropData = {
  block: {
    name: 'huh'
  },
  seeds_id: [
    'huh'
  ],
  loots: [
    {
      type: 'break'
    },
    {
      type: 'item',
      item: {
        name: 'huh',
        amount: 1,
      }
    }
  ]
}

let seedSample: SeedData = {
  id: 'huh',
  seedling_blocks: [{
    pos: {x: 0, y: 0, z: 0},
    name: 'minecraft:wheat',
    states: {
      'growth': 7
    }
  }],
  lands: [{
    name: 'minecraft:farmland',
  }]
}