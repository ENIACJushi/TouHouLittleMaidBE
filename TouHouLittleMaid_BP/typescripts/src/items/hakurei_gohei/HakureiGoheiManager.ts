import {
  StartupEvent,
  ItemStartUseAfterEvent,
  ItemReleaseUseAfterEvent,
} from "@minecraft/server";
import { ItemTool } from '../../libs/ScarletToolKit';
import { GoheiItemInterface } from "./GoheiItemInterface";
import { GoheiAmuletMode } from "./modes/AmuletMode";
import { Logger } from "../../controller/Logger";

const TAG = 'HakureiGoheiManager';

/**
 * 御币管理类
 */
export class HakureiGoheiManager {
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
  private modeList = [
    new GoheiAmuletMode(), // 基础符札模式
  ];

  /**
  * 初始化御币的自定义属性
  */
  registerCC (event: StartupEvent) {
    event.itemComponentRegistry.registerCustomComponent('tlm:hakurei_gohei', {
      /**
       * 对方块使用事件
       */
      onUseOn: (event) => {
        Logger.debug(TAG, 'Hakurei gohei onUse.');
        GoheiItemInterface.getMode(event.itemStack);
      }
    });
  }

  /**
   * 处理物品开始蓄力事件
   */
  handleStartUseEvent (event: ItemStartUseAfterEvent) {
    let item = event.itemStack;
    let mode = GoheiItemInterface.getMode(item);
    // 模式超出正常范围时，设为 0
    if (mode >= this.modeList.length) {
      mode = 0;
      GoheiItemInterface.setMode(item, 0);
      ItemTool.setPlayerMainHand(event.source, item);
    }
    // 交给模式对应的类处理
    this.modeList[mode].startUseEvent(event);
  }

  /**
   * 处理物品结束蓄力事件
   */
  handleStopUseEvent (event: ItemReleaseUseAfterEvent) {
    let item = event.itemStack;
    if (!item) {
      return;
    }
    let mode = GoheiItemInterface.getMode(item);
    // 模式超出正常范围时，设为 0
    if (mode >= this.modeList.length) {
      mode = 0;
      GoheiItemInterface.setMode(item, 0);
    }
    // 交给模式对应的类处理
    this.modeList[mode].stopUseEvent(event);
  }
}
