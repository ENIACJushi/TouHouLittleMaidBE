
import * as Tool from "../../libs/scarletToolKit"
import { ProjectileHitAfterEvent } from "@minecraft/server";

/**
 * 
 * @param {ProjectileHitAfterEvent} ev 
 * @returns 
 */
export function danmakuHitEvent(ev){
    if(ev.getBlockHit() != undefined){
        ev.projectile.triggerEvent("despawn");
        return;
    }
    let hit_info = ev.getEntityHit()
    if(hit_info != null){
        if(hit_info.entity == ev.source){
            return;
        }
        else{
            hit_info.entity.applyDamage(8, {damagingEntity: ev.source, damagingProjectile: ev.projectile});
            ev.projectile.triggerEvent("despawn");
        }
    }
}