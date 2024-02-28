/**
 * 因为基岩版的实体操作及弹幕的底层实现和java版不同
 * 这里的一些方法只是为了保持接口一致而提供的，只是帮助定义和发射弹幕的工具类而不是弹幕本身
 * (Override方法是用于定义实体的，全部不提供)
 */
import { Dimension, Entity, Vector, system } from "@minecraft/server";
import {DanmakuColor} from "./DanmakuColor";
import {DanmakuType} from "./DanmakuType";
import * as Vec from "../libs/vector3d";
import { getRandom } from "../libs/scarletToolKit"
import * as Tool from "../libs/scarletToolKit"

export class EntityDanmaku{
    /**
     * @param {Dimension} world 名为world，实为维度
     * @param {Entity} thrower 发射者，设为false时不指定
     */
    constructor(world, thrower) {
        this.world   = world;
        this.thrower = thrower;

        this.enableThrowerLocation  = false;
        this.Throwerlocation         = undefined;
        this.thrower_offset         = [0,0,0] // 使用thrower时

        this.damage = 6;
        this.color  = DanmakuColor.RANDOM;
        this.type   = DanmakuType.RANDOM;

        this.ticks_existed = 0;

        this.ownerID=undefined;
    }
    /**
     * 以基岩版原生方式，指定三维动量发射弹幕
     * @param {number[]} velocity 
     */
    shoot_bedrock(velocity, inaccuracy){
        // Get location
        let spawn_location;
        if(this.enableThrowerLocation){
            spawn_location = this.Throwerlocation;
        }
        else{
            let s;
            try{
                s = this.thrower.location;
            }
            catch{
                return false;
            }
            spawn_location = [s.x + this.thrower_offset[0],
                          s.y + this.thrower_offset[1],
                          s.z + this.thrower_offset[2]];
        }
        // Get type
        let type = this.type==DanmakuType.RANDOM ? DanmakuType.random() : this.type;
        // Spawn entity
        let danmaku = this.world.spawnEntity(
            DanmakuType.getEntityName(type),
            new Vector(spawn_location[0], spawn_location[1], spawn_location[2]));
        // Set color
        danmaku.triggerEvent(DanmakuColor.getTriggerEvent(this.color));
        // Set source
        
        if(this.thrower !== false){
            danmaku.setDynamicProperty("source", this.thrower.id);
        }
        // Set damage
        danmaku.setDynamicProperty("damage", this.damage);

        // Set owner
        if(this.ownerID !== undefined){ danmaku.setDynamicProperty("owner", this.ownerID); }
        // Set velocity
        //  Calculate direct vector
        let bedrock_velocity = velocity;
        // 应用精准度
        if(inaccuracy != 0){
            // 计算旋转轴，取与发射向量相垂直的任意向量
            let rotate_axis;
            if(x==0&&y==0){
                if(z==0) return false; // 向量为0，不符合函数要求
                // 由函数说明，z不为0，取与z轴垂直的x轴
                rotate_axis = [1,0,0];
            }
            else{
                if(y == 0){
                    // 向量在xz平面上，取y轴
                    rotate_axis = [0, 1, 0]
                }
                else{
                    // 与xz平面有一定夹角，取xy平面上与向量垂直的一个向量
                    rotate_axis = [1, -x/y, 0]
                }
            }
            // 绕方向向量旋转旋转轴0~2PI
            rotate_axis = Vec.rotate_axis(rotate_axis, bedrock_velocity, getRandom(0, 2*Math.PI));
            // 绕旋转轴旋转方向向量0~inaccuracy
            bedrock_velocity = Vec.rotate_axis(bedrock_velocity, rotate_axis, getRandom(0, inaccuracy));
        }
        //  Apply impulse to entity
        danmaku.applyImpulse(new Vector(bedrock_velocity[0], bedrock_velocity[1], bedrock_velocity[2]));
    }
    /**
     * 若要一个静止的弹幕，则把velocity设为0。xyz任何时候都不能同时为0
     * @param {Double} x 
     * @param {Double} y 
     * @param {Double} z 
     * @param {Float} velocity 
     * @param {Float} inaccuracy In Radius(0~PI)
     */
    shoot(x, y, z, velocity, inaccuracy=0){
        // Get location
        let spawn_location;
        if(this.enableThrowerLocation){
            spawn_location = this.Throwerlocation;
        }
        else{
            let s;
            try{
                s = this.thrower.location;
            }
            catch{
                return false;
            }
            spawn_location = [s.x + this.thrower_offset[0],
                          s.y + this.thrower_offset[1],
                          s.z + this.thrower_offset[2]];
        }
        // Get type
        let type = this.type==DanmakuType.RANDOM ? DanmakuType.random() : this.type;
        // Spawn entity
        let danmaku = this.world.spawnEntity(
            DanmakuType.getEntityName(type),
            new Vector(spawn_location[0], spawn_location[1], spawn_location[2]));
        // Set color
        danmaku.triggerEvent(DanmakuColor.getTriggerEvent(this.color));
        // Set source
        
        if(this.thrower !== false){
            danmaku.setDynamicProperty("source", this.thrower.id);
            
        }
        // Set damage
        danmaku.setDynamicProperty("damage", this.damage);
        // Set owner
        if(this.ownerID !== undefined){ danmaku.setDynamicProperty("owner", this.ownerID); }
        // Set velocity
        //  Calculate direct vector
        let bedrock_velocity;
        if(velocity==0){
            bedrock_velocity = [0,0,0];
        }
        else{
            bedrock_velocity = Vec.getVector_speed_direction(velocity, [x,y,z]);
            // 应用精准度
            if(inaccuracy != 0){
                // 计算旋转轴，取与发射向量相垂直的任意向量
                let rotate_axis;
                if(x==0&&y==0){
                    if(z==0) return false; // 向量为0，不符合函数要求
                    // 由函数说明，z不为0，取与z轴垂直的x轴
                    rotate_axis = [1,0,0];
                }
                else{
                    if(y == 0){
                        // 向量在xz平面上，取y轴
                        rotate_axis = [0, 1, 0]
                    }
                    else{
                        // 与xz平面有一定夹角，取xy平面上与向量垂直的一个向量
                        rotate_axis = [1, -x/y, 0]
                    }
                }
                // 绕方向向量旋转旋转轴0~2PI
                rotate_axis = Vec.rotate_axis(rotate_axis, bedrock_velocity, getRandom(0, 2*Math.PI));
                // 绕旋转轴旋转方向向量0~inaccuracy
                bedrock_velocity = Vec.rotate_axis(bedrock_velocity, rotate_axis, getRandom(0, inaccuracy));
            }
        }
        //  Apply impulse to entity
        danmaku.applyImpulse(new Vector(bedrock_velocity[0], bedrock_velocity[1], bedrock_velocity[2]));
        // Ticks existed
        if(this.ticks_existed > 0){
            system.runTimeout(()=>{
                try{
                    danmaku.triggerEvent("despawn");
                }catch{}
            }, this.ticks_existed);
        }
    }

    /**
     * @param {Integer} damage
     * @returns {EntityDanmaku}
     */
    setDamage(damage){
        this.damage = damage;
        return this;
    }
    /**
     * @param {Integer} color DanmakuColor
     * @returns {EntityDanmaku}
     */
    setColor(color) {
        this.color = color;
        return this;
    }
    /**
     * @param {Integer} type DanmakuType
     * @returns {EntityDanmaku}
     */
    setDanmakuType(type) {
        this.type = type;
        return this;
    }

    //////// 工具函数 ////////
    /**
     * @param {Entity} danmaku
     */
    static getDamage(danmaku){
        return danmaku.getDynamicProperty("damage");
    }

    //////// Unused ////////
    /**
     * 用于判定两个可驯服实体的主人是否相同
     * 基岩版的component目前无法获取到主人，无法实现
     * @param {Entity} tameableA
     * @param {Entity} tameableA
     * @returns {boolean}
     */
    static hasSameOwner(tameableA, tameableB){
        return false;
    }
    /**
     * 设置重力大小，暂未实现
     * @param {Float} gravity 
     * @returns 
     */
    setGravityVelocity(gravity){
        return this;
    }
     /**
     * 指定发射位置
     * @param {Entity} thrower 
     * @returns {DanmakuShoot}
     */
    setThrower(thrower){
        this.thrower = thrower;
        this.enableThrowerLocation = false;
        return this;
    }
    /**
     * 指定发射位置
     * @param {number[]} location 
     * @returns {DanmakuShoot}
     */
    setThrowerLocation(location){
        this.Throwerlocation = location;
        this.enableThrowerLocation = true;
        return this;
    }
    /**
     * 设置发射位置的偏移(未使用setShootLocation()时生效)
     * @param {Float[]} offset 
     */
    setThrowerOffset(offset){
        this.thrower_offset = offset;
        return this;
    }

    /**
     * 设置弹幕的留存时间
     * @param {number} tick 
     */
    setLifeTime(tick){
        this.ticks_existed = tick;
        return this;
    }

    /**
     * 设置主人id(女仆专用)
     * @param {string} id 
     */
    setOwnerID(id){
        this.ownerID=id;
        return this;
    }
}