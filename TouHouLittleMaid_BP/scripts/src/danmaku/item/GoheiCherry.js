import { Entity, ItemStack, Vector } from "@minecraft/server";
import { shoot } from "../custom/Cherry";
import { config } from "../../controller/Config";

export const GoheiCherry = {
    id : "touhou_little_maid:hakurei_gohei_cherry",
    /**
     * @param {Entity} entity
     * @param {ItemStack} item
     */
    shoot:function(entity, item){
        let direction = entity.getViewDirection();
        let location = entity.getHeadLocation();
        
        shoot(entity, location, direction, 9*config.player_damage, 3*config.player_damage, 6);
    }
}
