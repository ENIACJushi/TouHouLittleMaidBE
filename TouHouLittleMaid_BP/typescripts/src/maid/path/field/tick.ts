/**
 * 落脚点表的每拍维护。
 * 使用场景：世界加载后挂一次。按女仆的家框或跟随圈判断区块能不能丢掉。
 */
import { system, world } from "@minecraft/server";
import { EntityMaid } from "../../EntityMaid";
import { tickStandField } from "./StandField";

/** 家框水平半径，和回家传送用的是同一圈 */
const HOME_RADIUS = 32;
/** NPC 工作 id 为 -1 时家框只有 2 格 */
const NPC_HOME_RADIUS = 2;
/** 跟随主人时的水平圈。实体 follow_range 也是 32 */
const FOLLOW_RADIUS = 32;
const MAID_TYPE = "thlmm:maid";
const DIM_IDS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];

type Circle = { minX: number; maxX: number; minZ: number; maxZ: number };

let handle: number | undefined;
/** 丢区块不用每拍扫一遍女仆，大约一秒看一次 */
let discardIn = 0;

/**
 * 这一拍每个女仆的活动圈（家框或跟随主人的那一圈）。
 * 使用场景：区块丢弃。不看玩家自己站在哪。
 */
function circlesIn(dimId: string): Circle[] {
  const out: Circle[] = [];
  let dim;
  try {
    dim = world.getDimension(dimId);
  } catch {
    return out;
  }
  let maids;
  try {
    maids = dim.getEntities({ type: MAID_TYPE });
  } catch {
    return out;
  }
  for (const maid of maids) {
    if (!maid.isValid) {
      continue;
    }
    if (EntityMaid.Home.getMode(maid)) {
      const home = EntityMaid.Home.getLocation(maid);
      if (!home || home[3] !== dimId) {
        continue;
      }
      const radius = EntityMaid.Work.get(maid) === -1 ? NPC_HOME_RADIUS : HOME_RADIUS;
      out.push({
        minX: home[0] - radius,
        maxX: home[0] + radius,
        minZ: home[2] - radius,
        maxZ: home[2] + radius,
      });
      continue;
    }
    const owner = EntityMaid.Owner.get(maid);
    if (!owner?.isValid || owner.dimension.id !== dimId) {
      continue;
    }
    out.push({
      minX: owner.location.x - FOLLOW_RADIUS,
      maxX: owner.location.x + FOLLOW_RADIUS,
      minZ: owner.location.z - FOLLOW_RADIUS,
      maxZ: owner.location.z + FOLLOW_RADIUS,
    });
  }
  return out;
}

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
      tickStandField(dim, checkDiscard ? circlesIn(dimId) : undefined);
    }
  }, 1);
}
