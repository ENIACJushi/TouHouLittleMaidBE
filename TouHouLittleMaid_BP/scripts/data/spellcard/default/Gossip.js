import { DanmakuShoot } from "../../../src/danmaku/DanmakuShoot";
import { EntityDanmaku } from "../../../src/danmaku/EntityDanmaku";
import { DanmakuColor } from "../../../src/danmaku/DanmakuColor";
import { DanmakuType } from "../../../src/danmaku/DanmakuType";
import { Entity, ItemStack } from "@minecraft/server";
import { system } from "@minecraft/server";
import { getRandom } from "../../../src/libs/scarletToolKit";

export const SpellCard = {
    // 释放该符卡的物品id，必须以thlms为开头
    id : "thlms:gossip",
    /**
     * 执行的符卡逻辑，函数签名固定，会直接调用
     * @param {Dimension} world 当前所处的世界
     * @param {Entity} entity 释放符卡的实体
     */
    spellCard:function(world, entity){
        var aimDanmakuShoot_small = new EntityDanmaku(entity.dimension, entity);
        aimDanmakuShoot_small.setThrowerOffset([0,0.8,0]).setColor(DanmakuColor.RANDOM).
            setDanmakuType(DanmakuType.STAR).setDamage(2);

        var aimDanmakuShoot_big = new EntityDanmaku(entity.dimension, entity);
        aimDanmakuShoot_big.setThrowerOffset([0,0.8,0]).setColor(DanmakuColor.RANDOM).
            setDanmakuType(DanmakuType.BIG_STAR).setDamage(4);
        
        for(let i=0; i<20;i++){
            system.runTimeout(()=>{
                let direction = entity.getViewDirection();
                aimDanmakuShoot_small.shoot(direction.x, direction.y, direction.z, getRandom(0.3, 1), Math.PI/7);
                aimDanmakuShoot_small.shoot(direction.x, direction.y, direction.z, getRandom(0.3, 1), Math.PI/7);
                aimDanmakuShoot_small.shoot(direction.x, direction.y, direction.z, getRandom(0.3, 1), Math.PI/7);
                aimDanmakuShoot_big.shoot(direction.x, direction.y, direction.z, getRandom(0.3, 1), Math.PI/15);
                aimDanmakuShoot_big.shoot(direction.x, direction.y, direction.z, getRandom(0.3, 1), Math.PI/15);
            }, i*2);
        }
    }
}
