import { system, world, } from "@minecraft/server";
import { hakureiGohei } from "../items/hakurei_gohei/index";
import { altarStructure } from "../altar/AltarStructureHelper";
import { MaidManager } from "../maid/MaidManager";
import { GarageKit } from "../blocks/GarageKit";
import { Gohei } from "../items/Gohei";
import { MemorizableGensokyo } from "../book/MemorizableGensokyoUI";
export class ItemEvents {
    constructor() {
        this.playerOnUse = new Map(); // 使用冷却
    }
    // 使用
    itemUseBefore(event) {
        let item = event.itemStack;
        if (item === undefined)
            return;
        if (item.typeId.substring(0, 18) === "touhou_little_maid") {
            switch (item.typeId.substring(19)) {
                case "hakurei_gohei_crafting_table":
                    Gohei.activate(event);
                    break;
                case "memorizable_gensokyo":
                    MemorizableGensokyo.onUseEvent(event);
                    break;
                default: break;
            }
        }
    }
    // 对方块使用前
    itemUseOnBefore(event) {
        const block = event.block;
        const player = event.source;
        const itemStack = event.itemStack;
        if (!this.playerOnUse.get(player.name)) {
            // 带冷却事件
            this.playerOnUse.set(player.name, true);
            system.runTimeout(() => { this.playerOnUse.delete(player.name); }, 10);
            //// 方块筛选 ////
            if (block.typeId.substring(0, 18) === "touhou_little_maid") {
                let blockName = block.typeId.substring(19);
                switch (blockName) {
                    //// 祭坛平台交互 ////
                    case "altar_platform_block":
                        {
                            if (!player.isSneaking) {
                                altarStructure.placeItemEvent(event.block.location, player);
                                event.cancel = true;
                                return;
                            }
                        }
                        ;
                        break;
                    default: break;
                }
            }
            ;
            //// 物品筛选 ////
            if (itemStack.typeId.substring(0, 18) === "touhou_little_maid") {
                let itemName = itemStack.typeId.substring(19);
                switch (itemName) {
                    // case "gold_microwaver_item": GoldMicrowaver.placeEvent(event); break;
                    case "photo":
                        MaidManager.Interact.photoOnUseEvent(event);
                        event.cancel = true;
                        break;
                    case "smart_slab_has_maid":
                        MaidManager.Interact.smartSlabOnUseEvent(event);
                        event.cancel = true;
                        break;
                    case "chisel":
                        GarageKit.activate(event);
                        event.cancel = true;
                        break;
                    case "garage_kit":
                        GarageKit.placeEvent(event);
                        event.cancel = true;
                        break;
                    default:
                        {
                            //// 御币使用事件 ////
                            if (itemName.substring(0, 13) === "hakurei_gohei") {
                                if (player.isSneaking)
                                    Gohei.transform(event, itemName.substring(14)); // 切换弹种
                                else if (block.typeId == "minecraft:red_wool") // 祭坛激活
                                    altarStructure.activate(player.dimension, event.block.location, event.blockFace);
                            }
                            event.cancel = true;
                        }
                        ;
                        break;
                }
            }
        }
    }
    // 蓄力开始
    itemStartUseAfter(event) {
        if (event.itemStack.typeId === 'touhou_little_maid:hakurei_gohei_v2') {
            hakureiGohei.startUseEvent(event);
        }
    }
    // 蓄力中止
    itemStopUseAfter(event) {
        if (!event.itemStack) {
            return;
        }
        if (event.itemStack.typeId === 'touhou_little_maid:hakurei_gohei_v2') {
            hakureiGohei.stopUseEvent(event);
        }
    }
    // 注册事件
    registerAllEvents() {
        world.afterEvents.itemStartUse.subscribe(event => {
            system.run(() => { this.itemStartUseAfter(event); });
        });
        world.afterEvents.itemStopUse.subscribe(event => {
            this.itemStopUseAfter(event);
        });
        world.beforeEvents.itemUseOn.subscribe(event => {
            system.run(() => { this.itemUseOnBefore(event); });
        });
        world.beforeEvents.itemUse.subscribe(event => {
            system.run(() => { this.itemUseBefore(event); });
        });
    }
}
//# sourceMappingURL=ItemEvents.js.map