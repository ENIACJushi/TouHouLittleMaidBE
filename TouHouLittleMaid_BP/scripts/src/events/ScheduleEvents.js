/**
 * 常驻的自动循环时间可能会影响性能，将他们集中在此处进行注册
 */
import { EquipmentSlot, GameMode, system, world } from "@minecraft/server";
import PowerPoint from "../altar/PowerPoint";
export class ScheduleEvents {
    // 注册所有事件
    startAllEvents() {
        // 玩家主手物品检测
        system.runInterval(() => {
            var _a;
            for (let pl of world.getAllPlayers()) {
                let item = (_a = pl.getComponent("equippable")) === null || _a === void 0 ? void 0 : _a.getEquipment(EquipmentSlot.Mainhand);
                if (item !== undefined) {
                    if (item.typeId.substring(0, 18) === "touhou_little_maid") {
                        let name = item.typeId.substring(19);
                        switch (name) {
                            default:
                                {
                                    if (name.substring(0, 13) == "hakurei_gohei") {
                                        PowerPoint.show(pl);
                                    }
                                }
                                ;
                                break;
                        }
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
            for (let pl of world.getPlayers({ "gameMode": GameMode.creative })) {
                pl.runCommand("function touhou_little_maid/check");
            }
        }, 80);
    }
}
//# sourceMappingURL=ScheduleEvents.js.map