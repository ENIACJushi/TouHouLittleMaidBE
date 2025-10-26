import {
  ShootItemAutomatic,
  GoheiAutomaticModeShotParams,
} from "./template/ShootItemAutomatic";
import { ItemTool } from "../../../libs/ScarletToolKit";
import { EffectHelper } from "../../../libs/ScarletToolKit/EffectHelper";
import { SakuraLaser } from "../../../danmaku/shapes/laser/SakuraLaser";
import {ItemStack, Player} from "@minecraft/server";
import {LineShoot} from "../../../danmaku/shoots/LineShoot";
import {EntityDanmakuActor} from "../../../danmaku/actors/EntityDanmakuActor";
import {Vector} from "../../../libs/VectorMC";

/**
 * 樱之御币，使用弓类附魔
 *
 *  力量：增加伤害
 *  火矢：粒子增加火焰，仍造成魔法伤害，被击中的实体会燃烧
 *  冲击：增大击退力度
 *  无限：无效
 */
export class SakuraGohei extends ShootItemAutomatic {
  private readonly ITEM_TYPE_ID = 'tlmsi:sakura_gohei'; // 物品id
  private readonly CENTER_DAMAGE = 10; // 中心伤害
  private readonly AREA_DAMAGE = 6; // 外围伤害
  // 固定冷却时间
  getCooldown(player: Player, item: ItemStack) {
    // 根据快速装填等级确定发射间隔
    return Math.max(1, 10 - 2 * ItemTool.getEnchantmentLevel(item, 'quick_charge'));
  }

  // 射击函数
  shoot(params: GoheiAutomaticModeShotParams): boolean {
    let power = ItemTool.getEnchantmentLevel(params.item, 'power'); // 力量
    let flame = ItemTool.getEnchantmentLevel(params.item, 'flame'); // 火矢
    let punch = ItemTool.getEnchantmentLevel(params.item, 'punch'); // 冲击
    let powerMultiplier = ItemTool.getPoweredDamageMultiplier(power);
    // 进行一次发射
    let shoot = new LineShoot({
      shape: new SakuraLaser()
        .setDamageArea(EffectHelper.getDamageByEntity(params.entity, Math.ceil(this.AREA_DAMAGE * powerMultiplier)))
        .setDamageCenter(EffectHelper.getDamageByEntity(params.entity, Math.ceil(this.CENTER_DAMAGE * powerMultiplier)))
        .setPiercing(3 + power)
        .setFlame(5 * flame)
        .setExtraPunch(punch * 1.5),
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
