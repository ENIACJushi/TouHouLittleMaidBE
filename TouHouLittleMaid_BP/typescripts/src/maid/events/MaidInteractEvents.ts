import {
  DataDrivenEntityTriggerAfterEvent,
  Dimension,
  Direction,
  Entity,
  ItemStack,
  Player,
  PlayerInteractWithBlockBeforeEvent,
  PlayerInteractWithEntityBeforeEvent,
  system,
  Vector3,
  world,
} from "@minecraft/server";
import { EntityMaid } from "../EntityMaid";
import { StrMaid } from "../StrMaid";
import { Vector } from "../../libs/VectorMC";
import * as Tool from "../../libs/ScarletToolKit";
import * as UI from "../ui/MaidUI";
import { MaidTarget } from "../work/MaidTarget";
import { isInteractContainerBlock } from "../../../data/BadContainerBlocks";

/** 与原先 JSON interact cooldown 0.2s 对齐 */
const SIT_TOGGLE_COOLDOWN_TICKS = 4;

/** 仍由实体 JSON interact 处理的物品（不拦截，保留准星提示） */
const JSON_INTERACT_ITEMS = new Set([
  "touhou_little_maid:camera",
  "touhou_little_maid:smart_slab_empty",
  "minecraft:saddle",
  "touhou_little_maid:npc_tool",
  "minecraft:shears",
  "touhou_little_maid:maid_backpack_small",
  "touhou_little_maid:maid_backpack_middle",
  "touhou_little_maid:maid_backpack_big",
  "minecraft:name_tag",
]);

const sitToggleCooldown = new Map<string, number>();

/**
 * 与女仆的交互事件（原 MaidManager.Interact / Hug）
 */
export class MaidInteractEvents {
  /**
   * 玩家右键女仆（before）。
   * 坐下/站起不再走 JSON 属性过滤器，由脚本按 thlm:anim 判断后触发对应事件。
   */
  beforePlayerInteract(event: PlayerInteractWithEntityBeforeEvent) {
    const maid = event.target;

    // 未驯服：蛋糕驯服等仍交给原版/JSON
    if (maid.getComponent("minecraft:is_tamed") === undefined) {
      return;
    }

    const player = event.player;
    if (EntityMaid.Owner.getID(maid) !== player.id) {
      return;
    }

    const itemId = event.itemStack?.typeId;

    // 鞍：已抱起则拦住，避免重复触发 JSON 抱起事件
    if (itemId === "minecraft:saddle") {
      if (EntityMaid.isHug(maid)) {
        event.cancel = true;
      }
      return;
    }

    // 相机、魂符、背包等仍由 JSON interact 处理
    if (itemId !== undefined && JSON_INTERACT_ITEMS.has(itemId)) {
      return;
    }

    // 潜行是查包模式，不要坐下/站起
    if (player.isSneaking) {
      return;
    }

    // 抱起中不要切换坐下
    if (EntityMaid.isHug(maid)) {
      return;
    }

    const now = system.currentTick;
    const cooldownKey = `${player.id}:${maid.id}`;
    const last = sitToggleCooldown.get(cooldownKey) ?? -999;
    if (now - last < SIT_TOGGLE_COOLDOWN_TICKS) {
      event.cancel = true;
      return;
    }
    sitToggleCooldown.set(cooldownKey, now);

    const sitting = EntityMaid.isSitting(maid);
    event.cancel = true;
    system.run(() => {
      try {
        if (!maid.isValid) {
          return;
        }
        if (sitting) {
          // 站起需要延迟执行，不然移动属性会修改失败
          system.runTimeout(() => {
            EntityMaid.standUp(maid);
          }, 1);
        } else {
          EntityMaid.sitDown(maid);
        }
      } catch {
        // 实体可能已卸载
      }
    });
  }

  /**
   * 主人与女仆交互事件（左键）
   */
  onInteract(event: DataDrivenEntityTriggerAfterEvent): boolean {
    let maid = event.entity;
    // Search for owner
    let pl_id = EntityMaid.Owner.getID(maid);
    if (pl_id !== undefined) {
      let pl = world.getEntity(pl_id);
      // Send form
      UI.MainMenu(pl as Player, event.entity);
      return true;
    }
    return false;
  }

  /**
   * 女仆被拍照事件
   */
  onPhoto(event: DataDrivenEntityTriggerAfterEvent) {
    let maid = event.entity;
    if (maid === undefined) return;

    let owner = EntityMaid.Owner.get(maid);
    if (owner === undefined) return;

    let lore = EntityMaid.toLore(maid);

    // 发出声音
    EntityMaid.playSound(maid, "thlm.camera_use");

    // 输出照片
    let location = maid.location;
    location.y += 0.5;
    let output_item = new ItemStack("touhou_little_maid:photo", 1);
    output_item.setLore(lore);
    let maidnName = EntityMaid.getNameTag(maid);
    if (maidnName !== "") {
      output_item.nameTag = `§z${maidnName}`;
    }
    if (maid.dimension.spawnItem(output_item, owner.location) !== undefined) {
      // 清除女仆
      EntityMaid.Pick.set(maid, false); // 避免捡完东西被消除
      maid.triggerEvent("despawn");
    }
  }

  /**
   * 根据方块和一个方向获得可以放置女仆的位置
   * 用于魂符和相片的放置
   */
  getSafeLocation(
    dimension: Dimension,
    _location: Vector3,
    blockFace: Direction
  ): Vector3 | undefined {
    let location = { ..._location };
    // 决定位置
    switch (blockFace) {
      case Direction.Down:
        location.y--;
        break;
      case Direction.Up:
        location.y++;
        break;
      case Direction.East:
        location.x++;
        break;
      case Direction.West:
        location.x--;
        break;
      case Direction.South:
        location.z++;
        break;
      case Direction.North:
        location.z--;
        break;
      default:
        return undefined;
    }
    if (!EntityMaid.isSafeBlock(dimension.getBlock(location)!)) {
      return undefined;
    }
    // 上
    const locationUp = new Vector(location.x, location.y + 1, location.z);
    if (!EntityMaid.isSafeBlock(dimension.getBlock(locationUp)!)) {
      // 下
      const locationDown = new Vector(location.x, location.y - 1, location.z);
      if (EntityMaid.isSafeBlock(dimension.getBlock(location)!)) {
        return locationDown;
      } else {
        return undefined;
      }
    }
    return location;
  }

  /**
   * 照片使用事件
   * 当照片无 lore 或 使用者不为主人时，使用失败
   */
  photoOnUse(event: PlayerInteractWithBlockBeforeEvent) {
    // 默认取消方块交互
    event.cancel = true;

    // 无lore，不释放女仆
    let lore = event.itemStack!.getLore();
    if (lore.length === 0) {
      event.cancel = false;
      return;
    }

    // 被交互的方块可摆放物品，且玩家不在潜行，则将物品放上去，不释放女仆
    if (isInteractContainerBlock(event.block.typeId) && !event.player.isSneaking) {
      event.cancel = false;
      return;
    }

    // 执行释放女仆逻辑
    system.run(() => {
      const player = event.player;
      // 物品已丢出或切换：中止，避免复制
      if (!Tool.ItemTool.isMainHandStillItem(player, event.itemStack!)) {
        return;
      }

      //// 检测放置位置是否有两格空间 ////
      const dimension = player.dimension;
      let location = this.getSafeLocation(dimension, event.block.location, event.blockFace);
      if (location === undefined) {
        Tool.title_player_actionbar_translate(
          player.name,
          "message.touhou_little_maid:photo.not_suitable_for_place_maid.name"
        );
        return;
      }
      location.x += 0.5;
      location.z += 0.5;

      // 转换lore
      let strPure = Tool.lore2Str(lore);

      // 使用者不是主人
      if (StrMaid.Owner.getId(strPure) !== player.id) return;

      // 放置
      EntityMaid.fromStr(strPure, dimension, location, true);

      // 消耗照片
      Tool.ItemTool.replaceMainHandIfMatch(player, event.itemStack!);
    });
  }

  /**
   * 魂符使用事件
   */
  smartSlabOnUse(event: PlayerInteractWithBlockBeforeEvent) {
    // 默认取消方块交互
    event.cancel = true;

    // 被交互的方块可摆放物品，且玩家不在潜行，则将物品放上去，不释放女仆
    if (isInteractContainerBlock(event.block.typeId) && !event.player.isSneaking) {
      event.cancel = false;
      return;
    }

    system.run(() => {
      const player = event.player;
      // 物品已丢出或切换：中止，避免「地面魂符 + 空魂符/女仆」复制
      if (!Tool.ItemTool.isMainHandStillItem(player, event.itemStack!)) {
        return;
      }

      let itemStack = event.itemStack!;
      let lore = itemStack.getLore();

      //// 检测放置位置是否有两格空间 ////
      const dimension = player.dimension;
      let location = this.getSafeLocation(dimension, event.block.location, event.blockFace);
      if (location === undefined) {
        Tool.title_player_actionbar_translate(
          player.name,
          "message.touhou_little_maid:photo.not_suitable_for_place_maid.name"
        );
        return;
      }
      location.x += 0.5;
      location.z += 0.5;

      // 生成女仆
      let maid: Entity | undefined = undefined;
      let itemName = itemStack.nameTag;
      if (lore.length === 0) {
        // 首次使用
        maid = EntityMaid.spawnRandomMaid(dimension, location);
        try {
          EntityMaid.Skin.setRandom(maid);
          system.runTimeout(() => {
            EntityMaid.Owner.set(maid!, player);
          }, 1);
        } catch {}
      } else {
        try {
          // 转换lore
          let str = Tool.lore2Str(lore);

          // 使用者不是主人
          if (StrMaid.Owner.getId(str) !== player.id) return;

          // 放置
          maid = EntityMaid.fromStr(str, dimension, location, true);
        } catch {}
      }
      // 没有成功召唤 直接退出
      if (maid === undefined) {
        return;
      }

      // 转换物品
      let emptyItem = new ItemStack("touhou_little_maid:smart_slab_empty", 1);
      if (itemName !== undefined && itemName.substring(0, 2) !== "§z") {
        emptyItem.nameTag = itemName;
      }

      Tool.ItemTool.replaceMainHandIfMatch(player, event.itemStack!, emptyItem);
    });
  }

  /**
   * 女仆被魂符收回事件
   */
  onSmartSlabRecycle(event: DataDrivenEntityTriggerAfterEvent) {
    let maid = event.entity;
    if (maid === undefined) return;

    // 获取魂符物品
    let owner = EntityMaid.Owner.get(maid);
    if (owner === undefined) return;
    let item = Tool.ItemTool.getPlayerMainHand(owner as Player);
    if (item === undefined || item.typeId !== "touhou_little_maid:smart_slab_empty") return;

    // 将女仆转为lore
    let lore = EntityMaid.toLore(maid);

    // 清除女仆
    EntityMaid.Pick.set(maid, false); // 避免捡完东西被消除
    maid.triggerEvent("despawn");

    // 修改魂符
    let new_itme = new ItemStack("touhou_little_maid:smart_slab_has_maid", 1);
    if (item.nameTag === undefined) {
      let maidnName = EntityMaid.getNameTag(maid);
      if (maidnName !== "") {
        new_itme.nameTag = `§z${maidnName}`;
      }
    } else {
      if (item.nameTag.substring(0, 2) !== "") {
        new_itme.nameTag = item.nameTag;
      }
    }
    new_itme.setLore(lore);
    Tool.ItemTool.setPlayerMainHand(owner as Player, new_itme);
  }

  /**
   * 女仆坐下事件
   */
  onSit(event: DataDrivenEntityTriggerAfterEvent) {
    let maid = event.entity;
    // 设置坐下状态
    EntityMaid.setSitting(maid, true);

    // 工作模式
    switch (EntityMaid.Work.get(maid)) {
      case EntityMaid.Work.attack:
        EntityMaid.Work.quit(maid);
        break; // 取消近战模式
      case EntityMaid.Work.farm:
        EntityMaid.Work.quit(maid);
        break; // 退出农作模式
      case EntityMaid.Work.sugar_cane:
        EntityMaid.Work.quit(maid);
        break; // 退出甘蔗模式
      case EntityMaid.Work.melon:
        EntityMaid.Work.quit(maid);
        break; // 退出瓜类模式
      case EntityMaid.Work.cocoa:
        EntityMaid.Work.quit(maid);
        break; // 退出可可模式
    }

    // 拾物模式
    if (EntityMaid.Pick.get(maid)) {
      EntityMaid.Pick.set(maid, true);
    }
  }

  /**
   * 女仆站起事件
   */
  onStand(event: DataDrivenEntityTriggerAfterEvent) {
    let maid = event.entity;
    // 设置站起状态
    EntityMaid.setSitting(maid, false);

    // 工作模式
    switch (EntityMaid.Work.get(maid)) {
      case EntityMaid.Work.attack:
        EntityMaid.Work.enter(maid, EntityMaid.Work.attack);
        break; // 恢复近战模式
      case EntityMaid.Work.farm:
        EntityMaid.Work.enter(maid, EntityMaid.Work.farm);
        break; // 恢复农作模式
      case EntityMaid.Work.sugar_cane:
        EntityMaid.Work.enter(maid, EntityMaid.Work.sugar_cane);
        break; // 恢复甘蔗模式
      case EntityMaid.Work.melon:
        EntityMaid.Work.enter(maid, EntityMaid.Work.melon);
        break; // 恢复瓜类模式
      case EntityMaid.Work.cocoa:
        EntityMaid.Work.enter(maid, EntityMaid.Work.cocoa);
        break; // 恢复可可模式
    }
    MaidTarget.search(maid, 15, true);

    // 拾物模式
    if (EntityMaid.Pick.get(maid)) {
      system.runTimeout(() => {
        EntityMaid.Pick.set(maid, true);
      }, 1);
    }
  }

  /**
   * 模式切换为坐下，此时主人状态由潜行切换到站立
   */
  sitMode(event: DataDrivenEntityTriggerAfterEvent) {
    let maid = event.entity;
    EntityMaid.Backpack.quitCheckMode(maid);
    EntityMaid.Emote.set(maid, 0);
  }

  /**
   * 模式切换为背包操作，此时主人状态由站立切换到潜行
   */
  inventoryMode(event: DataDrivenEntityTriggerAfterEvent) {
    let maid = event.entity;
    EntityMaid.Backpack.checkMode(maid);
    EntityMaid.Emote.backpack(maid);
  }

  /**
   * 背包种类切换
   * @param typeNew 0, 1, 2, 3
   */
  backpackTypeChange(event: DataDrivenEntityTriggerAfterEvent, typeNew: number) {
    let maid = event.entity;
    let typeOld = EntityMaid.Backpack.getType(maid);
    let dimension = maid.dimension;
    let location = maid.location;

    // 将多余的物品丢出
    if (typeOld > typeNew) {
      let container = EntityMaid.Backpack.getContainer(maid);
      if (container !== undefined) {
        for (
          let i = EntityMaid.Backpack.getCapacity(typeNew);
          i < EntityMaid.Backpack.getCapacity(typeOld);
          i++
        ) {
          let item = container.getItem(i);
          if (item !== undefined) {
            dimension.spawnItem(item, location);
            container.setItem(i);
          }
        }
      }
    }

    // 升级
    EntityMaid.Backpack.setType(maid, typeNew);
    system.runTimeout(() => {
      EntityMaid.Emote.backpack(maid);
    }, 1); // 延迟1刻等待修改生效

    // 返还旧背包
    if (typeOld !== 0) {
      dimension.spawnItem(new ItemStack(EntityMaid.Backpack.getItemName(typeOld), 1), location);
    }
  }

  ///// 抱起 /////

  /**
   * 抱起来
   */
  startHug(event: DataDrivenEntityTriggerAfterEvent) {
    // 已在抱起中则忽略（交互不再用 thlm:is_hug 过滤）
    if (EntityMaid.isHug(event.entity)) return;

    // 抱起事件是坐下事件的父集（同时也会设置坐下状态）
    this.onSit(event);

    // 开始抱起
    let maid = event.entity;
    let player = EntityMaid.Owner.get(maid);
    if (player === undefined) return;

    // 只能抱起一名女仆，如果有鹦鹉也不行，因为位置会乱
    let rideComponent = player.getComponent("rideable")!;
    let riders = rideComponent.getRiders();
    if (riders.length != 0) return;

    // 由坐下模式转抱起模式
    maid.triggerEvent("api:sit_to_hug");
    system.runTimeout(() => {
      // 让女仆坐上玩家
      if (rideComponent.addRider(maid)) {
        // 生成交互实体
        this.summonInteractEntity(maid, player as Player);
        // 设置女仆属性
        EntityMaid.setHug(maid, true);
        // 玩家动画
        this.startAnimate(player as Player);
      } else {
        // 失败，返回坐下模式
        maid.triggerEvent("api:hug_to_sit");
      }
    }, 1);
  }

  /**
   * 生成交互实体
   */
  summonInteractEntity(maid: Entity, player: Player) {
    let hugMaid = player.dimension.spawnEntity(
      "touhou_little_maid:hug_maid" as any,
      new Vector(player.location.x, player.location.y, player.location.z)
    );
    hugMaid.getComponent("tameable")!.tame(player);
    // 坐上女仆
    let maidComponent = maid.getComponent("rideable")!;
    maidComponent.addRider(hugMaid);
    // 设置女仆id
    hugMaid.setDynamicProperty("maid", maid.id);
  }

  /**
   * 放下去 (交互事件 三个实体都是正常状态 由交互实体触发)
   */
  stopHug(event: DataDrivenEntityTriggerAfterEvent) {
    let id = event.entity.getDynamicProperty("maid") as string | undefined;
    if (id === undefined) {
      event.entity.remove();
      return;
    }
    let maid = world.getEntity(id);
    if (maid === undefined) {
      event.entity.remove();
      return;
    }
    this.stopHugMaid(maid);
  }

  /**
   * 放下去
   */
  stopHugMaid(maid: Entity) {
    // 删除交互实体
    let seat = maid.getComponent("rideable")!.getRiders();
    if (seat.length !== 0) {
      seat[0].remove();
    }

    // 返回坐下模式
    maid.triggerEvent("api:hug_to_sit");

    // 恢复属性
    EntityMaid.setHug(maid, false);

    // 恢复玩家动画
    let player = EntityMaid.Owner.get(maid);
    if (player !== undefined) {
      this.stopAnimate(player as Player);
      player.getComponent("rideable")!.ejectRider(maid);
    }
  }

  /**
   * 女仆扫描（抱起状态）
   */
  maidScan(maid: Entity) {
    // 若脱离玩家则退出抱起状态
    let player = EntityMaid.Owner.get(maid);
    let quit = true;

    if (player !== undefined) {
      for (let rider of player.getComponent("rideable")!.getRiders()) {
        if (rider.id === maid.id) {
          quit = false;
          break;
        }
      }
    }

    if (quit) {
      this.stopHugMaid(maid);
      return;
    }

    // 若交互实体消失则补一个
    if (maid.getComponent("rideable")!.getRiders().length === 0) {
      // 生成交互实体
      this.summonInteractEntity(maid, player as Player);
    }
  }

  /**
   * 停止抱起动画
   */
  stopAnimate(player: Player) {
    player.runCommand(
      "playanimation @s animation.thlm.player.hug_maid_stop animation.thlm.player.hug_maid_stop"
    );
  }

  /**
   * 开始抱起动画
   */
  startAnimate(player: Player) {
    player.runCommand(
      "playanimation @s animation.thlm.player.hug_maid animation.thlm.player.hug_maid 9999"
    );
    player.runCommand("playanimation @s animation.thlm.player.hug_maid");
  }
}

/** 单例：供 MaidEvents 与日程等模块直接引用，避免经聚合器环依赖 */
export const maidInteractEvents = new MaidInteractEvents();
