import { Entity, ItemStack } from "@minecraft/server";
import { shoot } from "../custom/Cherry";

export const GoheiCherry = {
    id : "touhou_little_maid:hakurei_gohei_cherry",
    /**
     * @param {Entity} entity
     * @param {ItemStack} item
     */
    shoot:function(entity, item){
        let direction = entity.getViewDirection();
        let location = entity.getHeadLocation();
        
        shoot(entity, location, direction, 9, 3, 3);
    }
}
