import { EntityHitEntityAfterEvent, Entity, Dimension, Vector, Block, system } from "@minecraft/server";
import { logger } from "../libs/scarletToolKit";

export class MaidTarget{
    /**
     * 标志物取得
     * @param {EntityHitEntityAfterEvent} event 
     */
    static targetAcquire(event){
        let maid = event.damagingEntity;
        let target = event.hitEntity;

        switch(target.typeId.substring(6)){
            case "sugar_cane": SugarCane.acquire(target, maid); break;
            default: break;
        }
    }
}

// 甘蔗目标
export class SugarCane{
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
     * 寻找甘蔗
     * @param {Dimension} dimension 
     * @param {Vector} location 
     * @param {number} range 
     * @param {number} height
     * @returns {object} 
     */
    static search(dimension, location, range=6){
        /**
         * 获取范围内已经标定的点
         * 若附近目标数少于3则开始扫描，TODO: 连续3次少于3且新得到的目标数量小于3，则进入慢模式，每三步一判断
         */
        let existedTargets = dimension.getEntities({
            "location": location, "maxDistance": range, "type": "thlmt:sugar_cane"});
        if(existedTargets.length > 3) return;

        // 初始化扫描矩阵
        let length = 2*range + 1;
        let matrix = new Array(length);
        for(let i = 0; i < length; i++){
            matrix[i] = new Array(length)
        }
        
        // 记录点位，搜索时跳过
        for(let target of existedTargets){
            matrix[Math.floor(range + target.location.x - location.x)]
                    [Math.floor(range + target.location.z - location.z)] = true;
        }

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
        let xStart = Math.floor(location.x) - range;
        let zStart = Math.floor(location.z);
        const MAX = 3; // 单方向最大寻找距离
        
        for(let ix = 0; ix < length; ix++){
            for(let iz = -1*range; iz < range; iz++){
                system.runTimeout(()=>{
                    if(matrix[ix][iz] !== undefined) return;
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
                                    break;
                                }
                            }
                            // 查找失败, 次数用尽
                        }
                        else{
                            if(isTargetBlock(A + 1)){// A+1
                                y = A+1;
                                this.place(dimension, new Vector(x, y, z)); // 查找成功, A+1 是目标点
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
                    // 查找矩阵仅记录是否已经进行过查找，不记录高度等数据
                    matrix[ix][iz] = true;
                }, (iz<0 ? 4-8*iz : iz*8));
            }
        }
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
}