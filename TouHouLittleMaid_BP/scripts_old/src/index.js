import { world, system, EquipmentSlot, GameMode } from "@minecraft/server"
import { altarStructure } from "./altar/AltarStructureHelper";
import experiment from "./experiment"
import PowerPoint from "./altar/PowerPoint"
import * as Danmaku from "./danmaku/DanmakuManager"
import { CustomSpellCardManger } from "./danmaku/CustomSpellCardManger";
import * as Tool from"./libs/ScarletToolKit";
import { itemShootManager } from "./danmaku/ItemShootManager";
import { config, ConfigHelper } from "./controller/Config";
import { GoldMicrowaver } from "./blocks/GoldMicrowaver";
import { MaidManager } from "./maid/MaidManager";
import { MaidSkin } from "./maid/MaidSkin";
import { MaidTarget } from "./maid/MaidTarget"

import { CommandManager } from './controller/Command'
import { GarageKit } from "./blocks/GarageKit";
import { MemorizableGensokyo } from "./book/MemorizableGensokyoUI";
import { Gohei } from "./items/Gohei";
import { GoheiCherry } from "./items/GoheiCherry";
import { Skull } from "./blocks/Skull";
import { StatuesBlock } from "./blocks/StatuesBlock";
import { AltarBlock } from "./blocks/AltarBlock";
import { hakureiGohei } from "./items/hakurei_gohei/index";


if(true){
    // World Initialize
    world.beforeEvents.worldInitialize.subscribe((e) => {
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
        system.run(()=>{
            // 初始化
            ConfigHelper.init();
            PowerPoint.init(e);
            MaidManager.Core.init();
            MaidSkin.initScoreboard();
        });
    });

    system.runTimeout(()=>{
        thlm.main();
    }, 20);
}
else{
    Tool.logger("§e[Touhou Little Maid] 现在是实验模式。")
    experiment.main();
}
world.sendMessage("§e[Touhou Little Maid] Addon Loaded!");
class thlm {
    static main(){
        if(false){
            // 伤害统计
            var total = 0;
            var count = 0;
            var max = 0;
            var min = 999;
            var start = 0; // ms
            world.afterEvents.entityHurt.subscribe(event => {
                //// 伤害信息 ////
                let source = event.damageSource.damagingEntity;
                if(source===undefined) source = "?"
                else source = source.typeId
                Tool.logger(` ${source} -> ${event.hurtEntity.typeId}: ${event.damage.toFixed(2)}`);

                //// 伤害统计 ////
                if(event.damage<0)return; // 排除治疗
                count++;
                total+=event.damage;

                // 平均
                let time = new Date().getTime();  
                let average1 = total/count; // 每次伤害
                let average2 = 0; // dps
                if(start===0){
                    start = time;
                }
                else{
                    average2 = total/(time-start)*1000;
                }
                // 极值
                max = Math.max(max, event.damage);
                min = Math.min(min, event.damage);
                Tool.logger(` Hit: ${count.toFixed(2)} | MIN: ${min.toFixed(2)} | MAX:${max.toFixed(2)} | DPH :${average1.toFixed(2)} | DPS: ${average2.toFixed(2)}`)


        });
        }
        //// Player ////
        // Script Event
        system.afterEvents.scriptEventReceive.subscribe(event => {
            system.run(()=>{
                CommandManager.scriptEvent(event);
            })
        }, {namespaces: ["thlm"]});
        // Player spawn
        world.afterEvents.playerSpawn.subscribe(event => {
            // 进服事件
            if(event.initialSpawn){
                let player = event.player;
                system.runTimeout(()=>{
                    player.sendMessage({rawtext:[
                        {"translate": "message.tlm.player_join1"},{"text": "\n"},
                        {"translate": "message.tlm.player_join2"}
                    ]});
                },40);
                // 首次进服事件
                if(PowerPoint.test_power_number(player.name) === false){
                    let playerName = Tool.playerCMDName(player.name);
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
        });

        //// Item ////
        world.afterEvents.itemStartUse.subscribe(event => {
            system.run(() => {
                if (event.itemStack.typeId === 'touhou_little_maid:hakurei_gohei_v2') {
                    hakureiGohei.startUseEvent(event);
                }
            });
        })
        // world.afterEvents.itemReleaseUse.subscribe(event => {
        //     if (event.itemStack.typeId === 'touhou_little_maid:hakurei_gohei_v2') {
        //         hakureiGohei.releaseUseEvent(event);
        //     }
        // })
        world.afterEvents.itemStopUse.subscribe(event => {
            if (event.itemStack.typeId === 'touhou_little_maid:hakurei_gohei_v2') {
                hakureiGohei.stopUseEvent(event);
            }
        })

        // Before Use On
        var on_use_player = {}; // 使用冷却
        world.beforeEvents.itemUseOn.subscribe(event => {
            system.run(()=>{
                const block     = event.block;
                const player    = event.source;
                const itemStack = event.itemStack;
                
                if(!on_use_player[player.name]){// 带冷却事件
                    on_use_player[player.name] = true;
                    system.runTimeout(()=>{delete on_use_player[player.name];}, 10);
                    
                    //// 方块筛选 ////
                    if(block.typeId.substring(0, 18) === "touhou_little_maid"){
                        let blockName = block.typeId.substring(19);
                        
                        switch(blockName){
                            //// 祭坛平台交互 ////
                            case "altar_platform_block":{
                                if(!player.isSneaking){
                                    altarStructure.placeItemEvent(event.block.location, player);
                                    event.cancel = true;
                                    return;
                                }
                            }; break;
                            default: break;
                        }
                    };

                    //// 物品筛选 ////
                    if(itemStack.typeId.substring(0, 18) === "touhou_little_maid"){
                        let itemName = itemStack.typeId.substring(19);
                        switch(itemName){
                            // case "gold_microwaver_item": GoldMicrowaver.placeEvent(event); break;
                            case "photo": MaidManager.Interact.photoOnUseEvent(event); event.cancel=true; break;
                            case "smart_slab_has_maid": MaidManager.Interact.smartSlabOnUseEvent(event); event.cancel=true; break;
                            case "chisel": GarageKit.activate(event); event.cancel=true; break;
                            case "garage_kit": GarageKit.placeEvent(event); event.cancel=true; break;
                            default:{
                                //// 御币使用事件 ////
                                if(itemName.substring(0,13) === "hakurei_gohei"){
                                    if(player.isSneaking) Gohei.transform(event, itemName.substring(14)); // 切换弹种
                                    else if(block.typeId == "minecraft:red_wool")         // 祭坛激活
                                        altarStructure.activate(player.dimension, event.block.location, event.blockFace);
                                }
                                event.cancel=true;
                            }; break;
                        }
                    }
                }
            });
        });
        // 物品使用事件
        world.beforeEvents.itemUse.subscribe(event=>{
            system.run(()=>{
                let item = event.itemStack;
                if(item === undefined) return;

                if(item.typeId.substring(0, 18) === "touhou_little_maid"){
                    switch(item.typeId.substring(19)){
                        case "hakurei_gohei_crafting_table": Gohei.activate(event); break;
                        case "memorizable_gensokyo": MemorizableGensokyo.onUseEvent(event); break;
                        default: break;
                    }
                }
            });
        });

        //// Entity ////
        // Trigger Event
        world.afterEvents.dataDrivenEntityTrigger.subscribe(event => {
            system.run(()=>{
                // Tool.logger(event.eventId);
                // const {entity, id, modifiers} = data;
                if(event.eventId.substring(0, 4) == "thlm"){
                    switch(event.eventId.substring(4, 5)){
                        // 通用事件前缀
                        case ":":
                            switch(event.eventId.substring(5)){
                                // at: altar_tick
                                case "at" : altarStructure.deactivateEvent(event.entity); break;
                                // af: altar_refresh
                                case "af" : altarStructure.refreshItemsEvent(event.entity); break;
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
                                case "b"  : MaidManager.boxOpenEvent(event); break;
                                // n: NPC
                                case "n": MaidManager.NPCInteract(event); break;
                                // h: hug
                                case "h": MaidManager.Hug.seatScan(event); break;
                                default: break;
                            }; break;
                        // 女仆专用事件
                        case "m":
                            switch(event.eventId.substring(6, 7)){
                                case "a": MaidManager.Shedule .danmakuAttack(event);       break; // a Danmaku Attack
                                case "d": MaidManager.Core    .onDeathEvent(event);        break; // d Death
                                case "f": MaidManager.Core    .onTamed(event);             break; // f on tamed
                                case "h": MaidManager.Shedule .returnHomeEvent(event);     break; // h Home
                                case "i": MaidManager.Interact.inventoryModeEvent(event);  break; // i Inventory mode
                                case "j": MaidManager.Hug     .startEvent(event);          break; // j Hug
                                case "k": MaidManager.Hug     .stopEvent(event);           break; // k Hug stop
                                case "l": MaidManager         .setLevelEvent(event);       break; // l Level
                                case "m": MaidManager.Interact.onInteractEvent(event);     break; // m Master interact
                                case "n": MaidManager         .onNPCEvent(event);          break; // n NPC
                                case "p": MaidManager.Interact.onPhotoEvent(event);        break; // p Photo
                                case "s": MaidManager.Interact.sitModeEvent(event);        break; // s Sit mode
                                case "t": MaidManager.Shedule .timerEvent(event);          break; // t Timer
                                case "u": GarageKit           .scan(event);                break; // u statues destroy
                                case "v": MaidManager.Interact.onSitEvent(event);          break; // v enter sit
                                case "w": MaidManager.Interact.onStandEvent(event);        break; // v enter sit
                                case "0": MaidManager.Core    .onSpawnEvent(event);        break; // 0 Spawn
                                case "1": MaidManager.Interact.onSmartSlabRecycleEvent(event); break;// 1 Smart slab
                                default: break;
                            }
                            break;
                        // 女仆背包专用事件
                        case "b":
                            switch(event.eventId.substring(6)){
                                // g: grave
                                case "g" : MaidManager.Core.tombstoneAttackEvent(event); break;
                                // t0: type 0 (default)
                                case "t0" : MaidManager.Interact.backpackTypeChangeEvent(event, 0); break;
                                // t1: type 1 (small)
                                case "t1" : MaidManager.Interact.backpackTypeChangeEvent(event, 1); break;
                                // t2: type 2 (middle)
                                case "t2" : MaidManager.Interact.backpackTypeChangeEvent(event, 2); break;
                                // t3: type 3 (big)
                                case "t3" : MaidManager.Interact.backpackTypeChangeEvent(event, 3); break;
                            }
                            break;
                        case "w":
                            switch(event.eventId.substring(6, 7)){
                                case "d" : GoldMicrowaver.despawnEvent(event); break; // d Despawn
                                case "f" : GoldMicrowaver.finishEvent(event); break; // f finish
                                case "i" : GoldMicrowaver.interactEventNoItem(event); break;// i interact(NO Item, Not Sneaking)
                                case "s" : GoldMicrowaver.interactEventNoItemSneaking(event); break;// i interact(NO Item, Sneaking)
                                default: break;
                            }
                            break;
                        default:
                            break;
                    }
                    
                }
                else{
                }
            });
        });
        // Death Event
        world.afterEvents.entityDie.subscribe(event =>{
            let killer = event.damageSource.damagingEntity;
            if(killer !== undefined){
                if(killer.typeId === "thlmm:maid"){
                    MaidManager.Shedule.killEvent(event);
                }
            }
        });
        // Hurt Event
        world.afterEvents.entityHitEntity.subscribe(event =>{
            system.run(()=>{
                let hurtId = event.hitEntity.typeId;
                if(hurtId.substring(0, 4) === "thlm"){
                    switch(hurtId.charAt(4)){
                        // t: Target
                        case "t": MaidTarget.targetAcquire(event); break;
                        default: break;
                    }
                }
            });
        });

        //// Block ////
        // Place
        world.afterEvents.playerPlaceBlock.subscribe(event=>{
            let block = event.block;
            if(block.typeId.substring(0, 18) === "touhou_little_maid"){
                let blockName = block.typeId.substring(19);
                switch(blockName){
                    //// 祭坛平台交互 //// ? 这个干什么的
                    case "altar_platform_block":{
                        if(!player.isSneaking) altarStructure.placeItemEvent(event.block.location, player);
                    }; break;
                    default: break;
                }
            };
        });
        
        //// Projectile ////
        // Hit Block
        world.afterEvents.projectileHitBlock.subscribe(event=>{
            system.run(()=>{
                var projectile = event.projectile;
                if(projectile !== undefined){
                    // 弹幕可能正在释放，无法获取typeId
                    try{
                        var typeId = event.projectile.typeId;
                        if(typeId !== undefined){
                            if(typeId.substring(0, 6) == "thlmd:"){
                                Danmaku.danmakuHitBlockEvent(event);
                            }
                            else if(typeId == "touhou_little_maid:power_point"){
                                PowerPoint.powerpoint_hit(projectile, event.dimension);
                            }
                        }
                    }
                    catch{}
                }
            });
        });
        // Hit Entity
        world.afterEvents.projectileHitEntity.subscribe(event=>{
            system.run(()=>{
                var projectile = event.projectile;
                if(projectile !== undefined){
                    // 弹幕可能正在释放，无法获取typeId
                    try{
                        var typeId = event.projectile.typeId;
                        if(typeId !== undefined){
                            if(typeId.substring(0, 6) == "thlmd:"){
                                Danmaku.danmakuHitEntityEvent(event);
                            }
                            else if(typeId == "touhou_little_maid:power_point"){
                                PowerPoint.powerpoint_hit(projectile, event.dimension);
                            }
                        }
                    }
                    catch{}
                }
            });
        });
        // 玩家主手物品检测
        system.runInterval(()=>{
            for(let pl of world.getAllPlayers()){
                let item = pl.getComponent("equippable").getEquipment(EquipmentSlot.Mainhand);
                if(item!==undefined){
                    if(item.typeId.substring(0, 18) === "touhou_little_maid"){
                        let name = item.typeId.substring(19);
                        switch(name){
                            default:{
                                if(name.substring(0, 13) == "hakurei_gohei"){
                                    PowerPoint.show(pl);
                                }
                            }; break;
                        }
                    }
                }
            }
        }, 15);

        // P点扫描
        system.runInterval(()=>{
            for(let pl of world.getAllPlayers()){
                PowerPoint.scan_power_point(pl);
            }
        }, 20);


        // 创造模式方块实体破坏检测
        system.runInterval(()=>{
            for(let pl of world.getPlayers({"gameMode":GameMode.creative})){
                pl.runCommand("function touhou_little_maid/check");
            }
        }, 80);
    }
}