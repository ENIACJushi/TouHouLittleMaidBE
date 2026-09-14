import {
  DataDrivenEntityTriggerAfterEvent,
} from "@minecraft/server";
import { EntityMaid } from "../EntityMaid";
import * as Tool from "../../libs/ScarletToolKit";
import * as UI from "../ui/MaidUI";

/**
 * 和女仆强耦合但不是女仆自身的事件（开盒、NPC、抱起座椅扫描等）
 */
export class MaidCoupledEvents {
  /**
   * 开盒，生成一只随机女仆
   */
  boxOpen(event: DataDrivenEntityTriggerAfterEvent) {
    let box = event.entity;
    EntityMaid.spawnRandomMaid(box.dimension, box.location);
    EntityMaid.playSound(box, "thlm.box");
    box.triggerEvent("despawn");
  }

  /**
   * 女仆成为 NPC
   */
  onNpc(event: DataDrivenEntityTriggerAfterEvent) {
    let maid = event.entity;
    if (maid === undefined) return;

    EntityMaid.Home.setLocation(maid);
    EntityMaid.Emote.clear(maid);
  }

  /**
   * NPC 交互
   */
  npcInteract(event: DataDrivenEntityTriggerAfterEvent) {
    let maid = event.entity;
    if (maid === undefined) return;

    let players = maid.dimension.getPlayers({ location: maid.location, maxDistance: 6 });
    for (let pl of players) {
      let item = Tool.ItemTool.getPlayerMainHand(pl);
      if (item !== undefined && item.typeId === "touhou_little_maid:npc_tool") {
        // 发送表单
        UI.SkinMenu(pl, maid, false);
        return;
      }
    }
  }

  /**
   * 中间实体（抱起交互座）扫描
   */
  seatScan(event: DataDrivenEntityTriggerAfterEvent) {
    try {
      let seat = event.entity;
      if (seat === undefined) return;
      let maids = seat.dimension.getEntities({
        location: seat.location,
        maxDistance: 1,
        families: ["maid"],
      });
      if (maids.length === 0) {
        seat.remove();
      }
    } catch {}
  }
}
