import {
  ShootItemAutomatic,
  GoheiAutomaticModeShotParams,
} from "./template/ShootItemAutomatic";
import {getRandom, ItemTool} from "../../../libs/ScarletToolKit";
import { EffectHelper } from "../../../libs/ScarletToolKit/EffectHelper";
import { SakuraLaser } from "../../../danmaku/shapes/laser/SakuraLaser";
import {Entity, ItemStack, Player} from "@minecraft/server";
import {LineShoot} from "../../../danmaku/shoots/LineShoot";
import {EntityDanmakuActor} from "../../../danmaku/actors/EntityDanmakuActor";
import {Vector} from "../../../libs/VectorMC";

const DAMAGE_PROPERTY_KEY = 'tlm_gh:sakura_d'; // gh=gohei 记录从上次损耗开始，已发射多少次
const DAMAGE_STEP_FULL = 2; // 要发射几次才会消耗一点耐久

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
  private readonly CENTER_DAMAGE = 8.5; // 中心伤害
  private readonly AREA_DAMAGE = 5; // 外围伤害
  // 冷却时间
  getCooldown(player: Player, item: ItemStack) {
    // 根据快速装填等级确定发射间隔
    return Math.max(1, 13 - 2 * ItemTool.getEnchantmentLevel(item, 'quick_charge'));
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
        .setExtraPunch(punch * 2),
      thrower: new EntityDanmakuActor(params.entity)
        .setHead(true),
    });
    shoot.shootByVelocity(params.entity.getViewDirection());
    this.playCustomShotSound(params.entity, flame > 0);
    return true;
  }

  // 物品是否是樱之御币
  isShootItem(item: ItemStack): boolean {
    return item.typeId === this.ITEM_TYPE_ID;
  }

  // 自行实现射击音效
  protected playShotSound(player: Player) { }

  // 损耗函数
  protected damageItem(item: ItemStack, player: Player, slot: number) {
    // 计算损耗步数
    let damageStep = (player.getDynamicProperty(DAMAGE_PROPERTY_KEY) ?? 0) as number;
    damageStep ++;
    if (damageStep >= DAMAGE_STEP_FULL) {
      // 步数满时，归零步数，并进行损耗
      damageStep = 0;
      super.damageItem(item, player, slot);
    }
    player.setDynamicProperty(DAMAGE_PROPERTY_KEY, damageStep);
  }

  private playCustomShotSound(player: Entity, isFlame: boolean) {
    if (isFlame) {
      // 火声
      player.dimension.playSound('mob.ghast.fireball', player.location, {
        pitch: getRandom(1.4, 1.8),
        volume : 0.4
      });
    } else {
      // 风声
      player.dimension.playSound('breeze_wind_charge.burst', player.location, {
        pitch: getRandom(1.7, 2.2),
        volume : 0.25
      });
    }
  }
}
