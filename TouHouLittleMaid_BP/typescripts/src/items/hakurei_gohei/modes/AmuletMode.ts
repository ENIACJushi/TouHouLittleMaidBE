import {
  ItemReleaseUseAfterEvent,
  ItemStack,
  ItemStartUseAfterEvent,
  Player,
  system,
  world,
} from "@minecraft/server";
import { AmuletGoheiPattern } from "../../../danmaku/patterns/gohei/Amulet";
import { GoheiItemInterface } from "../GoheiItemInterface";
import { GoheiBaseMode } from "./GoheiBaseMode";
import { getRandom, ItemTool } from "../../../libs/ScarletToolKit";

const DAMAGE_PROPERTY_KEY = 'tlm_gh:ad'; // gh=gohei
const DAMAGE_ACCUMULATE_KEY = 'tlm_gh:da';
const DAMAGE_STEP_FULL = 5; // 要发射几次才会消耗一点耐久
/**
 * 连续射击时，要消耗多少耐久才会强制生效一次损耗
 *  因为新发现设置耐久不会导致物品刷新，所以设为1，如果要设更高的值，则需要在使用结束等场景补上损耗判定
 */
const DAMAGE_CYCLE = 1;

export class GoheiAmuletMode extends GoheiBaseMode {
  intervalMap = new Map();

  //// 事件处理 ////
  /**
   * 开始蓄力事件
   */
  public startUseEvent (event: ItemStartUseAfterEvent) {
    let playerId = event.source.id;
    let slot = event.source.selectedSlotIndex;
    // 根据快速装填等级确定发射间隔
    let timeout = Math.max(1, 10 - 2 * ItemTool.getEnchantmentLevel(event.itemStack, 'quick_charge'));

    // 创建一个定时循环的任务，在玩家保持蓄力状态时执行，蓄力结束或满足其他结束条件时停止
    let intervalId = system.runInterval(() => {
      ///// 停止判断 /////
      // 事件取消
      if (intervalId !== this.getPlayerInterval(playerId)) {
        this.clearPlayerInterval(playerId);
        return;
      }
      // 玩家消失 || 物品栏切换
      let player = world.getEntity(playerId) as Player | undefined;
      if (!player || slot !== player.selectedSlotIndex) {
        this.clearPlayerInterval(playerId);
        return;
      }
      // 物品消失 || 物品不是御币
      let item = ItemTool.getPlayerMainHand(player);
      if (!item || !GoheiItemInterface.isGohei(item)) {
        this.clearPlayerInterval(playerId);
        return;
      }
      ///// 发射弹幕 /////
      let multiShot = ItemTool.getEnchantmentLevel(item, 'multishot'); // 多重射击
      // 发射一次符札
      AmuletGoheiPattern.shoot({
        entity: player,
        direction: player.getViewDirection(),
        amount: multiShot > 0 ? 3 : 1,
      });
      // 损耗判定
      this.damage(item, player, slot);
      // 播放音效
      player.dimension.playSound('random.bow', player.location, {
        pitch: getRandom(0.330, 0.50),
        volume : 0.30
      });
    }, timeout);
    this.registerPlayerInterval(playerId, intervalId)
  }

  /**
   * 开始蓄力事件
   */
  public stopUseEvent (event: ItemReleaseUseAfterEvent) {
    this.clearPlayerInterval(event.source.id);
  }

  //// 循环管理 ////
  /**
   * 注册循环事件
   */
  private registerPlayerInterval (playerId: string, intervalId: number) {
    let old = this.intervalMap.get(playerId);
    if (old) {
      system.clearRun(old);
    }
    this.intervalMap.set(playerId, intervalId);
  }

  /**
   * 注销循环事件
   */
  private clearPlayerInterval (playerId: string) {
    let intervalId = this.intervalMap.get(playerId);
    if (intervalId) {
      system.clearRun(intervalId);
    }
  }

  /**
   * 获取循环事件id
   */
  private getPlayerInterval (playerId: string) {
    return this.intervalMap.get(playerId);
  }

  //// 工具 ////
  /**
   * 损耗物品
   */
  private damage (item: ItemStack, player: Player, slot: number): ItemStack|undefined {
    // 损耗判定
    if (!ItemTool.damageJudge(item)) {
      return;
    }
    // 计算损耗步数
    let isStepFull = false;
    let damageStep = (player.getDynamicProperty(DAMAGE_PROPERTY_KEY) ?? 0) as number;
    damageStep ++;
    if (damageStep >= DAMAGE_STEP_FULL) {
      damageStep = 0;
      isStepFull = true;
    }
    player.setDynamicProperty(DAMAGE_PROPERTY_KEY, damageStep);
    // 步数满时才进行损耗生效判定
    if (!isStepFull) {
      return;
    }
    // 计算累计未生效的损耗量
    let damageAccumulate = (player.getDynamicProperty(DAMAGE_ACCUMULATE_KEY) ?? 0) as number;
    damageAccumulate++;
    let durabilityComponent = item.getComponent("durability");
    // 无耐久的物品不计算累积量 todo 创造模式不计算累积量
    if (durabilityComponent === undefined) {
      damageAccumulate = 0;
    } else {
      let currDamage = durabilityComponent.damage;
      if (damageAccumulate >= DAMAGE_CYCLE || currDamage + damageAccumulate >= durabilityComponent.maxDurability) {
        // 应用损耗
        let newItem = ItemTool.damageItem(item, damageAccumulate);
        ItemTool.setPlayerSlot(player, slot, newItem);
        // 物品损耗已尽时，可能会出现有部分损耗没有施加的情况，需要额外计算一下
        if (newItem === undefined) {
          damageAccumulate = currDamage + damageAccumulate - durabilityComponent.maxDurability;
        } else {
          damageAccumulate = 0;
        }
      }
    }
    player.setDynamicProperty(DAMAGE_ACCUMULATE_KEY, damageAccumulate);
  }
}
