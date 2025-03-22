import { testCommandRegister } from "../TestCommandRegister";
import { GeneralBullet } from '../../src/danmaku/shapes/bullets/general_bullet/GeneralBullet';
import { logger } from "../../src/libs/ScarletToolKit";
import { BulletShoot } from '../../src/danmaku/shoots/BulletShoot';
import { EntityDanmakuActor } from "../../src/danmaku/actors/EntityDanmakuActor";
export class BulletTest {
    constructor() {
        testCommandRegister.register('b1', (source) => {
            logger('test: bullet');
            new BulletShoot({
                shape: new GeneralBullet().setRandomColor().setRandomType().setDamage(1).setLifeTime(20),
                thrower: new EntityDanmakuActor(source, true),
                preJudge: true,
            }).shootByDirection(source.getViewDirection(), 0.05);
        });
        testCommandRegister.register('b2', (source) => {
            logger('test: bullet');
            new BulletShoot({
                shape: new GeneralBullet().setRandomColor().setRandomType().setDamage(1).setLifeTime(20),
                thrower: new EntityDanmakuActor(source, true),
                preJudge: true,
            }).shootByVelocity(source.getViewDirection(), 0.05);
        });
    }
}
//# sourceMappingURL=BulletTest.js.map