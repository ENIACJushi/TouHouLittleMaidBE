import { world, Vector, EntityQueryOptions } from "mojang-minecraft"
import { altarStructure } from "./altar/AltarStructureHelper";
import * as PowerPoint from "./entities/power_point"
import * as Tool from"./libs/scarletToolKit";

// World Initialize
world.events.worldInitialize.subscribe((e) => {
    PowerPoint.init_scoreboard_world();
});


// Before Item Use On
world.events.beforeItemUseOn.subscribe(data => {
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

// Entity Trigger Event

world.events.dataDrivenEntityTriggerEvent.subscribe(data => {
    const {entity, id, modifiers} = data;
    if(id.substring(0, 5) == "thlm:"){
        switch(id.substring(5)){
            // at: altar_tick
            case "at": 
                altarStructure.deactivateEvent(entity); 
                // altarStructure.refreshItemsEvent(entity); // TODO: Reduce execution frequency
                break;
            // af: altar_refresh
            case "af":
                altarStructure.refreshItemsEvent(entity)
                break;
            // ppi: power_point_init
            case "ppi":
                PowerPoint.init_power_point(entity);
                break;
            // pps: power point scan (powerpoint)
            case "pps":
                PowerPoint.scan_powerpoint(entity);
                break;
            // pph: power point hit (like xp bottle)
            case "pph":
                PowerPoint.powerpoint_hit(entity);
                break;
            case "hgd":
                Tool.logger("thlm:hgd");
                break;
            default: break;
        }
    }
});


var ticks_pp = 0;
world.events.tick.subscribe(event => {
    // Power point scan loop (player)
    ticks_pp ++;
    if (ticks_pp >= 5) {
        ticks_pp = 0;
        PowerPoint.scan_tick();
    }
});
