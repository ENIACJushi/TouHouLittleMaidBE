/**
 * 女仆活动圈：只限制能认领的目标，不限制路怎么绕。
 * 使用场景：耕地选点；区块丢弃时看这块地还有没有女仆用。
 *
 * NPC（工作 id 小于 0）不寻路，没有这圈。
 * 跟随主人时圈心是主人脚下。主人已退出世界时，改以女仆脚下为中心，半径不变。
 */
import { Entity, world } from "@minecraft/server";
import { EntityMaid } from "../../EntityMaid";

/** 家框水平半径，和回家传送用的是同一圈 */
export const HOME_CIRCLE_RADIUS = 32;
/** 跟随主人时的水平圈。实体 follow_range 也是 32 */
export const FOLLOW_CIRCLE_RADIUS = 32;

const MAID_TYPE = "thlmm:maid";

/** 水平方框。比较的是格心，不是方块角。 */
export type ActivityCircle = {
  dimId: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

/**
 * 这一名女仆现在的认领圈。
 * none：NPC，或家模式还没有家坐标，或人和主人的位置都读不到。
 */
export type ActivityCircleState =
  | { kind: "circle"; circle: ActivityCircle }
  | { kind: "none" };

/**
 * 主人实体。退出世界后 getEntity 可能空，也可能直接抛错。
 * 使用场景：跟随圈。不要沿用上一次的坐标。
 */
function ownerNow(maid: Entity): Entity | undefined {
  try {
    const owner = EntityMaid.Owner.get(maid);
    if (!owner || !owner.isValid) {
      return undefined;
    }
    return owner;
  } catch {
    return undefined;
  }
}

function box(dimId: string, x: number, z: number, radius: number): ActivityCircle {
  return {
    dimId,
    minX: x - radius,
    maxX: x + radius,
    minZ: z - radius,
    maxZ: z + radius,
  };
}

/**
 * 跟随圈以女仆脚下为中心。主人不在世界里时用这个。
 * 使用场景：activityCircleOf。
 */
function circleAroundMaid(maid: Entity): ActivityCircleState {
  try {
    return {
      kind: "circle",
      circle: box(
        maid.dimension.id,
        maid.location.x,
        maid.location.z,
        FOLLOW_CIRCLE_RADIUS
      ),
    };
  } catch {
    return { kind: "none" };
  }
}

/**
 * 读这一名女仆的认领圈。
 * 使用场景：选点前。NPC 直接 none。
 */
export function activityCircleOf(maid: Entity): ActivityCircleState {
  if (!maid.isValid) {
    return { kind: "none" };
  }
  let work = 0;
  try {
    work = EntityMaid.Work.get(maid);
  } catch {
    return { kind: "none" };
  }
  if (work < 0) {
    return { kind: "none" };
  }
  if (EntityMaid.Home.getMode(maid)) {
    const home = EntityMaid.Home.getLocation(maid);
    if (!home) {
      return { kind: "none" };
    }
    return { kind: "circle", circle: box(home[3], home[0], home[2], HOME_CIRCLE_RADIUS) };
  }
  const owner = ownerNow(maid);
  if (!owner) {
    return circleAroundMaid(maid);
  }
  let dimId: string;
  let x: number;
  let z: number;
  try {
    dimId = owner.dimension.id;
    x = owner.location.x;
    z = owner.location.z;
  } catch {
    return circleAroundMaid(maid);
  }
  return {
    kind: "circle",
    circle: box(dimId, x, z, FOLLOW_CIRCLE_RADIUS),
  };
}

/**
 * 目标格心是否在圈内。维度不同算圈外。
 * 使用场景：耕地认领。途经格不要用这个函数去裁。
 */
export function isInsideActivityCircle(
  circle: ActivityCircle,
  dimId: string,
  x: number,
  z: number
): boolean {
  if (circle.dimId !== dimId) {
    return false;
  }
  const cx = x + 0.5;
  const cz = z + 0.5;
  return cx >= circle.minX && cx <= circle.maxX && cz >= circle.minZ && cz <= circle.maxZ;
}

/**
 * 这个维度里所有还能用的认领圈。
 * 使用场景：丢掉静置区块。跟随且主人不在时，圈在女仆脚下。
 */
export function activityCirclesIn(dimId: string): ActivityCircle[] {
  const out: ActivityCircle[] = [];
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
    const state = activityCircleOf(maid);
    if (state.kind === "circle" && state.circle.dimId === dimId) {
      out.push(state.circle);
    }
  }
  return out;
}
