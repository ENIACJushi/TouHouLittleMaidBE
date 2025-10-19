import {
  ItemStack,
  Player,
} from "@minecraft/server";
import {
  AmuletGoheiPattern,
  AmuletGoheiPatternType,
} from "../../../danmaku/patterns/gohei/Amulet";
import {
  GoheiAutomaticMode,
  GoheiAutomaticModeShotParams,
} from "./template/GoheiAutomaticMode";
import { ItemTool } from "../../../libs/ScarletToolKit";
import { EffectHelper } from "../../../libs/ScarletToolKit/EffectHelper";

const DAMAGE_PROPERTY_KEY = 'tlm_gh:ad'; // gh=gohei 记录从上次损耗开始，已发射多少次
const DAMAGE_STEP_FULL = 4; // 要发射几次才会消耗一点耐久

/**
 * 发射符札的御币
 */
export class GoheiAmuletMode extends GoheiAutomaticMode {
  private readonly DAMAGE_AMOUNT = 4; // 单个符札的基础伤害
  // 射击函数
  shoot(params: GoheiAutomaticModeShotParams): boolean {
    let multiShot = ItemTool.getEnchantmentLevel(params.item, 'multishot'); // 多重射击
    let piercing = ItemTool.getEnchantmentLevel(params.item, 'piercing'); // 穿透
    // 进行一次发射
    AmuletGoheiPattern.shoot({
      entity: params.entity,
      direction: params.entity.getViewDirection(),
      amount: 1 + 2 * multiShot,
      piercing: piercing,
      damage: EffectHelper.getDamageByEntity(params.entity, this.DAMAGE_AMOUNT), // 应用药水效果的伤害
      type: params.entity.isSneaking ? AmuletGoheiPatternType.parallel : AmuletGoheiPatternType.fan,
    });
    return true;
  }

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
}
