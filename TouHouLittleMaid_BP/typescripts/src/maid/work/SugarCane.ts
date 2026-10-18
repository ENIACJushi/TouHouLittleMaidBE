// @ts-nocheck
import { Entity } from "@minecraft/server";
import { Vector } from "../../libs/VectorMC";
import { Work } from "../facets/Work";
import { createCropRoute } from "./CropRoute";

/**
 * 甘蔗。扫描规则仍是「只砍土上方第二格」。
 * 落脚点和耕地一样在正下方的土上，终点实体放在要砍的那节里。
 */
export class SugarCane {
  static maxLack = 2; // 进入慢扫描的连续缺目标次数
  static lackStep = 5; // 慢扫描等待步数
  static minCount = 10; // 缺目标的最大目标数
  static maxCount = 40; // 单次扫描最多记下的格数
  static claimRange = 15;

  /**
   * 砍任务记下的那一格甘蔗，不碰下面的根。
   * 使用场景：走到旁边或人已经在旁边。
   */
  static acquireAt(maid, task) {
    const block = maid.dimension.getBlock(new Vector(task.x, task.y, task.z));
    if (block !== undefined && block.typeId === "minecraft:reeds") {
      block.dimension.runCommand(
        `setblock ${task.x} ${task.y} ${task.z} air destroy`
      );
    }
  }

  /**
   * 在范围内找出要砍的甘蔗格，不放标记。
   * 高度判断与原来的查找相同。
   * @returns {{x:number,y:number,z:number}[]}
   */
  static collectTasks(maid, range) {
    const dimension = maid.dimension;
    const location = maid.location;
    const tasks = [];
    let y = Math.floor(location.y);
    const xStart = Math.floor(location.x);
    const zStart = Math.floor(location.z);
    let count = 0;
    const MAX = 3; // 单方向最大寻找距离
    for (let ix = 0; ix < range; ix = ix > 0 ? -ix : 1 - ix) {
      for (let iz = 0; iz < range; iz = iz > 0 ? -iz : 1 - iz) {
        if (count > this.maxCount) {
          return tasks;
        }
        const x = xStart + ix;
        const z = zStart + iz;
        const A = y;
        const isTargetBlock = function (_y) {
          try {
            const block = dimension.getBlock(new Vector(x, _y, z));
            return block !== undefined && block.typeId === "minecraft:reeds";
          } catch {
            return false;
          }
        };
        const push = (py) => {
          y = py;
          tasks.push({ x, y: py, z });
          count++;
        };
        if (isTargetBlock(A)) {
          if (isTargetBlock(A - 1)) {
            const B = A - 2;
            for (let i = 0; i < MAX; i++) {
              if (!isTargetBlock(B - i)) {
                push(B - i + 2);
                break;
              }
            }
          } else if (isTargetBlock(A + 1)) {
            push(A + 1);
          }
        } else {
          let needUp = true;
          for (let i = 1; i <= MAX; i++) {
            if (isTargetBlock(A - i)) {
              if (isTargetBlock(A - i - 1)) {
                const B = A - i;
                for (let i2 = 0; i2 < MAX; i2++) {
                  if (!isTargetBlock(B - i2)) {
                    push(B - i2 + 2);
                    needUp = false;
                    break;
                  }
                }
                needUp = false;
              } else {
                needUp = false;
              }
            }
          }
          if (needUp) {
            for (let i = 1; i <= MAX; i++) {
              if (isTargetBlock(A + i)) {
                if (isTargetBlock(A + i + 1)) {
                  push(A + i);
                  break;
                }
                break;
              }
            }
          }
        }
      }
    }
    return tasks;
  }

  /**
   * 寻找甘蔗并派出下一格。
   * @param {Entity} maid
   * @param {number} range
   */
  static search(maid, range = 6) {
    sugarRoute.search(maid, range);
  }

  /**
   * 调度脉冲。使用场景：MaidTarget.stepEvent。
   * @param {Entity} maid
   */
  static onSchedulePulse(maid) {
    sugarRoute.onSchedulePulse(maid);
  }
}

/** 甘蔗走共享认领。放在类后面，避免初始化时方法还没挂上。 */
const sugarRoute = createCropRoute({
  tag: "SugarCane",
  workId: Work.sugar_cane,
  jobKey: "thlm:sugar_job",
  maxLack: SugarCane.maxLack,
  lackStep: SugarCane.lackStep,
  minCount: SugarCane.minCount,
  claimRange: SugarCane.claimRange,
  /** 耕地是作物下方 1 格；甘蔗要砍的高一格，落脚点在任务格下方 2 格 */
  standDrop: 2,
  /** 终点实体落在要砍的那节，比耕地的作物格再高 1 格 */
  goalBlocksAbove: 2,
  collect: (maid, range) => SugarCane.collectTasks(maid, range),
  acquireAt: (maid, task) => SugarCane.acquireAt(maid, task),
});
