import { world } from "mojang-minecraft"
import { altarStructure } from "./altar/AltarStructureHelper";
import * as Tool from"./libs/scarletToolKit";


world.events.beforeItemUseOn.subscribe(data => {
    const { blockFace, blockLocation, faceLocationX, faceLocationY, item, source } = data;
    if (source.id == "minecraft:player") {
        const block = source.dimension.getBlock(blockLocation);
        
        // Interact with red wool by touhou_little_maid:hakurei_gohei: activate altar.
        if(item.id == "touhou_little_maid:hakurei_gohei" && block.id == "minecraft:wool" && block.permutation.getProperty("color").value == "red"){
            altarStructure.activate(source.dimension, blockLocation, blockFace);
        }

        // Interact with touhou_little_maid:altar_platform_block: place or pop item.
        if(block.id == "touhou_little_maid:altar_platform_block" && !source.isSneaking){
            altarStructure.placeItemEvent(blockLocation, source, item)
        }
    }
});

world.events.dataDrivenEntityTriggerEvent.subscribe(data => {
    const {entity, id, modifiers} = data;
    switch(id){
        case "touhou_little_maid:altar_tick": 
            altarStructure.deactivateEvent(entity); 
            // altarStructure.refreshItemsEvent(entity); // TODO: Reduce execution frequency
            break;
        default: break;
    }
});
