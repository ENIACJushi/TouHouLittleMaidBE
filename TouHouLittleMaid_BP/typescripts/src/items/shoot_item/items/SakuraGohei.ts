import {
  ShootItemAutomatic,
  GoheiAutomaticModeShotParams,
} from "./template/ShootItemAutomatic";
import { ItemTool } from "../../../libs/ScarletToolKit";
import { EffectHelper } from "../../../libs/ScarletToolKit/EffectHelper";
import { SakuraLaser } from "../../../danmaku/shapes/laser/SakuraLaser";
import {ItemStack} from "@minecraft/server";
import {LineShoot} from "../../../danmaku/shoots/LineShoot";
import {EntityDanmakuActor} from "../../../danmaku/actors/EntityDanmakuActor";
import {Vector} from "../../../libs/VectorMC";

/**
 * 发射符札的御币
 */
export class SakuraGohei extends ShootItemAutomatic {
  private readonly ITEM_TYPE_ID = 'tlmsi:sakura_gohei'; // 物品id

  // 射击函数
  shoot(params: GoheiAutomaticModeShotParams): boolean {
    let multiShot = ItemTool.getEnchantmentLevel(params.item, 'multishot'); // 多重射击
    let piercing = ItemTool.getEnchantmentLevel(params.item, 'piercing'); // 穿透
    // 进行一次发射
    let shoot = new LineShoot({
      shape: new SakuraLaser()
        .setDamageArea(3)
        .setDamageCenter(9)
        .setPiercing(3),
      thrower: new EntityDanmakuActor(params.entity)
        .setHead(true),
    });
    shoot.shootByVelocity(params.entity.getViewDirection());
    return true;
  }

  // 物品是否是樱之御币
  isShootItem(item: ItemStack): boolean {
    return item.typeId === this.ITEM_TYPE_ID;
  }
}
