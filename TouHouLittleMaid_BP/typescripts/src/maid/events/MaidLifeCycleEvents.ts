import {
  DataDrivenEntityTriggerAfterEvent,
  Entity,
  EntityDieAfterEvent,
  EntityHurtAfterEvent,
  ItemStack,
  world,
} from "@minecraft/server";
import { EntityMaid } from "../EntityMaid";
import { MaidSkin } from "../skin/MaidSkin";
import { Logger } from "../../controller/Logger";
import { VO } from "../../libs/VectorMC";
import { DP } from "../../libs/DynamicPropertyInterface";

const TAG = "MaidLifeCycle";
/** 女仆实体 typeId；订阅 hurt/die 时用 entityTypes 限定以降低回调量 */
const MAID_TYPE_ID = "thlmm:maid";

/**
 * 生命周期事件（原 MaidManager.Core）
 */
export class MaidLifeCycleEvents {
  /**
   * 女仆加载：区块重载、跨维度、脚本启动补扫描时触发。
   * @param maid
   * @param isSpawn 是否是首次生成
   */
  onLoad(maid: Entity, isSpawn: boolean = false) {
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
    const dimensionIds = ["overworld", "nether", "the_end"];
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
      Logger.debug(TAG, "读取皮肤失败，跳过校验");
      return;
    }

    if (MaidSkin.isRegistered(pack, index)) {
      return;
    }

    EntityMaid.Skin.setRandom(maid);
    Logger.debug(TAG, `皮肤未注册 (${pack},${index})，已重新随机`);
  }

  /**
   * 女仆受伤（脚本侧替代 sounds.json 自动 hurt）。
   * 使用场景：EntityEvents 以 entityTypes=[thlmm:maid] 订阅 EntityHurtAfterEvent。
   * 不查 mute，对齐原自动音效行为；负伤害（治疗）不播。
   */
  onHurt(event: EntityHurtAfterEvent): void {
    if (event.damage <= 0) {
      return;
    }
    const maid = event.hurtEntity;
    try {
      if (!maid.isValid) {
        return;
      }
      EntityMaid.Sound.play(maid, EntityMaid.Sound.Type.Hurt);
    } catch (e) {
      Logger.debug(TAG, `onHurt 音效失败: ${e}`);
    }
  }

  /**
   * 女仆死亡音效（脚本侧替代 sounds.json 自动 death）。
   * 使用场景：EntityEvents 以 entityTypes=[thlmm:maid] 订阅 EntityDieAfterEvent；
   * 与数驱 onDeath（坟墓/胶片）分离，仅负责播放。
   */
  onDied(event: EntityDieAfterEvent): void {
    const maid = event.deadEntity;
    try {
      if (!maid.isValid) {
        return;
      }
      EntityMaid.Sound.play(maid, EntityMaid.Sound.Type.Death);
    } catch (e) {
      Logger.debug(TAG, `onDied 音效失败: ${e}`);
    }
  }

  /**
   * 女仆生成事件
   */
  onSpawn(event: DataDrivenEntityTriggerAfterEvent) {
    let maid = event.entity;
    maid.triggerEvent("api:init_success");
    EntityMaid.Init.maid(maid);
  }

  /**
   * 女仆死亡事件
   */
  onDeath(event: DataDrivenEntityTriggerAfterEvent) {
    let maid = event.entity;
    if (maid === undefined) return;

    let lore = EntityMaid.toLore(maid, false);
    let output_item = new ItemStack("touhou_little_maid:film", 1);
    output_item.setLore(lore);

    // 转移背包物品
    let tombstone = maid.dimension.spawnEntity(
      "touhou_little_maid:tombstone" as any,
      maid.location
    );
    let stoneContainer = tombstone.getComponent("inventory")!.container;
    let maidContainer = maid.getComponent("inventory")!.container;

    for (let i = 0; i < maidContainer.size; i++) {
      let maidItem = maidContainer.getItem(i);
      if (maidItem !== undefined) {
        stoneContainer.setItem(i, maidItem);
        maidContainer.setItem(i);
      }
    }

    // 放入胶片
    stoneContainer.addItem(output_item);

    // 命名
    let ownerName = EntityMaid.Owner.getName(maid);
    if (ownerName !== undefined) {
      tombstone.nameTag = "§aOwner\n§e" + ownerName;
      DP.setString(tombstone, "owner_name", ownerName);
    }
    // 主人信息
    let owenrId = EntityMaid.Owner.getID(maid);
    if (owenrId !== undefined) {
      DP.setString(tombstone, "owner_id", owenrId);
    }
  }

  /**
   * 女仆被驯服事件
   */
  onTamed(event: DataDrivenEntityTriggerAfterEvent) {
    let maid = event.entity;

    EntityMaid.Level.eventTamed(maid, EntityMaid.Level.get(maid)!);

    // 设置主人
    EntityMaid.Owner.refresh(maid);

    // 设置工作模式
    let work = maid.getDynamicProperty("temp_work");
    if (work !== undefined) {
      EntityMaid.Work.set(maid, work as number);
      maid.setDynamicProperty("temp_work");
    }
    // 设置拾取模式
    EntityMaid.Pick.set(maid, EntityMaid.Pick.get(maid));

    // 播放语音 从魂符、照片、祭坛复活的女仆不会播放
    EntityMaid.Sound.tamed(maid);
  }

  /**
   * 坟墓受击
   */
  tombstoneAttack(event: DataDrivenEntityTriggerAfterEvent) {
    let tombstone = event.entity;
    let dimension = tombstone.dimension;
    // 主人验证
    let ownerName = DP.getString(tombstone, "owner_name");
    if (ownerName !== undefined) {
      let player = dimension.getPlayers({
        name: ownerName,
        location: tombstone.location,
        maxDistance: 6,
      });
      if (player.length === 0) {
        let ownerID = DP.getString(tombstone, "owner_id");
        if (ownerID !== undefined) {
          let ownerEntity = world.getEntity(ownerID);
          if (
            ownerEntity === undefined ||
            VO.length(VO.sub(ownerEntity.location, tombstone.location)) > 6
          ) {
            return;
          }
        }
      }
    }

    let container = tombstone.getComponent("inventory")!.container;

    for (let i = 0; i < container.size; i++) {
      let item = container.getItem(i);
      if (item !== undefined) {
        dimension.spawnItem(item.clone(), tombstone.location);
        container.setItem(i);
      }
    }

    tombstone.triggerEvent("despawn");
  }
}
