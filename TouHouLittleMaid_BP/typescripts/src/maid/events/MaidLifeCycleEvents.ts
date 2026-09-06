import {
  DataDrivenEntityTriggerAfterEvent,
  Entity,
  world,
} from "@minecraft/server";
import { EntityMaid } from "../EntityMaid";
import { MaidSkin } from "../skin/MaidSkin";
import { Logger } from "../../controller/Logger";

const TAG = 'MaidLifeCycle';
const MAID_TYPE_ID = 'thlmm:maid';

/**
 * 生命周期事件
 */
export class MaidLifeCycleEvents {
  /**
   * 女仆加载：区块重载、跨维度、脚本启动补扫描时触发。
   * @param maid
   * @param isSpawn 是否是首次生成
   */
  onLoad(maid: Entity, isSpawn: boolean=false) {
    try {
      if (!maid.isValid || maid.typeId !== MAID_TYPE_ID) {
        return;
      }
      if (!isSpawn) {
        // 非首次生成时，检查皮肤包（首次生成有自己的随机皮肤逻辑）
        this.refreshUnregisteredSkin(maid);
      }
    } catch (e) {
      Logger.debug(TAG, `onLoad 失败: ${e}`);
    }
  }

  /**
   * 扫描当前已加载的女仆并触发 onLoad。
   * 事件订阅晚于世界加载时，已在场的女仆不会再触发 entityLoad，启动时补一次。
   */
  scanLoadedMaids() {
    const dimensionIds = ['overworld', 'nether', 'the_end'];
    for (const dimensionId of dimensionIds) {
      const dimension = world.getDimension(dimensionId);
      for (const maid of dimension.getEntities({ type: MAID_TYPE_ID })) {
        this.onLoad(maid);
      }
    }
  }

  /**
   * 若当前皮肤未注册，则重新随机一个已注册皮肤
   */
  private refreshUnregisteredSkin(maid: Entity) {
    let pack: number;
    let index: number;
    try {
      pack = EntityMaid.Skin.getPack(maid) as number;
      index = EntityMaid.Skin.getIndex(maid) as number;
    } catch {
      Logger.debug(TAG, '读取皮肤失败，跳过校验');
      return;
    }

    if (MaidSkin.isRegistered(pack, index)) {
      return;
    }

    EntityMaid.Skin.setRandom(maid);
    Logger.debug(TAG, `皮肤未注册 (${pack},${index})，已重新随机`);
  }

  /**
   * 心跳
   */
  timer(data: DataDrivenEntityTriggerAfterEvent) {

  }

  /**
   * 生成
   */
  spawn(data: DataDrivenEntityTriggerAfterEvent) {

  }

  /**
   * 死亡
   */
  death(data: DataDrivenEntityTriggerAfterEvent) {

  }

  /**
   * 被驯服
   */
  tamed(data: DataDrivenEntityTriggerAfterEvent) {

  }

  /**
   * 被拍照
   */
  photo(data: DataDrivenEntityTriggerAfterEvent) {

  }

  /**
   * 被魂符收回
   */
  smartSlabRecycle(data: DataDrivenEntityTriggerAfterEvent) {

  }
}
