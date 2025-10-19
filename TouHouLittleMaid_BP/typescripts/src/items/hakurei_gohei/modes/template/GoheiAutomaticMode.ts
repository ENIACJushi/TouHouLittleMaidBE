import {
  Entity,
  ItemReleaseUseAfterEvent,
  ItemStack,
  ItemStartUseAfterEvent,
  Player,
  system,
  world
} from "@minecraft/server";
import { ItemTool } from "../../../../libs/ScarletToolKit";
import { GoheiBaseMode } from "./GoheiBaseMode";

/**
 * 自动射击模板
 */
export abstract class GoheiAutomaticMode extends GoheiBaseMode {
  private intervalMap = new Map();

  //// 子类实现 ////
  /**
   * 射击。附魔和药水效果的计算均由子类在这个方法实现
   * @return 是否发射成功，若未发射成功，则不进行损耗判定
   */
  abstract shoot(params: GoheiAutomaticModeShotParams): boolean;

  /**
   * 判断一个物品是否是用来射击的物品
   */
  abstract isShootItem(item: ItemStack): boolean;

  /**
   * 发射间隔
   */
  protected getCooldown(player: Player, item: ItemStack): number {
    // 根据快速装填等级确定发射间隔
    return Math.max(1, 10 - 2 * ItemTool.getEnchantmentLevel(item, 'quick_charge'));
  }

  //// 事件处理 ////
  /**
   * 开始蓄力事件
   */
  public startUseEvent (event: ItemStartUseAfterEvent) {
    let playerId = event.source.id;
    let slot = event.source.selectedSlotIndex;
    // 确定发射间隔
    let timeout = this.getCooldown(event.source, event.itemStack);
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
      if (!item || !this.isShootItem(item)) {
        this.clearPlayerInterval(playerId);
        return;
      }
      // 发射弹幕
      this.shoot({ entity: player, item: item });
      // 损耗物品
      this.damageItem(item, player, slot);
      // 播放音效
      this.playShotSound(player);
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
}

export interface GoheiAutomaticModeShotParams {
  entity: Entity; // 发射者
  item: ItemStack; // 发射物品
}
