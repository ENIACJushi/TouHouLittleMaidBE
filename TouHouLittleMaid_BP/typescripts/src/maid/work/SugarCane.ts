// @ts-nocheck
import { Entity, Dimension, system } from "@minecraft/server";
import { Vector } from "../../libs/VectorMC";
import { SpeedController } from "./SpeedController";

/**
 * 甘蔗
 */
export class SugarCane{
    static maxLack = 2; // 进入慢扫描的连续缺目标次数
    static lackStep = 5; // 慢扫描等待步数
    static minCount = 10; // 缺目标的最大目标数
    static maxCount = 40; // 单次扫描获取的最大目标数 到达该数量则停止扫描 确定标准为一个目标实体生命周期内，女仆能收集到的最大目标数

    /**
     * 放置目标, 位置应为整数方块坐标
     * @param {Dimension} dimension 
     * @param {Vector} location 
     */
    static place(dimension, location){
        // 若该位置已经有目标，则不放置
        let entities = dimension.getEntitiesAtBlockLocation(location);
        for(let entity of entities){
            if(entity.typeId === "thlmt:sugar_cane"){
                return;
            }
        }
        // 放置目标
        dimension.spawnEntity("thlmt:sugar_cane", 
        new Vector(location.x + 0.5, location.y + 0.2, location.z + 0.5))
    }
    /**
     * 收集甘蔗
     * @param {Entity} target 
     * @param {Entity} maid 
     */
    static acquire(target, maid){
        let block = target.dimension.getBlock(target.location);
        if(block !== undefined && block.typeId === "minecraft:reeds"){
            const l = block.location;
            block.dimension.runCommand(`setblock ${l.x} ${l.y} ${l.z} air destroy`);
        }
        // 无论是否成功破坏甘蔗，都清除目标
        target.triggerEvent("despawn");
    }
    /**
     * 寻找甘蔗
     * @param {Entity} maid
     * @param {number} range
     * @returns {object} 
     */
    static search(maid, _range=6){
        ///// 需求判断 /////
        const dimension = maid.dimension;
        const location = maid.location;
        /**
         * 获取范围内已经标定的点
         * 若附近目标数少于3则开始扫描
         */
        let existedTargets = dimension.getEntities({
            "location": location, "maxDistance": _range, "type": "thlmt:sugar_cane"});
        if(existedTargets.length > 3) return;

        ///// 频率调整 /////
        let range = _range;
        let temp = SpeedController.beforeSearch(maid, this.maxLack, this.lackStep);
        if(!temp.run) return;
        if(temp.lackmode) range = range + 10; // 若进入了慢扫描模式，则增大扫描范围

        ///// 搜索 /////
        /**
         * 获取方块耗时 0.01ms，一刻 50ms，尽量在10ms内完成搜索，即1000次查询
         * 一般来说，甘蔗地的起伏不会太大，设女仆位置的高度为 y，搜索 y-2 ~ y+3 就足够了，即6格高，对应面积 166 的 2D 区域，边长大约为 13
         * 
         * 目标方块下方的方块是甘蔗，且下下方的方块不是甘蔗
         * 为了方便搜索，匹配目标方块下方的方块，即上方是甘蔗，而下方不是甘蔗的甘蔗。
         * 
         * 甘蔗通常种植在同一高度，所以搜索开始的高度设为上一次成功查找的高度
         */
        let y = Math.floor(location.y);
        let xStart = Math.floor(location.x);
        let zStart = Math.floor(location.z);
        let count = 0;
        const MAX = 3; // 单方向最大寻找距离
        for(let ix = 0; ix < range; ix = ix>0 ? -ix : 1-ix){
            system.runTimeout(()=>{
                for(let iz = 0; iz < range; iz = iz>0 ? -iz : 1-iz){
                    if(count > this.maxCount) return;
                    // 流程图：甘蔗查找算法.drawio
                    let x = xStart + ix;
                    let z = zStart + iz;
                    let A = y;
                    // 某个高度的方块的种类是否是目标方块(甘蔗)
                    var isTargetBlock = function(_y){
                        try{
                            let block = dimension.getBlock(new Vector(x, _y, z));
                            return block !== undefined && block.typeId === "minecraft:reeds";
                        }
                        catch{
                            return false;
                        }
                    }
                    if(isTargetBlock(A)){ // A
                        if(isTargetBlock(A-1)){ // A-1
                            // 向下寻找不是甘蔗的方块
                            let B = A - 2;
                            for(let i = 0; i < MAX; i++){
                                if(!isTargetBlock(B-i)){ // B-i
                                    y = B-i+2
                                    this.place(dimension, new Vector(x, y, z)); // 查找成功, B-i+2 是目标点
                                    count++;
                                    break;
                                }
                            }
                            // 查找失败, 次数用尽
                        }
                        else{
                            if(isTargetBlock(A + 1)){// A+1
                                y = A+1;
                                this.place(dimension, new Vector(x, y, z)); // 查找成功, A+1 是目标点
                                count++;
                            }
                            // 查找失败, 一格甘蔗
                        }
                    }
                    else{
                        // 向下查找
                        let needUp = true;
                        for(let i=1; i <= MAX; i++){
                            if(isTargetBlock(A - i)){ // A-1
                                if(isTargetBlock(A-i-1)){ // A-i-1
                                    // 向下寻找不是甘蔗的方块
                                    let B = A - i;
                                    for(let i2 = 0; i2 < MAX; i2++){
                                        if(!isTargetBlock(B-i2)){ // B-i2
                                            // 查找成功, B-i2+2 是目标点
                                            y = B-i2+2;
                                            this.place(dimension, new Vector(x, y, z));
                                            count++;
                                            needUp = false;
                                            break;
                                        }
                                    }
                                    // 查找失败, 次数用尽
                                    needUp = false;
                                }
                                else{
                                    // 查找失败, 一格甘蔗
                                    needUp = false;
                                }
                            }
                        }

                        // 向下超出尝试次数，向上查找
                        if(needUp){
                            for(let i = 1; i <= MAX; i++){
                                if(isTargetBlock(A + i)){
                                    if(isTargetBlock(A+i+1)){
                                        // 查找成功, A+i 是目标点
                                        y = A+i;
                                        this.place(dimension, new Vector(x, y, z));
                                        count++;
                                        break;
                                    }
                                    else{
                                        // 查找失败, 一格甘蔗
                                        break;
                                    }
                                }
                            }
                            // 查找失败, 次数用尽
                        }
                    }
                }
            }, (ix<0 ? 4-8*ix : ix*8));
        }

        ///// 频率调整 /////
        system.runTimeout(()=>{
            SpeedController.afterSearch(maid, count, this.maxLack, this.minCount)
        }, range*8 + 8);
    }
}
