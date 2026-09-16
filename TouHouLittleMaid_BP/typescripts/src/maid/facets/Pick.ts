import { Entity, EntityItemComponent } from "@minecraft/server";
import { DP } from "../../libs/DynamicPropertyInterface";
import { Anim } from "./Anim";
import { Backpack } from "./Backpack";

/**
 * 拾物模式与磁力吸取（行为对齐 EntityMaid.Pick）
 */
export const Pick = {
  /**
   * 设置模式
   */
  set(maid: Entity, value: boolean): void {
    if (value) {
      // 坐下时用静止拾物组，站立时用行走拾物组
      maid.triggerEvent(Anim.isSitting(maid) ? "api:mode_pick_sit" : "api:mode_pick");
    } else {
      maid.triggerEvent("api:mode_quit_pick");
    }
    DP.setBoolean(maid, "pick", value);
  },
  switchMode(maid: Entity): void {
    this.set(maid, !this.get(maid));
  },
  /**
   * 获取模式
   */
  get(maid: Entity): boolean {
    return DP.getBoolean(maid, "pick")!;
  },
  /**
   * 吸取范围内的物品
   */
  magnet(maid: Entity, range: number): void {
    let container = Backpack.getContainer(maid)!;

    let items = maid.dimension.getEntities({
      "location": maid.location,
      "type": "minecraft:item",
      "maxDistance": range,
    });
    for (let item of items) {
      let itemStack = (item.getComponent("minecraft:item") as EntityItemComponent).itemStack;
      let beforeAmount = itemStack.amount;

      let result = container.addItem(itemStack);
      if (result === undefined) {
        item.dimension.spawnParticle("touhou_little_maid:item_get", item.location);
        item.remove();
      }
      else if (beforeAmount !== result.amount) {
        item.dimension.spawnItem(result, item.location).clearVelocity();
        item.dimension.spawnParticle("touhou_little_maid:item_get", item.location);
        item.remove();
      }
    }
  },
  getImg(is_open: boolean): string {
    return is_open ? "textures/gui/pick_activate.png" : "textures/gui/pick_deactivate.png";
  },
  getLang(is_open: boolean): string {
    return is_open
      ? "gui.touhou_little_maid:button.pick.true.name"
      : "gui.touhou_little_maid:button.pick.false.name";
  },
};
