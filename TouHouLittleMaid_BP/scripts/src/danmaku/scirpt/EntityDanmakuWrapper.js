import { Dimension, Entity } from "@minecraft/server"
import DanmakuColor  from "../DanmakuColor"
import DanmakuType from "../DanmakuType"
import EntityDanmaku from "../EntityDanmaku"


export class EntityDanmakuWrapper{
    danmaku; // 弹幕实体
    /**
     * 
     * @param {Dimension} worldIn 
     * @param {Entity} throwerIn 
     * @param {DanmakuType} type 
     * @param {DanmakuColor} color 
     */
    constructor(worldIn, throwerIn, type, color){
        this.danmaku = new EntityDanmaku(worldIn, throwerIn);
        this.danmaku.setDanmakuType(type);
        this.danmaku.setColor(color);
    }

    /**
     * 
     * @param {Dimension} worldIn 
     * @param {Entity} throwerIn 
     * @param {number} damage 
     * @param {number} gravity 没用
     * @param {DanmakuType} type 
     * @param {DanmakuColor} color 
     */
    constructor(worldIn, throwerIn, damage, gravity, type, color){
        this.danmaku = new EntityDanmaku(worldIn, throwerIn);
        this.danmaku.setDamage(damage).setDanmakuType(type).setColor(color);
    }

    /**
     * TODO：设置弹幕的留存时间
     * @param {number} ticksExisted 
     */
    setTicksExisted(ticksExisted){
        
    }

    /**
     * 
     * @param {DanmakuType} type 
     */
    setType(type){
        this.danmaku.setType(type);
    }

    /**
     * 
     * @param {DanmakuColor} color 
     */
    setColor(color){
        this.danmaku.setColor(color);
    }

    /**
     * TODO: rotationPitchIn rotationYawIn pitchOffset
     * @param {Entity} entityThrower 
     * @param {*} rotationPitchIn 
     * @param {*} rotationYawIn 
     * @param {*} pitchOffset 
     * @param {float} velocity 
     * @param {float} inaccuracy 
     */
    shoot(entityThrower, rotationPitchIn, rotationYawIn, pitchOffset, velocity, inaccuracy){
        let loc = entityThrower.location;
        this.danmaku.shoot(loc.x, loc.y, loc.z, velocity, inaccuracy);
    }

    /**
     * 
     * @param {float} x 
     * @param {float} y 
     * @param {float} z 
     * @param {float} velocity 
     * @param {float} inaccuracy 
     */
    shoot(x, y, z, velocity, inaccuracy){
        this.danmaku.shoot(x, y, z, velocity, inaccuracy);
    }

    /**
     * TODO: set position
     * @param {number[]} vec3d 
     */
    setPosition(vec3d){

    }
    
    /**
     * TODO: set motion
     * @param {number[]} vec3d 
     */
    setMotion(motion){

    }

    /**
     * 
     * @returns {EntityDanmaku}
     */
    getDanmaku() {
        return this.danmaku;
    }

    /**
     * TODO: 破坏地形
     * @param {*} canDamages 
     */
    setDamagesTerrain(canDamages) {
        // this.danmaku.setDamagesTerrain(canDamages);
    }
}