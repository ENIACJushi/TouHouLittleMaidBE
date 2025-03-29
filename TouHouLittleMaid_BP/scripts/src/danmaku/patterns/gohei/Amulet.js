import { Amulet } from "../../shapes/main";
import { BulletShoot } from "../../shoots/BulletShoot";
import { EntityDanmakuActor } from "../../actors/EntityDanmakuActor";
/**
 *
 * @param {Entity} entity
 * @param {Location} location
 * @param {Vector} direction
 * @param {number} damage
 * @param {number} piercing 穿透力 暂未实现
 */
export function shoot(entity, location, direction, damage = 3, piercing = 0) {
    let bulletShoot0 = new BulletShoot({
        thrower: new EntityDanmakuActor(entity, true),
        shape: new Amulet()
            .setDamage(damage)
    });
    bulletShoot0.shootByDirection(direction, 0.1, 0);
    // let bulletShoot = new BulletShoot({
    //   thrower: new EntityDanmakuActor(entity, true),
    //   shape: new GeneralBullet()
    //     .setDamage(damage)
    //     .setGeneralBulletType(GeneralBulletType.AMULET)
    // })
    // bulletShoot.shootByDirection(direction, 0.5, 0.05);
}
//# sourceMappingURL=Amulet.js.map