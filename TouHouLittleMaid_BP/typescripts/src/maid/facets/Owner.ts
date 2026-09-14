import { Entity, EntityTameableComponent, Player, world } from "@minecraft/server";
import { TagDataHelper } from "../../libs/TagDataInterface";

/**
 * 主人相关读写（行为对齐 EntityMaid.Owner）
 */
export const Owner = {
  /**
   * 更新动态属性的数据
   */
  refresh(maid: Entity): void {
    let tameable = maid.getComponent("tameable") as EntityTameableComponent;
    // if(tameable === undefined) return;

    if (tameable.tamedToPlayerId !== undefined) {
      this.setID(maid, tameable.tamedToPlayerId);
    }
    if (tameable.tamedToPlayer !== undefined) {
      this.setName(maid, tameable.tamedToPlayer.name);
    }
  },
  /**
   * 是否有主人
   */
  has(maid: Entity): boolean {
    if (this.getID(maid) === undefined && this.getName(maid) == undefined) {
      return false;
    }
    return true;
  },
  /**
   * 获取主人ID
   */
  getID(maid: Entity): string | undefined {
    return TagDataHelper.get(maid, "thlmo:");
  },
  /**
   * 设置主人ID
   */
  setID(maid: Entity, id: string): void {
    TagDataHelper.del(maid, "thlmo:");
    TagDataHelper.set(maid, "thlmo:", id);
  },
  /**
   * 获取主人名称
   */
  getName(maid: Entity): string | undefined {
    return TagDataHelper.get(maid, "thlmn:");
  },
  /**
   * 设置主人名称
   */
  setName(maid: Entity, name: string): void {
    TagDataHelper.del(maid, "thlmn:");
    TagDataHelper.set(maid, "thlmn:", name);
  },
  /**
   * 获取主人实体
   */
  get(maid: Entity): Player | undefined {
    let id = this.getID(maid);
    if (id !== undefined) {
      return world.getEntity(id) as Player | undefined;
    }
    let name = this.getName(maid);
    if (name !== undefined) {
      let players = world.getPlayers({ "name": name });
      // 对齐旧实现：原代码对查询结果调用 length()
      if ((players as unknown as { length(): number }).length() !== 0) {
        return players[0];
      }
    }
    return undefined;
  },
  /**
   * 设置主人实体
   */
  set(maid: Entity, player: Player): void {
    (maid.getComponent("tameable") as EntityTameableComponent).tame(player);
    this.setID(maid, player.id);
    this.setName(maid, player.name);
  },
};
