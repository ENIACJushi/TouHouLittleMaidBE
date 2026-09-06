import { CHAIR_IDENTIFIER } from "./EntityChair";

/** 坐垫显示器物品 ID（与御币同属 tlmsi 命名空间） */
export const CHAIR_SHOW_ITEM_IDENTIFIER = "tlmsi:chair_show";
/** 手持显示器时激活附近坐垫的半径 */
const ACTIVATE_RADIUS = 10;

/**
 * 坐垫显示器：手持时激活附近坐垫的碰撞箱展示状态
 * 恢复（关闭展示）由实体 JSON 的 entity_sensor 负责。
 */
export class ChairShow {
  /**
   * 激活玩家附近坐垫的碰撞箱展示
   * @param {import("@minecraft/server").Player} player
   */
  static activateNearby(player) {
    if (!player.isSneaking) {
      return;
    }
    let chairs;
    try {
      chairs = player.dimension.getEntities({
        type: CHAIR_IDENTIFIER,
        location: player.location,
        maxDistance: ACTIVATE_RADIUS,
      });
    } catch (_) {
      return;
    }
    for (const chair of chairs) {
      try {
        if (!chair.isValid) {
          continue;
        }
        // 已在展示状态则跳过，避免重复 trigger
        if (chair.getProperty("thlm:show_hitbox") === true) {
          continue;
        }
        chair.triggerEvent("thlm:show_hitbox");
      } catch (_) {
        // 实体可能已卸载
      }
    }
  }
}
