// @ts-nocheck
import { Entity } from "@minecraft/server";
import { Vector } from "../../libs/VectorMC";
import { Work } from "../facets/Work";
import { createCropRoute } from "./CropRoute";

/**
 * 西瓜、南瓜。仍从成熟瓜蒂的朝向找到瓜。
 * 走到旁边后直接收。不再使用标记实体和索敌。
 */
export class Melon {
  static maxLack = 3; // 进入慢扫描的连续缺目标次数
  static lackStep = 5; // 慢扫描等待步数
  static minCount = 8; // 缺目标的最大目标数
  static maxCount = 20; // 单次扫描最多记下的瓜
  static claimRange = 15;

  /**
   * 破坏任务上的瓜。走到之后只收一次。
   * 使用场景：落脚点抵达，或人已经在旁边。
   */
  static acquireAt(maid, task) {
    const block = maid.dimension.getBlock(new Vector(task.x, task.y, task.z));
    if (
      block !== undefined &&
      (block.typeId === "minecraft:melon_block" ||
        block.typeId === "minecraft:pumpkin")
    ) {
      block.dimension.runCommand(
        `setblock ${task.x} ${task.y} ${task.z} air destroy`
      );
    }
  }

  /**
   * 从成熟瓜蒂定位瓜的坐标，不放标记。
   * 瓜蒂朝向仍是 2：z-1，3：z+1，4：x-1，5：x+1。
   * @returns {{x:number,y:number,z:number}[]}
   */
  static collectTasks(maid, range) {
    const dimension = maid.dimension;
    const location = maid.location;
    const xStart = Math.floor(location.x);
    const zStart = Math.floor(location.z);
    let y = Math.floor(location.y);
    const seen = new Set();
    const tasks = [];
    let count = 0;
    const MAX = 3;
    const pushFruit = (fruit) => {
      const key = `${fruit.x},${fruit.y},${fruit.z}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      tasks.push({
        x: Math.floor(fruit.x),
        y: Math.floor(fruit.y),
        z: Math.floor(fruit.z),
      });
      count++;
      y = fruit.y;
    };
    for (let ix = 0; ix < range; ix = ix > 0 ? -ix : 1 - ix) {
      for (let iz = 0; iz < range; iz = iz > 0 ? -iz : 1 - iz) {
        if (count > this.maxCount) {
          return tasks;
        }
        const x = xStart + ix;
        const z = zStart + iz;
        const column = `${x},${z}`;
        if (seen.has(column)) {
          continue;
        }
        for (let iy = 0; iy < MAX; iy = iy > 0 ? -iy : 1 - iy) {
          let block;
          try {
            block = dimension.getBlock(new Vector(x, y + iy, z));
          } catch {
            continue;
          }
          if (
            block === undefined ||
            (block.typeId !== "minecraft:melon_stem" &&
              block.typeId !== "minecraft:pumpkin_stem")
          ) {
            continue;
          }
          if (block.permutation.getState("growth") === 7) {
            const fruit = {
              x: block.location.x,
              y: block.location.y,
              z: block.location.z,
            };
            switch (block.permutation.getState("facing_direction")) {
              case 2:
                fruit.z--;
                pushFruit(fruit);
                break;
              case 3:
                fruit.z++;
                pushFruit(fruit);
                break;
              case 4:
                fruit.x--;
                pushFruit(fruit);
                break;
              case 5:
                fruit.x++;
                pushFruit(fruit);
                break;
              default:
                break;
            }
          }
          seen.add(column);
          break;
        }
      }
    }
    return tasks;
  }

  /**
   * 寻找瓜并派出下一格。
   * @param {Entity} maid
   * @param {number} range
   */
  static search(maid, range = 6) {
    melonRoute.search(maid, range);
  }

  /**
   * 调度脉冲。使用场景：MaidTarget.stepEvent。
   * @param {Entity} maid
   */
  static onSchedulePulse(maid) {
    melonRoute.onSchedulePulse(maid);
  }
}

/** 瓜走共享认领。 */
const melonRoute = createCropRoute({
  tag: "Melon",
  workId: Work.melon,
  jobKey: "thlm:melon_job",
  maxLack: Melon.maxLack,
  lackStep: Melon.lackStep,
  minCount: Melon.minCount,
  claimRange: Melon.claimRange,
  collect: (maid, range) => Melon.collectTasks(maid, range),
  acquireAt: (maid, task) => Melon.acquireAt(maid, task),
});
