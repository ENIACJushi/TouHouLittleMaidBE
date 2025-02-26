import { testCommandRegister } from "../TestCommandRegister";
import { GeneralBullet } from '../../src/danmaku/bullets/general_bullet/GeneralBullet';
import { world } from "@minecraft/server";
import { logger } from "../../src/libs/ScarletToolKit";
export class BulletTest {
    constructor() {
        logger('test: bullet');
        testCommandRegister.register('bt', (source) => {
            logger('test: bullet');
            let bullet = new GeneralBullet(world.getDimension('overworld'), source)
                .setDamage(3)
                .setThrower(source)
                .setThrowerLocation(source.getHeadLocation())
                .setLifeTime(20)
                .shoot(source.getViewDirection(), 1, 1);
        });
    }
}
//# sourceMappingURL=BulletTest.js.map