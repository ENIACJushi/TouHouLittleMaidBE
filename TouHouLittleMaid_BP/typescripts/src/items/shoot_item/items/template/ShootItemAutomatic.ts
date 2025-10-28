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
import { ShootItemBase } from "./ShootItemBase";

/**
 * 自动射击模板
 */
export abstract class ShootItemAutomatic extends ShootItemBase {
  private intervalMap = new Map();
  private lastShootingTick = new Map<string, number>(); // 记录玩家上次射击的时间

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
    // 根据上次射击的时间，确定第一次发射的延迟，若此前足够长的时间没有发射过，则立即发射
    let firstTimeout = Math.max(0, timeout - system.currentTick + (this.lastShootingTick.get(playerId) ?? 0));
    let intervalId: number = -1;
    // 射击函数
    let shoot = () => {
      ///// 停止判断 /////
      // 事件取消
      if (intervalId !== this.getPlayerInterval(playerId)) {
        system.clearRun(intervalId);
        return false;
      }
      // 玩家消失 || 物品栏切换
      let player = world.getEntity(playerId) as Player | undefined;
      if (!player || player.getComponent('health')?.currentValue === 0 || slot !== player.selectedSlotIndex) {
        this.clearPlayerInterval(playerId);
        return false;
      }
      // 物品消失 || 物品不是御币
      let item = ItemTool.getPlayerMainHand(player);
      if (!item || !this.isShootItem(item)) {
        this.clearPlayerInterval(playerId);
        return false;
      }
      // 发射弹幕
      this.shoot({ entity: player, item: item });
      this.lastShootingTick.set(playerId, system.currentTick);
      // 损耗物品
      this.damageItem(item, player, slot);
      // 播放音效
      this.playShotSound(player);
      return true;
    }
    // 开始任务
    intervalId = system.runTimeout(() => {
      let res = shoot();
      if (!res) {
        return;
      }
      // 开始后续的自动射击
      // 创建一个定时循环的任务，在玩家保持蓄力状态时执行，蓄力结束或满足其他结束条件时停止
      intervalId = system.runInterval(shoot, timeout);
      this.registerPlayerInterval(playerId, intervalId);
    }, firstTimeout);
    this.registerPlayerInterval(playerId, intervalId);
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
