import { DanmakuType } from "../../danmaku/DanmakuType";
import {
  ItemStack,
  WorldInitializeBeforeEvent,
  ItemStartUseAfterEvent,
  ItemReleaseUseAfterEvent,
  world,
} from "@minecraft/server";
import { ItemTool, logger } from '../../libs/ScarletToolKit';
import { GoheiItemInterface } from "./GoheiItemInterface";
import { amuletMode } from "./modes/AmuletMode";


class HakureiGohei {
  modeList = [
    amuletMode
  ]
  /**
  * 初始化御币的自定义属性
  * @param {WorldInitializeBeforeEvent} event 
  */
  registerCC (event) {
    event.itemComponentRegistry.registerCustomComponent('tlm:hakurei_gohei', {
      onUseOn: (event) => {
        logger('onUse hakurei gohei');
        GoheiItemInterface.getMode(event.itemStack);
      }
    });
  }

  /**
   * 开始蓄力事件
   * @param {ItemStartUseAfterEvent} event 
   */
  startUseEvent (event) {
    let item = event.itemStack;
    let mode = GoheiItemInterface.getMode(item);
    if (mode >= this.modeList.length) {
      mode = 0;
      GoheiItemInterface.setMode(item, 0);
      ItemTool.setPlayerMainHand(event.source, item);
    }
    this.modeList[mode].startUseEvent(event);
  }

  /**
   * 结束蓄力事件
   * @param {ItemReleaseUseAfterEvent} event 
   */
  stopUseEvent (event) {
    let item = event.itemStack;
    let mode = GoheiItemInterface.getMode(item);
    if (mode >= this.modeList.length) {
      mode = 0;
      GoheiItemInterface.setMode(item, 0);
    }
    this.modeList[mode].stopUseEvent(event);
  }
}

export const hakureiGohei = new HakureiGohei();
