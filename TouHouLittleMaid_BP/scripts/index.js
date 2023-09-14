import { world, system } from "@minecraft/server"
import { altarStructure } from "./altar/AltarStructureHelper";

import PowerPoint from "./entities/power_point"
import * as Danmaku from "./entities/danmaku/main"
import * as Tool from"./libs/scarletToolKit";

// World Initialize
world.afterEvents.worldInitialize.subscribe((e) => {
    PowerPoint.init_scoreboard_world();
    PowerPoint.init_dynamic_properties(e);
});

system.runTimeout(()=>{
    thlm.main();
},100)

class thlm {
    static main(){
        world.afterEvents.playerSpawn.subscribe(event => {
            if(event.initialSpawn){
                // say something
                // event.player.sendMessage({translate: ""})
            }
            
        });
        // Before Item Use On
        world.beforeEvents.itemUseOn.subscribe(event => {
            system.run(()=>{
                // Tool.testBlockInfo(source.dimension, blockLocation);
                if (event.source.typeId == "minecraft:player") {
                    // Activate Altar  (Interact with red wool by touhou_little_maid:hakurei_gohei)
                    if(event.itemStack.typeId == "touhou_little_maid:hakurei_gohei" && event.block.typeId == "minecraft:red_wool"){
                        altarStructure.activate(event.source.dimension, event.block.location, event.blockFace);
                    }
    
                    // Place or Pop Item  (Interact with touhou_little_maid:altar_platform_block)
                    if(event.block.typeId == "touhou_little_maid:altar_platform_block" && !event.source.isSneaking){
                        altarStructure.placeItemEvent(event.block.location, event.source)
                    }
                }
            });
        });

        // Item Events
        world.beforeEvents.itemDefinitionEvent.subscribe(event => {

        });

        // Entity Events
        world.beforeEvents.dataDrivenEntityTriggerEvent.subscribe(data => {
            system.run(()=>{
                // const {entity, id, modifiers} = data;
                if(data.id.substring(0, 5) == "thlm:"){
                    switch(data.id.substring(5)){
                        // at: altar_tick
                        case "at": 
                            altarStructure.deactivateEvent(data.entity); 
                            // altarStructure.refreshItemsEvent(entity); // TODO: Reduce execution frequency
                            break;
                        // af: altar_refresh
                        case "af":
                            altarStructure.refreshItemsEvent(data.entity)
                            break;
                        // ppi: power_point_init
                        case "ppi":
                            PowerPoint.init_power_point(data.entity);
                            break;
                        // pps: power point scan (powerpoint)
                        case "pps":
                            PowerPoint.scan_powerpoint(data.entity);
                            break;
                        case "hgd":
                            Tool.logger("thlm:hgd");
                            break;
                        default: break;
                    }
                } 
            });
        });

        // Projectile Hit Event
        world.afterEvents.projectileHit.subscribe(event =>{
            system.run(()=>{
                try{
                    var projectile = event.projectile;
                    if(projectile != undefined){
                        var typeId = event.projectile.typeId;
                        if(typeId != undefined){
                            if(typeId.substring(0, 6) == "thlmd:"){
                                Danmaku.danmakuHitEvent(event);
                            }
                            else if(typeId == "touhou_little_maid:power_point"){
                                PowerPoint.powerpoint_hit(projectile, event.dimension);
                            }
                        }
                    }
                }
                catch{}
            });
        });

        system.runInterval(()=>{
            PowerPoint.scan_tick();
        }, 5);
    }
}