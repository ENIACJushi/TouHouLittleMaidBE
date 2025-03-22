import { system, world } from "@minecraft/server";
import { CommandManager } from "../controller/Command";
import { Skull } from "../blocks/Skull";
import { StatuesBlock } from "../blocks/StatuesBlock";
import { AltarBlock } from "../blocks/AltarBlock";
import { GarageKit } from "../blocks/GarageKit";
import { GoldMicrowaver } from "../blocks/GoldMicrowaver";
import { GoheiCherry } from "../items/GoheiCherry";
import { hakureiGohei } from "../items/hakurei_gohei/index";
import { CustomSpellCardManger } from "../danmaku/CustomSpellCardManger";
import PowerPoint from "../altar/PowerPoint";
import { ConfigHelper } from "../controller/Config";
import { MaidManager } from "../maid/MaidManager";
import { MaidSkin } from "../maid/MaidSkin";
export class WorldEvents {
    registerAllEvents() {
        system.afterEvents.scriptEventReceive.subscribe(event => {
            system.run(() => { this.thlmScriptEventReceive(event); });
        }, { namespaces: ["thlm"] });
        world.beforeEvents.worldInitialize.subscribe((e) => {
            this.worldInitialize(e);
        });
    }
    // 世界初始化
    worldInitialize(e) {
        // 注册方块自定义组件
        Skull.registerCC(e);
        StatuesBlock.registerCC(e);
        AltarBlock.registerCC(e);
        GarageKit.registerCC(e);
        GoldMicrowaver.registerCC(e);
        // 注册物品自定义组件
        GoheiCherry.registerCC(e);
        hakureiGohei.registerCC(e);
        CustomSpellCardManger.registerCC(e);
        PowerPoint.registerCC(e);
        // 初始化模块
        system.run(() => {
            // 初始化
            ConfigHelper.init();
            PowerPoint.init(e);
            MaidManager.Core.init();
            MaidSkin.initScoreboard();
        });
    }
    // 脚本事件：THLM
    thlmScriptEventReceive(event) {
        CommandManager.scriptEvent(event);
    }
}
//# sourceMappingURL=WorlldEvents.js.map