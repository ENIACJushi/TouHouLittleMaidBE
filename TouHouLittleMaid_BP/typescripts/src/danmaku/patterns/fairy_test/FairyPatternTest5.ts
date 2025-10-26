
/**
 * 预判测试
 */
import { Vector, VO } from "../../../libs/VectorMC";
import { LineShoot } from "../../shoots/LineShoot";
import { EntityDanmakuActor } from "../../actors/EntityDanmakuActor";
import { GeneralBullet, GeneralBulletColor, GeneralBulletType } from "../../shapes/main";
import { Entity, system } from "@minecraft/server";

export class FairyPatternTest5{
  shoot(thrower: Entity): boolean {
    let target = thrower.dimension.getPlayers({
      "closest": 1,
      "location": thrower.location,
      // "name": "Voyage1976" 
    })[0];

    let bulletShoot = new LineShoot({
      thrower: new EntityDanmakuActor(thrower)
        .setOffset(new Vector(0, 1, 0)),
      target: new EntityDanmakuActor(target)
        .setOffset(new Vector(0, 1, 0)),
      shape: new GeneralBullet()
        .setColor(GeneralBulletColor.RANDOM)
        .setGeneralBulletType(GeneralBulletType.GLOWEY_BALL)
        .setDamage(1)
    });
    bulletShoot.enablePreJudge(false);
    
    const n = 18;
    let step = 65 / n;
    for (let i = 0; i < n; i++) {
      system.runTimeout(() => {
        let target = thrower.dimension.getEntities({ "closest": 1, "location": thrower.location, "families": ["phantom"] })[0];

        if (target === undefined) return;

        let distance = VO.length({
          x: thrower.location.x - target.location.x,
          y: thrower.location.y - target.location.y,
          z: thrower.location.z - target.location.z
        });

        let distanceFactor = distance / 6;
        let speed = 0.5 * (distanceFactor + 1);
        thrower.teleport(thrower.location, { "facingLocation": target.location });
        bulletShoot.shootByTarget(speed, 0, new EntityDanmakuActor(target));
      }, step * i);
    }
    return true;
  }
}
