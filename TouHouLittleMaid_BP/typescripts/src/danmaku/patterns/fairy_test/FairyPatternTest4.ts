
/**
 * 樱花束
 */
import { Entity, system } from "@minecraft/server";
import { SakuraLaser } from "../SakuraLaser";

export class FairyPatternTest4 {
  shoot(thrower: Entity): boolean {
    SakuraLaser.shoot(thrower, thrower.getHeadLocation(), thrower.getViewDirection(), 9, 3, 3);
    for (let i2 = 0; i2 < 0; i2++) {
      system.runTimeout(() => {
        for (let i = 0; i < 5; i++) {
          SakuraLaser.shoot(thrower, thrower.getHeadLocation(), thrower.getViewDirection(), 9, 3, 3);
        }
      }, i2)
    }
    return true;
  }
}
