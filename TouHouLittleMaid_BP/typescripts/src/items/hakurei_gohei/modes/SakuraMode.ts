import {
  GoheiAutomaticMode,
  GoheiAutomaticModeShotParams,
} from "./template/GoheiAutomaticMode";
import { ItemTool } from "../../../libs/ScarletToolKit";
import { EffectHelper } from "../../../libs/ScarletToolKit/EffectHelper";
import { SakuraLaser } from "../../../danmaku/patterns/SakuraLaser";
import {ItemStack} from "@minecraft/server";

/**
 * 发射符札的御币
 */
export class GoheiSakuraMode extends GoheiAutomaticMode {
  private readonly ITEM_TYPE_ID = 'tlmsi:hakurei_gohei'; // 物品id

  // 射击函数
  shoot(params: GoheiAutomaticModeShotParams): boolean {
    let multiShot = ItemTool.getEnchantmentLevel(params.item, 'multishot'); // 多重射击
    let piercing = ItemTool.getEnchantmentLevel(params.item, 'piercing'); // 穿透
    // 进行一次发射
    SakuraLaser.shoot(
      params.entity,
      params.entity.getHeadLocation(),
      params.entity.getViewDirection(),
      9, // 中心伤害
      3, // 边缘伤害
      3, // 穿透力
    );
    return true;
  }

  // 物品是否是樱之御币
  isShootItem(item: ItemStack): boolean {
    return item.typeId === this.ITEM_TYPE_ID;
  }
}
