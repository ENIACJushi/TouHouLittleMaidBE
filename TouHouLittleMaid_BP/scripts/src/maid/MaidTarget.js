import { EntityHitEntityAfterEvent, Entity, Dimension, Vector, Block, system } from "@minecraft/server";
import { EntityMaid } from "./EntityMaid";
import { logger, pointInArea_3D } from "../libs/ScarletToolKit";

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
            case "melon": Melon.acquire(target, maid); break;
            default: break;
        }
    }
    /**
     * 寻找甘蔗
     * @param {Entity} maid 
     * @param {number} type
     * @param {Dimension} dimension
     * @param {Vector} location
     * @param {number} range
     * @param {number} height
     * @returns {object}
     */
    static search(maid, range=6){
        switch(EntityMaid.Work.get(maid)){
            case EntityMaid.Work.sugar_cane: SugarCane.search(maid, range); break;
            case EntityMaid.Work.melon: Melon.search(maid, range); break;
            case EntityMaid.Work.cocoa: Cocoa.search(maid, range); break;
            default: break;
        }
    }
}

// 扫描速度控制
class SpeedController{
    /**
     * 搜索开始前 判断是否进行搜索
     * @param {Entity} maid 
     * @param {number} [lackStep=5] 
     * @param {number} [maxLack=3] 慢扫描时，每LACKSTEP次调用函数才进行一次扫描
     * @param {boolean}
     */
    static beforeSearch(maid, maxLack=3, lackStep=5){
        let lackCount = maid.getDynamicProperty("target_lack");
        if(lackCount !== undefined && lackCount >= maxLack){
            lackCount++;
            if(lackCount >= maxLack + lackStep){
                maid.setDynamicProperty("target_lack", maxLack);
                return true;
            }
            else{
                maid.setDynamicProperty("target_lack", lackCount);
                return false;
            }
        }
        return true;
    }

    /**
     * 搜索完成后 计数
        * 连续 maxLack 次扫描得到的目标数量小于 minCount，则进入慢模式，每 lackStep 次函数调用进行一次扫描
        * 大于 minCount，则进入快扫描模式，每次函数调用都尝试进行扫描
        * 进入慢扫描模式后 target_lack 就用来计算步数了，不再记录连续小于10的次数
     * @param {Entity} maid 
     * @param {number} count
     * @param {number} [maxLack=3] 
     * @param {number} [minCount=10] 
     */
    static afterSearch(maid, count, maxLack=3, minCount=10){
        if(count < minCount){
            let lackCount = maid.getDynamicProperty("target_lack");
            if(lackCount === undefined){
                maid.setDynamicProperty("target_lack", 1);
            }
            else if(lackCount < maxLack){
                maid.setDynamicProperty("target_lack", lackCount+1);
            }
        }
        else{
            maid.setDynamicProperty("target_lack", 0);
        }
    }
}

// 甘蔗
class SugarCane{
    static maxLack = 3; // 进入慢扫描的连续缺目标次数
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
    static search(maid, range=6){
        ///// 需求判断 /////
        const dimension = maid.dimension;
        const location = maid.location;
        /**
         * 获取范围内已经标定的点
         * 若附近目标数少于3则开始扫描
         */
        let existedTargets = dimension.getEntities({
            "location": location, "maxDistance": range, "type": "thlmt:sugar_cane"});
        if(existedTargets.length > 3) return;

        ///// 频率调整 /////
        if(!SpeedController.beforeSearch(maid, this.maxLack, this.lackStep)) return;

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

// 西瓜、南瓜
export class Melon{
    static maxLack = 3; // 进入慢扫描的连续缺目标次数
    static lackStep = 5; // 慢扫描等待步数
    static minCount = 8; // 缺目标的最大目标数
    static maxCount = 20; // 单次扫描获取的最大目标数 到达该数量则停止扫描 确定标准为一个目标实体生命周期内，女仆能收集到的最大目标数
    
    /**
     * 放置目标, 位置通常为整数方块坐标
     * @param {Dimension} dimension 
     * @param {Vector} location 
     */
    static place(dimension, location){
        // 若该位置已经有目标，则不放置
        let entities = dimension.getEntitiesAtBlockLocation(location);
        for(let entity of entities){
            if(entity.typeId === "thlmt:melon"){
                return;
            }
        }
        // 放置目标
        dimension.spawnEntity("thlmt:melon", 
            new Vector(location.x + 0.5, location.y + 0.4, location.z + 0.5))
    }
    /**
     * 收集瓜类 进行两次攻击后才会将瓜破坏
     * @param {Entity} target 
     * @param {Entity} maid 
     */
    static acquire(target, maid){
        const neededStep = 2;
        let block = target.dimension.getBlock(target.location);
        if(block !== undefined && 
            (block.typeId === "minecraft:melon_block" || block.typeId === "minecraft:pumpkin")){
            // 进行两次攻击后才会将瓜破坏
            let step = target.getProperty("thlmt:step") + 1;
            if(step < neededStep){
                target.setProperty("thlmt:step", step);
                target.triggerEvent("life");
            }
            else{
                const l = block.location;
                block.dimension.runCommand(`setblock ${l.x} ${l.y} ${l.z} air destroy`);
                target.triggerEvent("despawn");
            }

        }
        else{
            // 目标方块已消失，清除目标
            target.triggerEvent("despawn");
        }
    }
    /**
     * 因为不能穿墙攻击 使用脚本定时获取目标
     * 事件每3秒触发一次
     * @param {Entity} maid 
     */
    static stepEvent(maid){
        for(let i = 0; i < 3; i++){
            system.runTimeout(()=>{
                try{
                    if(maid === undefined) return;
                    let target = maid.target;
                    if(target !== undefined){
                        if(pointInArea_3D(
                                target.location.x, target.location.y, target.location.z,
                                maid.location.x - 2, maid.location.y - 2, maid.location.z - 2,
                                maid.location.x + 2, maid.location.y + 2, maid.location.z + 2
                            )){
                            this.acquire(target, maid);
                        }
                    }
                }
                catch{}
            }, i*20);
        }
    }
    /**
     * 寻找瓜类
     * @param {Entity} maid 
     * @param {number} range
     * @returns {object} 
     */
    static search(maid, range=6){
        ///// 需求判断 /////
        const dimension = maid.dimension;
        const location = maid.location;
        let existedTargets = dimension.getEntities({
            "location": location, "maxDistance": range, "type": "thlmt:melon"});
        if(existedTargets.length > 3) return;
        
        
        ///// 频率调整 /////
        if(!SpeedController.beforeSearch(maid, this.maxLack, this.lackStep)) return;

        ///// 搜索 /////
        // 初始化扫描矩阵
        let xStart = Math.floor(location.x);
        let zStart = Math.floor(location.z);
        let y = Math.floor(location.y);
        let length = 2*range + 1;

        let matrix = new Array(length);
        for(let i = 0; i < length; i++){
            matrix[i] = new Array(length)
        }
        // 记录点位，搜索时跳过
        for(let target of existedTargets){
            matrix[Math.floor(target.location.x) - xStart + range]
                    [Math.floor(target.location.z) - zStart + range] = true;
        }

        /**
         * 寻找成熟（"growth"=7）且方向（facing_direction）不为0的瓜蒂(melon_stem/pumpkin_stem)，从而定位瓜的位置
         * 瓜蒂方向
         *  0是没长出瓜，1是无效值，不会自然生成
         *  2：z-1； 3：z+1； 4：x-1； 5：x+1
         */
        const MAX = 3; // 单方向最大寻找距离
        let count = 0;
        for(let ix = 0; ix < range; ix = ix>0 ? -ix : 1-ix){
            system.runTimeout(()=>{
                for(let iz = 0; iz < range; iz = iz>0 ? -iz : 1-iz){
                    if(count > this.maxCount) return;
                    if(matrix[ix+range][iz+range] !== undefined) continue;
                    let x = xStart + ix;
                    let z = zStart + iz;
                    let _y = y;
                    for(let iy = 0; iy < MAX; iy = iy > 0 ? -iy : 1 - iy){
                        let block = dimension.getBlock(new Vector(x, _y + iy, z));
                        if(block !== undefined && 
                            (block.typeId === "minecraft:melon_stem" || block.typeId === "minecraft:pumpkin_stem")){
                            // 找到瓜蒂
                            if(block.permutation.getState("growth") === 7){
                                let location = block.location;
                                try{ // 极端情况下女仆可能在可操作范围的边缘
                                    switch(block.permutation.getState("facing_direction")){
                                        case 2:{
                                            location.z--;
                                            this.place(dimension, location);
                                            count++;
                                            if(iz > 0) matrix[ix+range][iz+range-1] = true;
                                            y = _y;
                                        }; break;
                                        case 3: {
                                            location.z++;
                                            this.place(dimension, location);
                                            count++;
                                            if(iz < length - 1) matrix[ix+range][iz+range+1] = true;
                                            y = _y;
                                        }; break;
                                        case 4: {
                                            location.x--;
                                            this.place(dimension, location);
                                            count++;
                                            if(ix > 0) matrix[ix+range-1][iz+range] = true;
                                            y = _y;
                                        }; break;
                                        case 5: {
                                            location.x++;
                                            this.place(dimension, location);
                                            count++;
                                            if(ix < length - 1) matrix[ix+range+1][iz+range] = true;
                                            y = _y;
                                        }; break;
                                        case 0: case 1: default: break;
                                    }
                                }
                                catch{}
                            }
                            matrix[ix+range][iz+range] = true;
                            break;
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

// 可可豆
export class Cocoa{
    static maxLack = 3; // 进入慢扫描的连续缺目标次数
    static lackStep = 5; // 慢扫描等待步数
    static minCount = 8; // 缺目标的最大目标数
    static maxCount = 20; // 单次扫描获取的最大目标数 到达该数量则停止扫描 确定标准为一个目标实体生命周期内，女仆能收集到的最大目标数
    /**
     * 放置目标, 位置通常为整数方块坐标
     * @param {Dimension} dimension 
     * @param {Vector} location 
     * @param {number} direction 
     */
    static place(dimension, location, direction){
        // 若该位置已经有目标，则不放置
        let entities = dimension.getEntitiesAtBlockLocation(location);
        for(let entity of entities){
            if(entity.typeId === "thlmt:cocoa"){
                return;
            }
        }
        // 放置目标
        dimension.spawnEntity("thlmt:cocoa", 
            new Vector(location.x + 0.5, location.y + 0.5, location.z + 0.5))
            .setProperty("thlmt:direction", direction);
    }
    /**
     * 收集和放置可可豆
     * 进行两次攻击后才会将可可豆破坏
     * 破坏后0.5秒消耗背包内的可可豆补种并清除目标，若没有则不补
     * @param {Entity} target
     * @param {Entity} maid 
     */
    static acquire(target, maid){
        const neededStep = 2;
        let block = target.dimension.getBlock(target.location);
        if(block !== undefined && block.typeId === "minecraft:cocoa"){
            // 进行两次攻击后才会将可可豆破坏
            let step = target.getProperty("thlmt:step") + 1;
            if(step >= neededStep){
                const l = block.location;
                block.dimension.runCommand(`setblock ${l.x} ${l.y} ${l.z} air destroy`);
            }
            target.setProperty("thlmt:step", step);
            target.triggerEvent("life");
        }
        else{
            // 目标方块已消失，补种
            if(block.typeId === "minecraft:air"){
                // 消耗
                if(EntityMaid.Inventory.removeItem_type(maid, "minecraft:cocoa_beans", 1) === true){
                    // 放置
                    let direction = target.getProperty("thlmt:direction");
                    const l = block.location;
                    block.dimension.runCommand(`setblock ${l.x} ${l.y} ${l.z} cocoa ["direction"=${direction},"age"=0] keep`);
                }
            }
            // 清除目标
            target.triggerEvent("despawn");
        }
    }
    /**
     * 因为不能穿墙攻击 使用脚本定时获取目标
     * 竖直方向最大高度差为5格
     * 事件每3秒触发一次
     * @param {Entity} maid 
     */
    static stepEvent(maid){
        for(let i = 0; i < 3; i++){
            system.runTimeout(()=>{
                try{
                    if(maid === undefined) return;
                    let target = maid.target;
                    if(target !== undefined){
                        if(pointInArea_3D(
                                target.location.x, target.location.y, target.location.z,
                                maid.location.x - 2, maid.location.y - 5, maid.location.z - 2,
                                maid.location.x + 2, maid.location.y + 5, maid.location.z + 2
                            )){
                            this.acquire(target, maid);
                        }
                    }
                }
                catch{}
            }, i*20);
        }
    }
    /**
     * 寻找可可豆，整列寻找，每列最多5个
     * @param {Entity} maid 
     * @param {number} range
     * @returns {object} 
     */
    static search(maid, range=6){
        ///// 需求判断 /////
        const dimension = maid.dimension;
        const location = maid.location;
        let existedTargets = dimension.getEntities({
            "location": location, "maxDistance": range, "type": "thlmt:cocoa"});
        if(existedTargets.length > 3) return;

        ///// 频率调整 /////
        if(!SpeedController.beforeSearch(maid, this.maxLack, this.lackStep)) return;

        /** setblock -121 -60 16 cocoa ["direction"=3,"age"=2]
         * 寻找成熟（"age"=2）的可可豆(cocoa)，并生成带有方向标记（direction）的目标
         */
        let xStart = Math.floor(location.x);
        let zStart = Math.floor(location.z);
        let y = Math.floor(location.y);
        let count = 0;
        for(let ix = 0; ix < range; ix = ix>0 ? -ix : 1-ix){
            system.runTimeout(()=>{
                for(let iz = 0; iz < range; iz = iz>0 ? -iz : 1-iz){
                    if(count > this.maxCount) return;
                    let x = xStart + ix;
                    let z = zStart + iz;
                    let _y = y;
                    for(let iy = 4; iy > -2; iy--){
                        let block = dimension.getBlock(new Vector(x, _y + iy, z));
                        if(block !== undefined && block.typeId === "minecraft:cocoa" && block.permutation.getState("age") === 2){
                            this.place(dimension, block.location, block.permutation.getState("direction"))
                            count++;
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