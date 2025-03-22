import { system, world, } from "@minecraft/server";
import { altarStructure } from '../altar/AltarStructureHelper';
import PowerPoint from "../altar/PowerPoint";
import { playerCMDName } from "../libs/ScarletToolKit";
export class PlayerEvents {
    // 玩家放置方块
    playerPlaceBlock(event) {
        let block = event.block;
        if (block.typeId.substring(0, 18) === "touhou_little_maid") {
            let blockName = block.typeId.substring(19);
            switch (blockName) {
                // 祭坛平台交互
                case "altar_platform_block":
                    {
                        if (!event.player.isSneaking) {
                            altarStructure.placeItemEvent(event.block.location, event.player);
                        }
                    }
                    ;
                    break;
                default: break;
            }
        }
    }
    // 玩家生成
    playerSpawn(event) {
        // 进服事件
        if (event.initialSpawn) {
            let player = event.player;
            system.runTimeout(() => {
                player.sendMessage({
                    rawtext: [
                        { "translate": "message.tlm.player_join1" }, { "text": "\n" },
                        { "translate": "message.tlm.player_join2" }
                    ]
                });
            }, 40);
            // 首次进服
            if (PowerPoint.test_power_number(player.name) === false) {
                let playerName = playerCMDName(player.name);
                // 初始化p点计分板
                PowerPoint.set_power_number(player.name, 0);
                // 给书
                player.dimension.runCommand(`give ${playerName} touhou_little_maid:memorizable_gensokyo 1`);
                // 给魂符
                player.dimension.runCommand(`give ${playerName} touhou_little_maid:smart_slab_has_maid 1`);
                // say something
                // event.player.sendMessage({translate: ""})
            }
        }
    }
    // 注册事件
    registerAllEvents() {
        world.afterEvents.playerPlaceBlock.subscribe(event => {
            this.playerPlaceBlock(event);
        });
        world.afterEvents.playerSpawn.subscribe(event => {
            this.playerSpawn(event);
        });
    }
}
//# sourceMappingURL=PlayerEvents.js.map