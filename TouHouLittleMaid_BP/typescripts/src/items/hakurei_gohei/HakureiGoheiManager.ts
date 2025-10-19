import {
  ItemStartUseAfterEvent,
  ItemReleaseUseAfterEvent,
} from "@minecraft/server";
import { GoheiAmuletMode } from "./modes/AmuletMode";
import {GoheiBaseMode} from "./modes/template/GoheiBaseMode";
import {GoheiSakuraMode} from "./modes/SakuraMode";

const TAG = 'HakureiGoheiManager';

/**
 * 御币管理类
 */
export class HakureiGoheiManager {
  static ITEM_PREFIX = 'tlmsi'; // 发射物品前缀 (tlm shoot item)
  private static instance: HakureiGoheiManager;
  static getInstance() {
    if (!HakureiGoheiManager.instance) {
      HakureiGoheiManager.instance = new HakureiGoheiManager();
    }
    return HakureiGoheiManager.instance;
  }

  /**
   * 模式列表
   */
  private modeList: Record<string, GoheiBaseMode> = {
    'tlmsi:hakurei_gohei': new GoheiAmuletMode(), // 基础符札模式
    'tlmsi:sakura_gohei': new GoheiSakuraMode(), // 樱之御币模式
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
