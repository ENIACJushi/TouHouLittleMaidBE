import {
  ItemStartUseAfterEvent,
  ItemReleaseUseAfterEvent,
} from "@minecraft/server";
import { HakureiGohei } from "./items/HakureiGohei";
import { ShootItemBase } from "./items/template/ShootItemBase";
import { SakuraGohei } from "./items/SakuraGohei";

const TAG = 'HakureiGoheiManager';

/**
 * 射击物品管理类
 */
export class ShootItemManager {
  static ITEM_PREFIX = 'tlmsi'; // 发射物品前缀 (tlm shoot item)
  private static instance: ShootItemManager;
  static getInstance() {
    if (!ShootItemManager.instance) {
      ShootItemManager.instance = new ShootItemManager();
    }
    return ShootItemManager.instance;
  }

  /**
   * 模式列表
   */
  private modeList: Record<string, ShootItemBase> = {
    'tlmsi:hakurei_gohei': new HakureiGohei(), // 基础符札模式
    'tlmsi:sakura_gohei': new SakuraGohei(), // 樱之御币模式
  };

  /**
   * 处理物品开始蓄力事件
   */
  handleStartUseEvent (event: ItemStartUseAfterEvent) {
    let item = event.itemStack;
    // 交给模式对应的类处理
    this.modeList[item.typeId]?.startUseEvent(event);
  }

  /**
   * 处理物品结束蓄力事件
   */
  handleStopUseEvent (event: ItemReleaseUseAfterEvent) {
    let item = event.itemStack;
    // 交给模式对应的类处理
    if (item) {
      this.modeList[item.typeId]?.stopUseEvent(event);
    }
  }
}
