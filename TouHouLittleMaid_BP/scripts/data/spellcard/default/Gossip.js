import { system } from "@minecraft/server";
import { getRandom } from "../../../src/libs/ScarletToolKit";
import { Vector } from "../../../src/libs/VectorMC";
import { GeneralBulletColor as Color, GeneralBulletType as Type, GeneralBullet, } from "../../../src/danmaku/shapes/main";
import { BulletShoot } from "../../../src/danmaku/shoots/BulletShoot";
import { EntityDanmakuActor } from "../../../src/danmaku/actors/EntityDanmakuActor";
export const SpellCard = {
    // 释放该符卡的物品id，必须以thlms为开头
    id: "thlms:gossip",
    /**
     * 执行的符卡逻辑，函数签名固定，会直接调用
     */
    spellCard: function (world, entity) {
        let smallStarShoot = new BulletShoot({
            thrower: new EntityDanmakuActor(entity)
                .setOffset(new Vector(0, 0.8, 0)),
            shape: new GeneralBullet()
                .setDamage(2)
                .setGeneralBulletType(Type.STAR)
                .setColor(Color.RANDOM)
        });
        let bigStarShoot = new BulletShoot({
            thrower: new EntityDanmakuActor(entity)
                .setOffset(new Vector(0, 0.8, 0)),
            shape: new GeneralBullet()
                .setDamage(4)
                .setGeneralBulletType(Type.BIG_STAR)
                .setColor(Color.RANDOM)
        });
        for (let i = 0; i < 20; i++) {
            system.runTimeout(() => {
                let direction = entity.getViewDirection();
                smallStarShoot.shootByDirection(direction, getRandom(0.3, 1), Math.PI / 7);
                smallStarShoot.shootByDirection(direction, getRandom(0.3, 1), Math.PI / 7);
                smallStarShoot.shootByDirection(direction, getRandom(0.3, 1), Math.PI / 7);
                bigStarShoot.shootByDirection(direction, getRandom(0.3, 1), Math.PI / 15);
                bigStarShoot.shootByDirection(direction, getRandom(0.3, 1), Math.PI / 15);
            }, i * 2);
        }
    }
};
//# sourceMappingURL=Gossip.js.map