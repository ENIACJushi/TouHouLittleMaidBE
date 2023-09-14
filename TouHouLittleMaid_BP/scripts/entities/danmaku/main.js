
import * as Tool from "../../libs/scarletToolKit"
import { ProjectileHitAfterEvent } from "@minecraft/server";

/**
 * 
 * @param {ProjectileHitAfterEvent} ev 
 * @returns 
 */
export function projectileHitEvent(ev){
    if(ev.projectile && ev.projectile.nameTag.substring(0, 6) == "thlmd:"){
        if(ev.getBlockHit() != undefined){
            ev.projectile.triggerEvent("despawn");
            return;
        }
        if(ev.getEntityHit() != null){
            if(ev.getEntityHit().entity == ev.source){
                Tool.logger("source");
                return;
            }
            else{
                Tool.logger("damage");
            }
        }
    }
    Tool.logger("undefine/not thlmd")
}