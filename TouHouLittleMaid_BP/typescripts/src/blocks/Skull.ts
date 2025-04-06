/**
 * 在ts定义中，permutation.withState 目前只能用原版属性，但实际上非原版的也可以
 * 需要在 mojang-block.d.ts 的 BlockStateSuperset 补充定义，详见项目的 .Update 文件夹
 */
import { Direction, StartupEvent } from "@minecraft/server";

export class Skull {
  static registerCC(event: StartupEvent) {
    event.blockComponentRegistry.registerCustomComponent("tlm:skull", {
      beforeOnPlayerPlace(e) {
        if (e.face === Direction.Down) {
          e.permutationToPlace = e.permutationToPlace.withState('thlm:is_down', true);
        }
      }
    })
  }
}