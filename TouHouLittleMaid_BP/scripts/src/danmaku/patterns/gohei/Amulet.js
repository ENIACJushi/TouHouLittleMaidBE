import { Entity } from "@minecraft/server";
import { Vector } from "../../../libs/VectorMC";
import { DanmakuShoot } from "../../DanmakuShoot";
import { DanmakuType } from "../../DanmakuType";
import { EntityDanmaku } from "../../EntityDanmaku";
/**
 *
 * @param {Entity} entity
 * @param {Location} location
 * @param {Vector} direction
 * @param {number} damage
 * @param {number} piercing 穿透力 暂未实现
 */
export function shoot(entity, location, direction, damage = 3, piercing = 0) {
    new EntityDanmaku(entity.dimension, entity)
        .setDanmakuType(DanmakuType.AMULET)
        .setThrowerLocation(location)
        .setDamage(damage)
        .shoot(direction, 0.5, 0.05);
}
//# sourceMappingURL=Amulet.js.map