import {world} from "@minecraft/server";

export class MaidScheduler {
  private maidMap: Map<string, MaidSchedulerInfo> = new Map(); // 所有维度的女仆信息映射
  private readonly DIM_LIST = ["overworld", "nether", "the_end"];

  constructor() { }

  /**
   * 初始化
   */
  init() {
    this.fullRefresh();
  }

  /**
   * 刷新女仆表
   */
  fullRefresh() {
    this.DIM_LIST.forEach((dim, dimIndex) => {
      let existMaids = world.getDimension(dim).getEntities({
        type: 'thlmm:maid',
      });
      existMaids.forEach(maid => {
        let oldInfo = this.getMaidInfo(maid.id);
        if (oldInfo) {
          // 若当前该女仆已在表内，则检查维度是否变化即可
          if (oldInfo.dim !== dimIndex) {
            // 更新维度信息
            oldInfo.dim = dimIndex;
          }
        } else {
          // 若女仆不在表内，则加入表
          this.maidMap.set(maid.id, {
            dim: dimIndex,
          });
        }
      });
    });
  }

  /**
   * 获取女仆的调度信息
   * @param id 生物id
   */
  getMaidInfo(id: string) {
    return this.maidMap.get(id);
  }
}

export interface MaidSchedulerInfo {
  dim: MaidDim;
}

export enum MaidDim {
  overworld = 0,
  nether = 1,
  the_end = 2,
}
