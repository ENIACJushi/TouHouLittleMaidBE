/**
 * 光追弹幕测试：小玉
 */
import { Vector, VO } from "../../../libs/VectorMC";
import { BulletShoot } from "../../shoots/BulletShoot";
import { EntityDanmakuActor } from "../../actors/EntityDanmakuActor";
import { GeneralBullet, GeneralBulletColor, GeneralBulletType } from "../../shapes/main";
import { Entity, system } from "@minecraft/server";
import { Logger } from "../../../controller/main";

const RADIUS_TOTAL = 360 - 360/13; // 扇形总角度

export class FairyPatternTest8 {
    laserIsShooting: boolean = false;
    shoot(thrower: Entity, target: Entity): boolean {
        let bulletShoot = new BulletShoot({
            thrower: new EntityDanmakuActor(thrower)
                .setOffset(new Vector(0, 1, 0)),
            target: new EntityDanmakuActor(target)
                .setOffset(new Vector(0, 1, 0)),
            shape: new GeneralBullet()
                .setGeneralBulletType(GeneralBulletType.ORBS)
                .setColor(GeneralBulletColor.RED)
                .setDamage(0)
        });

        let direction = thrower.getViewDirection();
        let axis = VO.normalized(VO.Advanced.getAnyVerticalVector(direction));
        let angle0 = - RADIUS_TOTAL / 2;
        let angleStep = RADIUS_TOTAL / 12;
        // 扇形发射每种颜色
        for (let i2 = 0; i2 < 9; i2++) {
            system.runTimeout(() => {
                for (let i = 0; i < 13; i++) {
                    (bulletShoot.shape as GeneralBullet).setColor(i + 1); // 颜色从 1 开始
                    let directionShoot = VO.Secondary.rotate_axis(direction, axis, (angle0 + angleStep * i) * (Math.PI/180));
                    bulletShoot.shootByDirection(directionShoot, 0.2);
                }
            }, i2 * 6)
        }
        return true;
    }
}
