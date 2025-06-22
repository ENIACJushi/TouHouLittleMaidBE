import {
  Container
} from '@minecraft/server';
import {
  CropData, SeedData,
} from './FarmData';

export class FarmDataManager {
  private seeds: Map<string, SeedData> = new Map();

  /**
   * 添加一种作物
   * @param cropData 一个对象，键为作物方块的id，值为作物方块达到成熟时的方块状态及能种出方块的种子
   */
  addCrop(cropData: CropData) {

  }

  /**
   * 添加一种种子
   */
  addSeed(){

  }

  /**
   * 在容器中搜索种子
   */
  searchSeeds(container: Container): number|undefined {
    return undefined;
  }
}