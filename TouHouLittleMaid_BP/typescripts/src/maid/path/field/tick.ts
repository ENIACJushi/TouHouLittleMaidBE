/**
 * 落脚点表的每拍维护。
 * 使用场景：世界加载后挂一次。按女仆的家框或跟随圈判断区块能不能丢掉。
 */
import { system, world } from "@minecraft/server";
import { activityCirclesIn } from "./activityCircle";
import { tickStandField } from "./StandField";

const DIM_IDS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];

let handle: number | undefined;
/** 丢区块不用每拍扫一遍女仆，大约一秒看一次 */
let discardIn = 0;

/**
 * 挂上每拍维护。重复调用不会再挂一次。
 * 使用场景：脚本入口。
 */
export function initStandField(): void {
  if (handle !== undefined) {
    return;
  }
  handle = system.runInterval(() => {
    discardIn -= 1;
    const checkDiscard = discardIn <= 0;
    if (checkDiscard) {
      discardIn = 20;
    }
    for (const dimId of DIM_IDS) {
      let dim;
      try {
        dim = world.getDimension(dimId);
      } catch {
        continue;
      }
      tickStandField(dim, checkDiscard ? activityCirclesIn(dimId) : undefined);
    }
  }, 1);
}
