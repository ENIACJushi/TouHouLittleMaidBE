
/**
 * 樱花束
 */
import { Entity, system } from "@minecraft/server";
import { SakuraLaser } from "../../shapes/laser/SakuraLaser";
import { LineShoot } from "../../shoots/LineShoot";
import { EntityDanmakuActor } from "../../actors/EntityDanmakuActor";
import { Vector } from "../../../libs/VectorMC";

export class FairyPatternTest4 {
  shoot(thrower: Entity): boolean {
    let shoot = new LineShoot({
      shape: new SakuraLaser()
        .setDamageArea(3)
        .setDamageCenter(9),
      thrower: new EntityDanmakuActor(thrower)
        .setHead(true),
    });
    shoot.shootByDirection(thrower.getHeadLocation(), 1);
    // 多射几次
    for (let i2 = 0; i2 < 0; i2++) {
      system.runTimeout(() => {
        for (let i = 0; i < 5; i++) {
          shoot.shootByDirection(thrower.getHeadLocation(), 1);
        }
      }, i2)
    }
    return true;
  }
}
