import {
  DataDrivenEntityTriggerAfterEvent,
  EntityDieAfterEvent,
  EntityHitEntityAfterEvent,
  ProjectileHitBlockAfterEvent,
  ProjectileHitEntityAfterEvent,
  system,
  world,
} from "@minecraft/server";
import { MaidTarget } from "../maid/MaidTarget";
import { MaidManager } from "../maid/MaidManager";
import { altarStructure } from "../altar/AltarStructureHelper";
import * as Danmaku from "../danmaku/DanmakuManager";
import PowerPoint from "../altar/PowerPoint";
import { GarageKit } from "../blocks/GarageKit";
import { GoldMicrowaver } from "../blocks/GoldMicrowaver";

export class EntityEvents {
  // 弹射物命中方块
  private projectileHitBlock (event: ProjectileHitBlockAfterEvent) {
    let projectile = event.projectile;
    if (projectile !== undefined) {
      // 弹幕可能正在释放，无法获取typeId
      try {
        let typeId = event.projectile.typeId;
        if (typeId !== undefined) {
          if (typeId.substring(0, 6) == "thlmd:") {
            Danmaku.danmakuHitBlockEvent(event);
          }
          else if (typeId == "touhou_little_maid:power_point") {
            PowerPoint.powerpoint_hit(projectile, event.dimension);
          }
        }
      }
      catch { }
    }
  }

  // 弹射物命中实体
  private projectileHitEntity (event: ProjectileHitEntityAfterEvent) {
    if (!event.projectile) {
      return;
    }

    // 弹幕可能正在释放，无法获取typeId
    try {
      var typeId = event.projectile.typeId;
      if (!typeId) {
        return;
      }
      if (typeId.substring(0, 6) == "thlmd:") {
        Danmaku.danmakuHitEntityEvent(event);
      } else if (typeId == "touhou_little_maid:power_point") {
        PowerPoint.powerpoint_hit(event.projectile, event.dimension);
      } else {

      }
    }
    catch { }
  }

  // 数驱事件
  private dataDrivenEntityTrigger(event: DataDrivenEntityTriggerAfterEvent) {
    // Logger.info(event.eventId);
    // const {entity, id, modifiers} = data;
    if (event.eventId.substring(0, 4) === 'thlm') {
      switch (event.eventId.substring(4, 5)) {
        // 通用事件前缀
        case ":":
          switch (event.eventId.substring(5)) {
            // at: altar_tick
            case "at": altarStructure.deactivateEvent(event.entity); break;
            // af: altar_refresh
            case "af": altarStructure.refreshItemsEvent(event.entity); break;
            // ppi: power_point_init
            case "ppi": PowerPoint.init_power_point(event.entity); break;
            // pps: power point scan (powerpoint)
            case "pps": PowerPoint.scan_powerpoint(event.entity); break;
            // pfd; power point - fairy death
            case "pfd": PowerPoint.fairy_death(event.entity); break;
            // dfg: danmaku - fairy shoot
            case "dfs": Danmaku.fairy_shoot(event.entity); break;
            // ddb: danmaku debug shoot
            case "ddb": Danmaku.debug_shoot(event.entity); break;
            // b: box open
            case "b": MaidManager.boxOpenEvent(event); break;
            // n: NPC
            case "n": MaidManager.NPCInteract(event); break;
            // h: hug
            case "h": MaidManager.Hug.seatScan(event); break;
            default: break;
          }; break;
        // 女仆专用事件
        case "m":
          switch (event.eventId.substring(6, 7)) {
            case "a": MaidManager.Shedule.danmakuAttack(event); break; // a Danmaku Attack
            case "d": MaidManager.Core.onDeathEvent(event); break; // d Death
            case "f": MaidManager.Core.onTamed(event); break; // f on tamed
            case "h": MaidManager.Shedule.returnHomeEvent(event); break; // h Home
            case "i": MaidManager.Interact.inventoryModeEvent(event); break; // i Inventory mode
            case "j": MaidManager.Hug.startEvent(event); break; // j Hug
            case "k": MaidManager.Hug.stopEvent(event); break; // k Hug stop
            case "l": MaidManager.setLevelEvent(event); break; // l Level
            case "m": MaidManager.Interact.onInteractEvent(event); break; // m Master interact
            case "n": MaidManager.onNPCEvent(event); break; // n NPC
            case "p": MaidManager.Interact.onPhotoEvent(event); break; // p Photo
            case "s": MaidManager.Interact.sitModeEvent(event); break; // s Sit mode
            case "t": MaidManager.Shedule.timerEvent(event); break; // t Timer
            case "u": GarageKit.scan(event); break; // u statues destroy
            case "v": MaidManager.Interact.onSitEvent(event); break; // v enter sit
            case "w": MaidManager.Interact.onStandEvent(event); break; // v enter sit
            case "0": MaidManager.Core.onSpawnEvent(event); break; // 0 Spawn
            case "1": MaidManager.Interact.onSmartSlabRecycleEvent(event); break;// 1 Smart slab
            default: break;
          }
          break;
        // 女仆背包专用事件
        case "b":
          switch (event.eventId.substring(6)) {
            // g: grave
            case "g": MaidManager.Core.tombstoneAttackEvent(event); break;
            // t0: type 0 (default)
            case "t0": MaidManager.Interact.backpackTypeChangeEvent(event, 0); break;
            // t1: type 1 (small)
            case "t1": MaidManager.Interact.backpackTypeChangeEvent(event, 1); break;
            // t2: type 2 (middle)
            case "t2": MaidManager.Interact.backpackTypeChangeEvent(event, 2); break;
            // t3: type 3 (big)
            case "t3": MaidManager.Interact.backpackTypeChangeEvent(event, 3); break;
          }
          break;
        case "w":
          switch (event.eventId.substring(6, 7)) {
            case "d": GoldMicrowaver.despawnEvent(event); break; // d Despawn
            case "f": GoldMicrowaver.finishEvent(event); break; // f finish
            case "i": GoldMicrowaver.interactEventNoItem(event); break;// i interact(NO Item, Not Sneaking)
            case "s": GoldMicrowaver.interactEventNoItemSneaking(event); break;// i interact(NO Item, Sneaking)
            default: break;
          }
          break;
        default: break;
      }
    }
  }

  // 实体死亡事件
  private entityDie(event: EntityDieAfterEvent) {
    let killer = event.damageSource.damagingEntity;
    if (killer !== undefined) {
      if (killer.typeId === "thlmm:maid") {
        MaidManager.Shedule.killEvent(event);
      }
    }
  }
  
  // 实体攻击实体事件
  entityHitEntity(event: EntityHitEntityAfterEvent) {
    let hurtId = event.hitEntity.typeId;
    if (hurtId.substring(0, 4) === 'thlm') {
      switch (hurtId.charAt(4)) {
        // 女仆攻击标志实体
        case "t": MaidTarget.targetAcquire(event); break;
        default: break;
      }
    }
  }

  // 注册事件
  public registerAllEvents() {
    world.afterEvents.dataDrivenEntityTrigger.subscribe(event => {
      system.run(() => { this.dataDrivenEntityTrigger(event); });
    });
    world.afterEvents.entityDie.subscribe(event => {
      this.entityDie(event);
    });
    world.afterEvents.entityHitEntity.subscribe(event => {
      system.run(() => { this.entityHitEntity(event); });
    });
    world.afterEvents.projectileHitBlock.subscribe(event => {
      system.run(() => { this.projectileHitBlock(event); });
    });
    world.afterEvents.projectileHitEntity.subscribe(event => {
      system.run(() => { this.projectileHitEntity(event); });
    });
  }
}