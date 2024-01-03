import { world, system, Enchantment, ItemEnchantsComponent } from "@minecraft/server"
import { altarStructure } from "./src/altar/AltarStructureHelper";
import experiment from "./experiment"
import PowerPoint from "./src/altar/PowerPoint"
import * as Danmaku from "./src/danmaku/DanmakuManager"
import { CustomSpellCardManger } from "./src/danmaku/CustomSpellCardManger";
import * as Tool from"./src/libs/scarletToolKit";
import { itemShootManager } from "./src/danmaku/ItemShootManager";
import { MaidManager } from "./src/maid/MaidManager";
import { Config } from "./src/controller/Config";
import { MaidSkin } from "./src/maid/MaidSkin";
import { EntityMaid } from "./src/maid/EntityMaid";

if(true){
    // World Initialize
    world.afterEvents.worldInitialize.subscribe((e) => {
        system.run(()=>{
            PowerPoint.init_scoreboard_world();

            PowerPoint.init_dynamic_properties(e);
            Danmaku.init_dynamic_properties(e);
            EntityMaid.initDynamicProperties(e);
            
            MaidManager.init();
            MaidSkin.initScoreboard();
            
        });
    });

    system.runTimeout(()=>{
        thlm.main();
    }, 20);
}
else{
    experiment.main();
}
world.sendMessage("§e[Touhou Little Maid] Addon Loaded!");
class thlm {
    static main(){
        // Script Event
        system.afterEvents.scriptEventReceive.subscribe(event => {
            system.run(()=>{
                switch(event.id){
                    case "thlm:skin_set":
                        let strList = event.message.split(",");
                        let numList = [];
                        for(let str of strList){
                            Tool.logger(str);
                            numList.push(parseInt(str));
                        }
                        MaidSkin.setSkin(numList);
                        
                        Tool.logger(`Add skin: ${numList}`);
                        break;
                    case "thlm:skin_remove":
                        break;
                    case "thlm:skin_list":
                        break;
                    default:
                        break;
                }
                
            })
        }, {namespaces: ["thlm"]});
        world.afterEvents.playerSpawn.subscribe(event => {
            // 进服事件
            if(event.initialSpawn){
                let player = event.player;
                // 首次进服事件
                if(PowerPoint.test_power_number(player.name) === false){
                    let playerName = Tool.playerCMDName(player.name);
                    // 初始化p点计分板
                    PowerPoint.set_power_number(player.name, 0);
                    // 给书
                    player.dimension.runCommand(`give ${playerName} touhou_little_maid:memorizable_gensokyo_1 1`);
                    // 给魂符
                    player.dimension.runCommand(`give ${playerName} touhou_little_maid:smart_slab_has_maid 1`);
                    // say something
                    // event.player.sendMessage({translate: ""})
                }
            }            
        });
        // Before Item Use On
        var on_use_player = {};
        world.beforeEvents.itemUseOn.subscribe(event => {
            system.run(()=>{
                // Tool.testBlockInfo(source.dimension, blockLocation);
                if (event.source.typeId == "minecraft:player") {
                    let player = event.source;
                    if(!on_use_player[player.name]){
                        on_use_player[player.name] = true;
                        system.runTimeout(function () {
                            delete on_use_player[player.name];
                        }, 10);
                        // Activate Altar  (Interact with red wool by touhou_little_maid:hakurei_gohei_xxx)
                        if(event.itemStack.typeId.substring(0, 32) == "touhou_little_maid:hakurei_gohei"){
                            if(player.isSneaking){
                                Danmaku.gohei_transform(event);
                            }
                            else if(event.block.typeId == "minecraft:red_wool"){
                                altarStructure.activate(player.dimension, event.block.location, event.blockFace);
                            }
                        }
                        // Place or Pop Item  (Interact with touhou_little_maid:altar_platform_block)
                        if(event.block.typeId == "touhou_little_maid:altar_platform_block" && !player.isSneaking){
                            altarStructure.placeItemEvent(event.block.location, player);
                        }
                    }
                }
            });
        });

        // Item Events
        world.beforeEvents.itemDefinitionEvent.subscribe(event => {
            system.run(()=>{
                if(event.eventName.substring(0, 5) == "thlm:"){
                    switch(event.eventName.substring(5)){
                        // hakurei gohei transform
                        case "hgt": Danmaku.gohei_transform(event); break;
                        // hakurei gohei activate - hakurei gohei (crafting table) transform to true gohei
                        case "hga": Danmaku.gohei_activate(event); break;
                        // spell card
                        case "sc":  CustomSpellCardManger.onSpellCardUseEvent(event); break;
                        // item shoot
                        case "is":  itemShootManager.itemShootEvent(event); break;
                        // ph: photo
                        case "ph":  MaidManager.photoOnUseEvent(event); break;
                        // ss: smart slab
                        case "ss":  MaidManager.smartSlabOnUseEvent(event); break;
                        default: break;
                    }
                }
            })
        });
        
        // Entity Events
        world.beforeEvents.dataDrivenEntityTriggerEvent.subscribe(event => {
            system.run(()=>{
                // Tool.logger(event.id)
                // const {entity, id, modifiers} = data;
                if(event.id.substring(0, 4) == "thlm"){
                    switch(event.id.substring(4, 5)){
                        // 通用事件前缀
                        case ":":
                            switch(event.id.substring(5)){
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
                                default: break;
                            }; break;
                        // 女仆专用事件
                        case "m":
                            switch(event.id.substring(6)){
                                case "d": MaidManager.onDeathEvent(event); break;        // d Death
                                case "f": MaidManager.onTameFollowSuccess(event); break; // f Follow on tamed
                                case "h": MaidManager.returnHomeEvent(event); break;     // h Home
                                case "i": MaidManager.inventoryModeEvent(event); break;  // i Inventory mode
                                case "m": MaidManager.onInteractEvent(event); break;     // m Master interact
                                case "p": MaidManager.onPhotoEvent(event); break;        // p Photo
                                case "s": MaidManager.sitModeEvent(event); break;        // s Sit mode
                                case "t": MaidManager.timerEvent(event); break;          // t Timer
                                case "0": MaidManager.onSpawnEvent(event); break;        // 0 Spawn
                                case "1": MaidManager.onSmartSlabRecycleEvent(event); break;// 1 Smart slab
                                default: break;
                            }
                            break;
                        // 女仆背包专用事件
                        case "b":
                            switch(event.id.substring(6)){
                                // g: grave
                                case "g" : MaidManager.graveAttackEvent(event); break;
                                // t0: type 0 (default)
                                case "t0" : MaidManager.backpackTypeChangeEvent(event, 0); break;
                                // t1: type 1 (small)
                                case "t1" : MaidManager.backpackTypeChangeEvent(event, 1); break;
                                // t2: type 2 (middle)
                                case "t2" : MaidManager.backpackTypeChangeEvent(event, 2); break;
                                // t3: type 3 (big)
                                case "t3" : MaidManager.backpackTypeChangeEvent(event, 3); break;
                            }
                            break;
                        default:
                            break;
                    }
                    
                } 
            });
        });

        // Projectile Hit Event
        world.afterEvents.projectileHitEntity.subscribe(event =>{
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
        
        // Projectile Hit Block Event
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

        // Power Point Scan
        system.runInterval(()=>{
            PowerPoint.scan_tick();
        }, 5);
    }
}