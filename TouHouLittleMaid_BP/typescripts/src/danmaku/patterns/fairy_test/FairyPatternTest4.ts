
/**
 * 樱花束
 */
import { Vector } from "../../../libs/VectorMC";
import { BulletShoot } from "../../shoots/BulletShoot";
import { EntityDanmakuActor } from "../../actors/EntityDanmakuActor";
import { GeneralBullet, GeneralBulletColor, GeneralBulletType } from "../../shapes/main";
import { FanShapedPattern } from "../Fan";
import { getRandom } from "../../../libs/ScarletToolKit";
import { Entity, system } from "@minecraft/server";
import { GoheiCherry } from "../../../items/GoheiCherry";

export class FairyPatternTest4 {
  shoot(thrower: Entity): boolean {
    GoheiCherry.shoot(thrower, undefined);
    for (let i2 = 0; i2 < 0; i2++) {
      system.runTimeout(() => {
        for (let i = 0; i < 5; i++) {
          GoheiCherry.shoot(thrower, undefined);
        }
      }, i2)
    }
    return true;
  }
}
