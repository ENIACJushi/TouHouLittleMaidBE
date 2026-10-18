// @ts-nocheck
import { Entity } from "@minecraft/server";
import { Vector } from "../../libs/VectorMC";
import { EntityMaid } from "../EntityMaid";
import { Work } from "../facets/Work";
import { createCropRoute } from "./CropRoute";

/**
 * 可可豆。仍找 age=2 的可可，并记住 direction 用来补种。
 * 走到旁边后收掉并尝试补种。不再使用标记实体和索敌。
 */
export class Cocoa {
  static maxLack = 3; // 进入慢扫描的连续缺目标次数
  static lackStep = 5; // 慢扫描等待步数
  static minCount = 8; // 缺目标的最大目标数
  static maxCount = 20; // 单次扫描最多记下的可可
  static claimRange = 15;

  /**
   * 收掉成熟可可。背包里有可可豆就按记下的方向补种。
   * 使用场景：走到旁边或人已经在旁边。
   */
  static acquireAt(maid, task) {
    const block = maid.dimension.getBlock(new Vector(task.x, task.y, task.z));
    if (block === undefined) {
      return;
    }
    let direction = task.direction;
    if (block.typeId === "minecraft:cocoa") {
      if (block.permutation.getState("age") !== 2) {
        return;
      }
      if (direction === undefined) {
        direction = block.permutation.getState("direction");
      }
      block.dimension.runCommand(
        `setblock ${task.x} ${task.y} ${task.z} air destroy`
      );
    } else if (block.typeId !== "minecraft:air") {
      return;
    }
    if (direction === undefined) {
      return;
    }
    if (
      EntityMaid.Backpack.removeItem_type(maid, "minecraft:cocoa_beans", 1) ===
      true
    ) {
      maid.dimension.runCommand(
        `setblock ${task.x} ${task.y} ${task.z} cocoa ["direction"=${direction},"age"=0] keep`
      );
    }
  }

  /**
   * 整列寻找成熟可可，不放标记。竖向范围与原来一致：女仆脚位 +4 到 -1。
   * @returns {{x:number,y:number,z:number,direction:number}[]}
   */
  static collectTasks(maid, range) {
    const dimension = maid.dimension;
    const location = maid.location;
    const xStart = Math.floor(location.x);
    const zStart = Math.floor(location.z);
    const y = Math.floor(location.y);
    const tasks = [];
    const seen = new Set();
    let count = 0;
    for (let ix = 0; ix < range; ix = ix > 0 ? -ix : 1 - ix) {
      for (let iz = 0; iz < range; iz = iz > 0 ? -iz : 1 - iz) {
        if (count > this.maxCount) {
          return tasks;
        }
        const x = xStart + ix;
        const z = zStart + iz;
        for (let iy = 4; iy > -2; iy--) {
          let block;
          try {
            block = dimension.getBlock(new Vector(x, y + iy, z));
          } catch {
            continue;
          }
          if (
            block === undefined ||
            block.typeId !== "minecraft:cocoa" ||
            block.permutation.getState("age") !== 2
          ) {
            continue;
          }
          const pos = block.location;
          const key = `${pos.x},${pos.y},${pos.z}`;
          if (seen.has(key)) {
            continue;
          }
          seen.add(key);
          tasks.push({
            x: Math.floor(pos.x),
            y: Math.floor(pos.y),
            z: Math.floor(pos.z),
            direction: block.permutation.getState("direction"),
          });
          count++;
        }
      }
    }
    return tasks;
  }

  /**
   * 寻找可可并派出下一格。
   * @param {Entity} maid
   * @param {number} range
   */
  static search(maid, range = 6) {
    cocoaRoute.search(maid, range);
  }

  /**
   * 调度脉冲。使用场景：MaidTarget.stepEvent。
   * @param {Entity} maid
   */
  static onSchedulePulse(maid) {
    cocoaRoute.onSchedulePulse(maid);
  }

  /** 离开可可或人失效时解开占用。使用场景：MaidTarget。 */
  static abandon(maid) {
    cocoaRoute.abandon(maid);
  }

  /** 人已不在世界里。使用场景：MaidTarget。 */
  static markStale(ownerId) {
    cocoaRoute.markStale(ownerId);
  }

  /** 再次加载后清残留任务。使用场景：thlmm:t。 */
  static settle(maid) {
    cocoaRoute.settle(maid);
  }
}

/** 可可走共享认领。 */
const cocoaRoute = createCropRoute({
  tag: "Cocoa",
  workId: Work.cocoa,
  jobKey: "thlm:cocoa_job",
  maxLack: Cocoa.maxLack,
  lackStep: Cocoa.lackStep,
  minCount: Cocoa.minCount,
  claimRange: Cocoa.claimRange,
  collect: (maid, range) => Cocoa.collectTasks(maid, range),
  acquireAt: (maid, task) => Cocoa.acquireAt(maid, task),
});
