import {
  ItemReleaseUseAfterEvent,
  ItemStack,
  ItemStartUseAfterEvent,
  Player,
  system,
  world,
} from "@minecraft/server";
import { shoot as amuletShoot } from "../../../danmaku/patterns/gohei/Amulet";
import { GoheiItemInterface } from "../GoheiItemInterface";
import { GoheiBaseMode } from "./GoheiBaseMode";
import { getRandom, ItemTool, logger } from "../../../libs/ScarletToolKit";

const DAMAGE_PROPERTY_KEY = 'tlm_gh:ad';
const DAMAGE_STEP_FULL = 3; // 要发射几次才会触发损坏判定

class AmuletMode extends GoheiBaseMode {
  intervalMap = new Map();
  /**
   * 开始蓄力事件
   * @param {ItemStartUseAfterEvent} event 
   */
  startUseEvent (event) {
    let playerId = event.source.id;
    let slot = event.source.selectedSlotIndex;
    let intervalId = system.runTimeout(() => {
      // 事件取消 取消
      if (intervalId !== this.getPlayerInterval(playerId)) {
        this.clearPlayerInterval(playerId);
        return;
      }
      // 玩家消失 取消
      let player = world.getEntity(playerId);
      if (!player) {
        this.clearPlayerInterval(playerId);
        return;
      }
      // 物品栏切换 取消
      if (slot !== player.selectedSlotIndex) {
        this.clearPlayerInterval(playerId);
        return;
      }
      // 物品消失 取消
      let item = ItemTool.getPlayerMainHand(player);
      if (!item) {
        this.clearPlayerInterval(playerId);
        return;
      }
      // 物品不是御币 取消
      if (!GoheiItemInterface.isGohei(item)) {
        this.clearPlayerInterval(playerId);
        return;
      }
      
      // 发射弹幕
      amuletShoot(player, player.getHeadLocation(), player.getViewDirection());
      // 损耗物品
      this.damage(item);
      ItemTool.setPlayerMainHand(player, item);

      // 播放音效
      world.playSound('random.bow', player.location, {
        pitch: getRandom(0.330, 0.50),
        volume : 0.50 
      });
    }, 1);
    this.registerPlayerInterval(playerId, intervalId)
  }

  /**
   * 开始蓄力事件
   * @param {ItemReleaseUseAfterEvent} event 
   */
  stopUseEvent (event) {
    this.clearPlayerInterval(event.source.id);
  }

  /**
   * 获取循环事件id
   * @param {number} playerId
   */
  getPlayerInterval (playerId) {
    return this.intervalMap.get(playerId);
  }

  /**
   * 注销循环事件
   * @param {number} playerId
   * @param {number} intervalId
   */
  clearPlayerInterval (playerId) {
    let intervalId = this.intervalMap.get(playerId);
    if (intervalId) {
      system.clearRun(intervalId);
    }
  }

  /**
   * 注册循环事件
   * @param {number} playerId
   * @param {number} intervalId
   */
  registerPlayerInterval (playerId, intervalId) {
    let old = this.intervalMap.get(playerId);
    if (old) {
      system.clearRun(old);
    }
    this.intervalMap.set(playerId, intervalId);
  }

  /**
   * 损耗物品 不要忘记损耗后 setMainHand
   * @param {ItemStack} item 
   */
  damage (item) {
    let step = item.getDynamicProperty(DAMAGE_PROPERTY_KEY) ?? 0;
    step ++;

    if (step >= DAMAGE_STEP_FULL) {
      step = 0;
      ItemTool.damageItem(item);
    }
    item.setDynamicProperty(DAMAGE_PROPERTY_KEY, step);
  }
}

export const amuletMode = new AmuletMode();