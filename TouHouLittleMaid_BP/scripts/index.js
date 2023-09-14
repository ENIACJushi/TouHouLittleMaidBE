import { world, system } from "@minecraft/server"
import { altarStructure } from "./altar/AltarStructureHelper";

import PowerPoint from "./entities/power_point"
import * as Danmaku from "./entities/danmaku/main"
import * as Tool from"./libs/scarletToolKit";

// World Initialize
world.afterEvents.worldInitialize.subscribe((e) => {
    PowerPoint.init_scoreboard_world();
});

system.runTimeout(()=>{
    thlm.main();
    world.sendMessage("§e[THLM] Addon Loaded!")
},100)

class thlm {
    static main(){
        // Before Item Use On
        world.beforeEvents.itemUseOn.subscribe(data => {
            system.run(()=>{
                const { blockFace, blockLocation, faceLocationX, faceLocationY, item, source } = data;
                // Tool.testBlockInfo(source.dimension, blockLocation);
                if (source.id == "minecraft:player") {
                    const block = source.dimension.getBlock(blockLocation);
                    // Activate Altar  (Interact with red wool by touhou_little_maid:hakurei_gohei)
                    if(item.id == "touhou_little_maid:hakurei_gohei" && block.id == "minecraft:red_wool"){
                        altarStructure.activate(source.dimension, blockLocation, blockFace);
                    }
    
                    // Place or Pop Item  (Interact with touhou_little_maid:altar_platform_block)
                    if(block.id == "touhou_little_maid:altar_platform_block" && !source.isSneaking){
                        altarStructure.placeItemEvent(blockLocation, source, item)
                    }
                }
            });
        });


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

        system.runInterval(()=>{
            PowerPoint.scan_tick();
        }, 5);

        world.afterEvents.projectileHit.subscribe(event =>{
            system.run(()=>{
                Tool.logger(event.projectile.typeId);
                if(event.projectile){
                    if(event.projectile.typeId.substring(0, 6) == "thlmd:"){
                        Danmaku.projectileHitEvent(event);
                    }
                    else if(event.projectile.typeId == "touhou_little_maid:power_point"){
                        PowerPoint.powerpoint_hit(event.projectile, event.dimension);
                    }
                }
            });
        });
        // world.events.projectileHit.subscribe(event =>{
        //     Danmaku.projectileHitEvent(event);
        // });
    }
}