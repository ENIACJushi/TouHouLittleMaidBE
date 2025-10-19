/**
 * 常驻的自动循环时间可能会影响性能，将他们集中在此处进行注册
 */

import { EquipmentSlot, GameMode, system, world } from "@minecraft/server";
import PowerPoint from "../altar/PowerPoint";

export class ScheduleEvents {

  // 注册所有事件
  public startAllEvents() {

    // 玩家主手物品检测
    system.runInterval(() => {
      for (let pl of world.getAllPlayers()) {
        let item = pl.getComponent("equippable")?.getEquipment(EquipmentSlot.Mainhand);
        if (item !== undefined) {
          if (item.typeId.startsWith("tlmsi")) {
            PowerPoint.show(pl);
          }
        }
      }
    }, 15);

    // P点扫描
    system.runInterval(() => {
      for (let pl of world.getAllPlayers()) {
        PowerPoint.scan_power_point(pl);
      }
    }, 20);

 
    // 创造模式方块实体破坏检测
    system.runInterval(() => {
      for (let pl of world.getPlayers({ "gameMode": GameMode.Creative })) {
        pl.runCommand("function touhou_little_maid/check");
      }
    }, 80);
  }
}