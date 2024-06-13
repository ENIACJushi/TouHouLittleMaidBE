/**
 * TODO: 实现重力 gravity
 */

import { Dimension, Entity } from "@minecraft/server";
import {DanmakuColor} from "./DanmakuColor"
import {DanmakuType} from "./DanmakuType"
import {EntityDanmaku} from "./EntityDanmaku"
import * as Tool from "../libs/ScarletToolKit"
import { Vector, VectorMC } from "../libs/VectorMC";

export class DanmakuShoot{
    static RANDOM      = Math.random();
    static MAX_YAW     = 2 * Math.PI;
    static MIN_FAN_NUM = 2;

    constructor() {
        // Shooter
        this.world   = undefined; // NOT NULL
        this.thrower = undefined;
        this.target  = undefined;

        this.enable_shoot_location  = false;
        this.shoot_location         = undefined;
        this.enable_target_location = false;
        this.target_location        = undefined;
        this.pre_judge              = false;
        this.pre_judge_verticle     = false;

        this.target_offset = new Vector(0, 0, 0);
        this.thrower_offset = new Vector(0, 0, 0); // 获取不了碰撞箱大小，故手动指定

        // Danmaku basic
        this.color      = DanmakuColor.RANDOM;
        this.type       = DanmakuType.RANDOM;
        this.damage     = 6;
        this.gravity    = 0.2;
        this.velocity   = 0.6;
        this.inaccuracy = 0;
        this.lifeTime   = 0;

        // Fan Shaped
        this.yawTotal = 3;
        this.fanNum   = 3;
        this.axisRotation  = 0; // 中轴绕发射向量的旋转角度（先转）
        this.directionRotation = 0; // 发射向量绕旋转向量旋转的角度（后转）

        // 女仆专用
        this.ownerID = undefined;
    }
    static create(){
        return new DanmakuShoot();
    }
    /**
     * 计算发射到目标的向量，并应用发射位置到弹幕
     * @param {EntityDanmaku} danmaku
     * @returns {Vector} 弹幕的动量（包含大小）
     */
    calculateVelocity(danmaku){
        let s_location, t_location;

        //// 计算发射位置 ////
        if(this.enable_shoot_location){
            // 指定射击位置模式
            s_location = this.shoot_location;
            danmaku.setThrowerLocation(this.shoot_location);
        }
        else{
            // 指定射击实体模式
            let s;
            try{// 有的实体死了，但对象仍然在，只能用try检测
                s = this.thrower.location;
            }
            catch{
                return false;
            }
            s_location = new Vector(
                s.x + this.thrower_offset.x,
                s.y + this.thrower_offset.y,
                s.z + this.thrower_offset.z);
            danmaku.setThrowerOffset(this.thrower_offset);
        }

        //// 计算目标位置 ////
        if(this.enable_target_location){
            // 指定目标位置模式
            t_location = this.target_location;
        }
        else{
            // 指定目标实体模式
            let t;
            try{// 有的实体死了，但对象仍然在，只能用try检测
                t = this.target.location;
            }
            catch{
                return false
            }
            t_location = new Vector(
                t.x + this.target_offset.x,
                t.y + this.target_offset.y,
                t.z + this.target_offset.z)
        }

        //// 计算发射者到目标的向量 ////
        if(VectorMC.equals(s_location, t_location)){
            return new Vector(this.velocity, 0, 0);
        }
        else{
            if(this.pre_judge && !this.enable_target_location){ // 预瞄，必须给定目标实体   幻翼：我超有挂
                let targetV = this.target.getVelocity();
                if(!this.pre_judge_verticle) targetV.y = 0; // 受重力和落地影响，容易误判，竖直方向默认关闭

                let targetLocation = VectorMC.add(t_location, VectorMC.multiply(targetV, 5)); // 因为弹幕创建存在延迟，这里要加一个时间差
                if(!VectorMC.equals(s_location, targetLocation)){ // 发射点和目标点不能重合
                    return VectorMC.preJudge(s_location, targetLocation, this.velocity, targetV);
                }
            }
            // 不使用预瞄或预瞄点与发射点重合
            return VectorMC.getVector_speed_direction(this.velocity , new Vector(
                t_location.x - s_location.x,
                t_location.y - s_location.y,
                t_location.z - s_location.z));
        }
    }
    aimedShot() {
        let danmaku = new EntityDanmaku(this.world, this.thrower)
                .setDamage(this.damage).setGravityVelocity(this.gravity)
                .setDanmakuType(this.type).setColor(this.color);
        danmaku.setLifeTime(this.lifeTime)
        // 设置主人
        if(this.ownerID!==undefined){ danmaku.setOwnerID(this.ownerID); }
        
        let v = this.calculateVelocity(danmaku);
        if(!v) return false;
        danmaku.shoot_bedrock(v, this.inaccuracy);
        return true;
        // TODO: world.playSound(null, thrower.getX(), thrower.getY(), thrower.getZ(), SoundEvents.SNOWBALL_THROW, thrower.getSoundSource(), 1.0f, 0.8f);
    }
    fanShapedShot(){
        if (this.yawTotal < 0 || this.yawTotal > DanmakuShoot.MAX_YAW ||
             this.fanNum < DanmakuShoot.MIN_FAN_NUM) {
            return false;
        }
        // Set basic danmaku properties
        let danmaku = new EntityDanmaku(this.world, this.thrower)
                .setDamage(this.damage).setGravityVelocity(this.gravity)
                .setDanmakuType(this.type).setColor(this.color);
        
        danmaku.setLifeTime(this.lifeTime);

        // 设置主人
        if(this.ownerID!==undefined){ danmaku.setOwnerID(this.ownerID); }
        let v = this.calculateVelocity(danmaku);
        if(!v) return false;
        v = VectorMC.normalized(v);
        // 处理扇形偏转
        let yaw = -(this.yawTotal / 2);
        let addYaw = this.yawTotal / (this.fanNum - 1);
        let yawAxis;
        // 计算旋转轴
        if(v.y == 0){
            // 发射向量与水平面平行，取y轴为旋转轴
            yawAxis = new Vector(0, 1, 0);
        }
        else{
            // 旋转轴与发射向量垂直，且二者所在平面与水平面垂直
            // 即与两向量垂直的向量（平面的法向量）与水平面平行（y=0）
            // 由点积，设该法向量为（1，0，-x1/z1）
            if(v.x === 0){
                yawAxis = new Vector(0, -v.y, v.z);
            }
            else{
                yawAxis = new Vector(
                    1,
                    -( v.x + (v.z*v.z)/v.x ) / v.y,
                    v.z/v.x);
            }
        }
        yawAxis = VectorMC.normalized(yawAxis)
        
        // 绕发射向量旋转旋转向量
        if(this.axisRotation!=0){
            yawAxis = VectorMC.rotate_axis(yawAxis, v, this.axisRotation);
        }
        
        // 绕发射和中轴所在平面的法向量旋转发射向量
        if(this.directionRotation!=0){
            v = VectorMC.rotate_axis(v, new Vector(1, 0, -v.x/v.z), this.directionRotation);
        }
        // 每个弹幕的向量
        for (let i = 1; i <= this.fanNum; i++) {
            let v1 = VectorMC.rotate_axis(v, yawAxis, yaw);
            yaw = yaw + addYaw;
            danmaku.shoot(v1, this.velocity, this.inaccuracy);
        }
        return true;
        // world.playSound(null, thrower.getX(), thrower.getY(), thrower.getZ(), SoundEvents.SNOWBALL_THROW, thrower.getSoundSource(), 1.0f, 0.8f);
    }
    /**
     * 指定方向发射
     * @param {Vector} direction
     * @returns 
     */
    directionShoot(direction){
        let danmaku = new EntityDanmaku(this.world, this.thrower)
            .setDamage(this.damage).setGravityVelocity(this.gravity)
            .setDanmakuType(this.type).setColor(this.color);
        
        danmaku.shoot(direction, this.velocity, this.inaccuracy);
    }
    /**
     * @param {Dimension} world 
     * @returns {DanmakuShoot}
     */
    setWorld(world){
        this.world = world;
        return this;
    }
    /**
     * @param {Entity} thrower 
     * @returns {DanmakuShoot}
     */
    setThrower(thrower){
        this.thrower = thrower;
        return this;
    }
    /**
     * @param {number} color 1~13
     * @returns {DanmakuShoot}
     */
    setColor(color){
        this.color = color;
        return this;
    }
    /**
     * @returns {DanmakuShoot}
     */
    setRandomColor(){
        this.color = DanmakuColor.random();
        return this;
    }
    /**
     * @param {Integer} type DanmakuType
     * @returns {DanmakuShoot}
     */
    setType(type) {
        this.type = type;
        return this;
    }
    /**
     * @returns {DanmakuShoot}
     */
    setRandomType() {
        this.type = DanmakuType.random();
        return this;
    }
    /**
     * 
     * @param {Float} gravity 
     * @returns {DanmakuShoot}
     */
    setGravity(gravity) {
        this.gravity = gravity;
        return this;
    }
    /**
     * 
     * @param {Integer} damage 不确定是否能为小数
     * @returns {DanmakuShoot}
     */
    setDamage(damage) {
        this.damage = damage;
        return this;
    }
    /**
     * @param {Entity} target 
     * @returns {DanmakuShoot}
     */
    setTarget(target) {
        this.target = target;
        return this;
    }
    /**
     * 和基岩版的矢量操控不同，这里的velocity是速率，没有方向
     * @param {Float} velocity 
     * @returns {DanmakuShoot}
     */
    setVelocity(velocity) {
        this.velocity = velocity;
        return this;
    }
    /**
     * @param {Float} inaccuracy 
     * @returns {DanmakuShoot}
     */
    setInaccuracy(inaccuracy) {
        this.inaccuracy = inaccuracy;
        return this;
    }
    /**
     * @param {Double} yawTotal 
     * @returns {DanmakuShoot}
     */
    setYawTotal(yawTotal) {
        this.yawTotal = yawTotal;
        return this;
    }
    /**
     * @param {Integer} fanNum 
     * @returns {DanmakuShoot}
     */
    setFanNum(fanNum) {
        this.fanNum = fanNum;
        return this;
    }
    /**
     * 指定发射位置
     * @param {Vector} location 
     * @returns {DanmakuShoot}
     */
    setThrowerLocation(location){
        this.shoot_location = location;
        this.enable_shoot_location = true;
        return this;
    }
    /**
     * 指定目标位置
     * @param {Vector} location
     * @returns {DanmakuShoot}
     */
    setTargetLocation(location){
        this.target_location = location;
        this.enable_target_location = true;
        return this;
    }
    /**
     * 设置目标位置的偏移(未使用setTargetLocation()时生效)
     * @param {Vector} offset 
     */
    setTargetOffSet(offset){
        this.target_offset = offset;
        return this;
    }
    /**
     * 设置发射位置的偏移(未使用setThrowerLocation()时生效)
     * @param {Vector} offset 
     */
    setThrowerOffSet(offset){
        this.thrower_offset = offset;
        return this;
    }
    /**
     * 设置扇形弹幕 中轴绕发射向量的旋转角度（先转）
     * @param {number} raduis axis 
     */
    setAxisRotation_axis(raduis){
        this.axisRotation = raduis;
        return this;
    }
    /**
     * 设置扇形弹幕 发射向量绕中轴旋转的角度（后转）
     * @param {number} raduis axis 
     */
    setAxisRotation_direction(raduis){
        this.directionRotation = raduis;
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
    /**
     * 设置弹幕留存时间
     * @param {number} tick 
     */
    setLifeTime(tick){
        this.lifeTime = tick;
        return this;
    }
    /**
     * 启用预瞄
     * @returns {DanmakuShoot}
     */
    enablePreJudge(){
        this.pre_judge = true;
        return this;
    }
    /**
     * 启用竖直方向的预瞄
     * @returns {DanmakuShoot}
     */
    enableVerticlePreJudge(){
        this.pre_judge_verticle = true;
        return this;
    }
}