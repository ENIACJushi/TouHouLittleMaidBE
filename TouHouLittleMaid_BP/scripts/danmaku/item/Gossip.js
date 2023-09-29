import { DanmakuShoot } from "../DanmakuShoot";
import { EntityDanmaku } from "../EntityDanmaku";
import { DanmakuColor } from "../DanmakuColor";
import { DanmakuType } from "../DanmakuType";
import { Entity } from "@minecraft/server";
import { system } from "@minecraft/server";
import { getRandom } from "../../libs/scarletToolKit";
export const Gossip = {
    id : "gossip",
    shoot : [
        // mode 1
        /**
         * 
         * @param {Entity} entity 
         */
        function(entity){
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
    ]
}
