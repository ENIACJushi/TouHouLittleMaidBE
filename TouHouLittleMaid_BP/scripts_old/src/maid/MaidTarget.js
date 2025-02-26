import { EntityHitEntityAfterEvent, Entity, Dimension, system, BlockPermutation, BlockVolume } from "@minecraft/server";
import { Vector } from "../libs/VectorMC";
import { EntityMaid } from "./EntityMaid";
import { logger, pointInArea_3D } from "../libs/ScarletToolKit";
import { farmBlocks } from "../../data/FarmBlocks/index";



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
     * 寻找目标点
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
            case EntityMaid.Work.farm: Farm.search(maid, range); break;
            case EntityMaid.Work.sugar_cane: SugarCane.search(maid, range); break;
            case EntityMaid.Work.melon: Melon.search(maid, range); break;
            case EntityMaid.Work.cocoa: Cocoa.search(maid, range); break;
            default: break;
        }
    }
    /**
     * 因为不能穿墙攻击 使用脚本定时获取目标
     * 竖直方向最大高度差为5格
     * 事件每3秒触发一次
     * @param {Entity} maid 
     * @param {number} work 
     */
    static stepEvent(maid, work){
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
                            switch(work){
                                case EntityMaid.Work.farm:  Farm.acquire(target, maid); break;
                                case EntityMaid.Work.melon: Melon.acquire(target, maid); break;
                                case EntityMaid.Work.cocoa: Cocoa.acquire(target, maid); break;
                                default: break;
                            }
                        }
                        target.triggerEvent("cooldown");
                    }
                }
                catch{}
            }, i*20);
        }
    }
}

// 扫描速度控制
class SpeedController{
    /**
     * 搜索开始前 判断是否进行搜索
     * @param {Entity} maid 
     * @param {number} [maxLack=2] 进入慢扫描状态需要的缺目标步数
     * @param {number} [lackStep=5] 慢扫描时，每LACKSTEP次调用函数才进行一次扫描
     * @param {{run: boolean; lackmode: boolean}}
     */
    static beforeSearch(maid, maxLack=2, lackStep=5){
        // 速度控制
        let lackCount = maid.getDynamicProperty("target_lack");
        if(lackCount !== undefined && lackCount >= maxLack){
            lackCount++;
            if(lackCount >= maxLack + lackStep){
                maid.setDynamicProperty("target_lack", maxLack);
                return {run: true, lackmode: true};
            }
            else{
                maid.setDynamicProperty("target_lack", lackCount);
                return {run: false, lackmode: true};
            }
        }
        return {run: true, lackmode: false};
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

// 耕地作物 thlmt:farm
export class Farm{
    static maxLack  = 2; // 进入慢扫描的连续缺目标次数
    static lackStep = 5; // 慢扫描等待步数
    static minCount = 8; // 缺目标的最大目标数
    static maxCount = 25; // 单次扫描获取的最大目标数 到达该数量则停止扫描 确定标准为一个目标实体生命周期内，女仆能收集到的最大目标数
    /**
     * 放置收获目标, 位置应为整数方块坐标
     * @param {Dimension} dimension 
     * @param {Vector} location 
     * @returns {Entity}
     */
    static placeCorp(dimension, location){
        // 若该位置已经有目标，则不放置
        let entities = dimension.getEntitiesAtBlockLocation(location);
        for(let entity of entities){
            if(entity.typeId === "thlmt:farm"){
                return;
            }
        }
        // 放置目标
        let target = dimension.spawnEntity("thlmt:farm", 
            new Vector(location.x + 0.5, location.y + 0.2, location.z + 0.5));
        target.setDynamicProperty("is_seed", false);
        return target;
    }
    /**
     * 放置种植目标, 位置应为整数方块坐标
     * @param {Dimension} dimension
     * @param {Vector} location
     * @returns {Entity}
     */
    static placeSeed(dimension, location){
        // 若该位置已经有目标，则不放置
        let entities = dimension.getEntitiesAtBlockLocation(location);
        for(let entity of entities){
            if(entity.typeId === "thlmt:farm"){
                return;
            }
        }
        // 放置目标
        let target = dimension.spawnEntity("thlmt:farm", 
            new Vector(location.x + 0.5, location.y + 0.2, location.z + 0.5));
        target.setDynamicProperty("is_seed", true);
        return target;
    }
    /**
     * 给定种子名称，种植一个作物
     * @param {Entity} maid
     * @param {Vector} location
     * @param {string} seedName
     * @param {string} landName
     * @returns 
     */
    static plantSeed(maid, location, seedName, landName){
        if(EntityMaid.Backpack.removeItem_type(maid, seedName, 1) === true){
            let seedInfos = farmBlocks.getSeed(seedName);
            if(seedInfos !== undefined){
                for(let seedInfo of seedInfos){
                    if(seedInfo.land.includes(landName)){
                        maid.dimension.setBlockPermutation(location, 
                            BlockPermutation.resolve(seedInfo.block, seedInfo.state));
                        return true;
                    }
                }
            }
        }
        return false;
    }
    /**
     * 收集/种植作物
     * @param {Entity} target 
     * @param {Entity} maid 
     */
    static acquire(target, maid){
        let location = target.location;
        const dimension = target.dimension;

        let selfBlock = dimension.getBlock(location);
        let landBlock = dimension.getBlock(new Vector(location.x, location.y-1, location.z));
        
        if(target.getDynamicProperty("is_seed") === true){
            ///// 种植 /////
            // 地块已经有作物了，退出
            if(selfBlock !== undefined && selfBlock.typeId !== "minecraft:air"){
                target.triggerEvent("despawn");
                return;
            }
            
            let type = target.getDynamicProperty("crop");
            let replant = false;

            if(type === undefined){
                // 未指定类型 检查四个相邻方块的类型
                let names = {};
                for(let delta of [[-1,0],[1,0],[0,-1],[0,1]]){
                    let block = dimension.getBlock(new Vector(location.x + delta[0], location.y, location.z + delta[1]));
                    if(block !== undefined){
                        if(names[block.typeId] === undefined) names[block.typeId] = 1;
                        else names[block.typeId] ++;
                    }
                }
                let max = 0;
                for(let key in names){
                    if(names[key] > max){
                        // 是否能种在方块上
                        farmBlocks.getLand()
                        type = key;
                        max = names[key];
                    }
                }
            }
            else{
                replant = true;
            }

            // 种植（规定类型）
            if(type !== undefined){
                let corpInfo = farmBlocks.getCorp(type);
                if(corpInfo !== undefined){
                    if(this.plantSeed(maid, location, corpInfo.seed, landBlock.typeId)){
                        target.triggerEvent("despawn");
                        return;
                    }
                }
            }

            // 补种失败，进入冷却
            if(replant){
                if(!target.getProperty("thlmt:cooldown")){
                    target.triggerEvent("despawn"); // 进入30秒的攻击冷却
                    // 必须新建一个，否则仇恨无法消除
                    let newTarget = dimension.spawnEntity("thlmt:farm", location);
                    newTarget.setDynamicProperty("is_seed", true);
                    newTarget.setDynamicProperty("crop", type);
                    newTarget.triggerEvent("cooldown");
                    return;
                }
            }

            // 种植（规定类型的执行失败 -> 尝试不规定类型）
            if(landBlock !== undefined && landBlock.typeId !== "minecraft:air"){
                let seedList = farmBlocks.getLand(landBlock.typeId);
                if(seedList !== undefined){
                    for(let seed of seedList){
                        if(this.plantSeed(maid, location, seed, landBlock.typeId)){
                            target.triggerEvent("despawn");
                            return;
                        }
                    }
                }
            }
            target.triggerEvent("despawn");
        }
        else{
            ///// 收获 ///// 
            // 被收获的方块应该是成熟的作物
            let cropName = selfBlock.typeId;
            let info = farmBlocks.getCorp(cropName);
            if(info!==undefined && selfBlock.permutation.matches(cropName, info.state)){
                if(info.keep===undefined){
                    dimension.runCommand(`setblock ${location.x} ${location.y} ${location.z} air destroy`);
                    // 目标点转为补种
                    target.triggerEvent("life");
                    target.setDynamicProperty("is_seed", true);
                    target.setDynamicProperty("crop", cropName);
                }
                else{
                    target.runCommand(`loot spawn ~~~ loot "${info.keep.loot}"`);
                    dimension.setBlockPermutation(target.location, BlockPermutation.resolve(info.keep.block, info.keep.state));
                    // 不需要补种
                    target.triggerEvent("despawn");
                }
            }
            else{
                target.triggerEvent("despawn");
            }
        }
    }
    /**
     * 
     * @param {Dimension} dimension 
     * @param {Vector} location 
     * @param {Number} range 
     * @returns {Entity[]}
     */
    static getTargets(dimension, location, range){
        let existedTargets = dimension.getEntities({
            "location": location, "maxDistance": range, "type": "thlmt:farm"});

        // 限高
        let targetList = [];
        for(let target of existedTargets){
            let delta = target.location.y - location.y;
            if(delta < 2 || delta > -2){
                targetList.push(target);
            }
        }
        return targetList;
    }
    /**
     * 寻找作物
     * @param {Entity} maid
     * @param {number} range
     * @returns {object} 
     */
    static search(maid, _range=6){
        if(maid.target!==undefined) return; // 已经有目标，不需要扫描
        ///// 需求判断 /////
        const dimension = maid.dimension;
        const location = maid.location;
        /**
         * 获取范围（扩张后）内已经标定的点
         * 若附近目标数少于6则开始扫描
         */
        let targets = this.getTargets(dimension, location, _range + 10);
        if(targets.length > 6) return;

        ///// 频率调整 /////
        let range = _range;
        let temp = SpeedController.beforeSearch(maid, this.maxLack, this.lackStep);
        if(!temp.run) return;
        if(temp.lackmode) range = range + 10; // 若进入了慢扫描模式，则增大扫描范围

        ///// 搜索 /////
        /**
         * 一般来说，耕地的起伏不会太大，设女仆位置的高度为 y，搜索 y-2 ~ y+2 就足够了，即5格高，对应面积 166 的 2D 区域，边长大约为 13
         * 
         * 搜索顺序：0  1  2  -1  -2
         * 
         * 如果先找到作物，就判断生长阶段是否符合要求，不符合就直接跳过
         * 如果先找到耕地，当查找方向为向下(-1/-2)，直接跳过，若为向上，则自行向上搜索一格，然后跳过
         * 
         * 耕地作物通常种植在同一高度，所以搜索开始的高度设为上一次成功查找的高度
         * 
         * 无论是标记耕地还是作物，目标点总是会放在作物应该在的位置
         */
        let y = Math.floor(location.y);
        let xStart = Math.floor(location.x);
        let zStart = Math.floor(location.z);
        let count = targets.length;
        function* searchJob(){
            for(let ix = 0; ix < range; ix = ix > 0 ? -ix : 1-ix){
                for(let iz = 0; iz < range; iz = iz > 0 ? -iz : 1-iz){
                    if(count > Farm.maxCount) break;

                    let x = xStart + ix;
                    let z = zStart + iz;
                    let A = y; // A A+1 A+2 A-1 A-2
                    let upAir = false; // 上方方块是否为空气，用在向下搜索的判断中

                    // 向上搜索
                    for(let i = 0; i <= 2; i++){
                        let block = dimension.getBlock(new Vector(x, A+i, z));

                        // 是空气，跳过
                        if(block === undefined || block.typeId === "minecraft:air"){
                            if(i===0) upAir = true;
                            continue;
                        }

                        // 耕地判断
                        if(farmBlocks.getLand(block.typeId) !== undefined){
                            // 是耕地，找上方一格
                            y = A+i;
                            let block = dimension.getBlock(new Vector(x, A+i+1, z));
                            if(block === undefined || block.typeId === "minecraft:air"){
                                // 上方一格为空，放置种植标记
                                Farm.placeSeed(dimension, new Vector(x, A+i+1, z));
                                count++;
                                break;
                            }
                            // 上方一格不为空，进行作物判断
                            block = dimension.getBlock(new Vector(x, A+i+1, z));
                        }

                        // 作物判断
                        let corpInfo = farmBlocks.getCorp(block.typeId);
                        if(corpInfo !== undefined){
                            // 是作物，判断是否成熟（无论成不成熟都结束扫描）
                            let mature = true;
                            for(let key in corpInfo.state){
                                if(block.permutation.getState(key) !== corpInfo.state[key]){
                                    mature = false;
                                    break;
                                }
                            }

                            if(mature){
                                // 已成熟，放置收获标记
                                Farm.placeCorp(dimension, new Vector(x, A+i, z));
                                count++;
                            }
                            break;
                        }

                        // 都不是，继续找
                    }

                    // 向下搜索
                    for(let i = 1; i <= 2; i++){
                        let block = dimension.getBlock(new Vector(x, A-i, z));
                        // 是空气，跳过
                        if(block === undefined || block.typeId === "minecraft:air"){
                            upAir = true;
                            continue;
                        }

                        // 耕地判断
                        if(farmBlocks.getLand(block.typeId) !== undefined){
                            // 是耕地，在上方放置种植标记
                            if(upAir) Farm.placeSeed(dimension, new Vector(x, A-i+1, z));
                            count++;
                            break;
                        }

                        // 作物判断
                        let corpInfo = farmBlocks.getCorp(block.typeId);
                        if(corpInfo !== undefined){
                            // 是作物，判断是否成熟（无论成不成熟都结束扫描）
                            let mature = true;
                            for(let key in corpInfo.state){
                                if(block.permutation.getState(key) !== corpInfo.state[key]){
                                    mature = false;
                                    break;
                                }
                            }

                            if(mature){
                                // 已成熟，放置收获标记
                                Farm.placeCorp(dimension, new Vector(x, A-i, z));
                                count++;
                            }
                            break;
                        }
                    }

                    yield;
                }
                if(count > Farm.maxCount) break;
            }
            ///// 频率调整 /////
            SpeedController.afterSearch(maid, count, Farm.maxLack, Farm.minCount);
        }
        function* newSearchJob(){
            let areaLength = range*2+2;
            let searchMatrix = new Array(areaLength);
            for(let i = 0; i < areaLength; i++){
                searchMatrix[i] = new Array(areaLength).fill(false)
            }
            
            for(let target of targets){
                searchMatrix[Math.floor(target.location.x - location.x + range) + 1][Math.floor(target.location.z - location.z + range) + 1] = true;
            }
            for(let ix = 0; ix < range; ix = ix > 0 ? -ix : 2-ix){
                // 获取作物方块
                let lands = dimension.getBlocks(
                    new BlockVolume(
                        new Vector(location.x + ix, location.y-2, location.z - range),
                        new Vector(location.x + ix + 1, location.y+2, location.z + range)
                    ),
                    {
                        "includePermutations": farmBlocks.getCorpPermutations(),
                        "includeTypes": farmBlocks.getLands()
                    },
                    true
                );
                for(let pos of lands.getBlockLocationIterator()){
                    let m_x = Math.floor(pos.x - location.x + range) + 1;
                    let m_z = Math.floor(pos.z - location.z + range) + 1;
                    if(searchMatrix[m_x][m_z] === true){
                        continue;
                    }

                    let block = dimension.getBlock(pos);
                    // 耕地判断
                    if(farmBlocks.getLand(block.typeId) !== undefined){
                        // 检查上方方块
                        let blockLocation = new Vector(pos.x, pos.y+1, pos.z);
                        block = dimension.getBlock(blockLocation);
                        if(block === undefined || block.typeId === "minecraft:air"){
                            // 上方一格为空，放置种植标记
                            Farm.placeSeed(dimension, blockLocation);
                            searchMatrix[m_x][m_z] = true;
                            count++;
                            continue;
                        }
                    }

                    // 作物判断
                    let corpInfo = farmBlocks.getCorp(block.typeId);
                    if(corpInfo !== undefined){
                        // 是作物，判断是否成熟
                        
                        let mature = true;
                        for(let key in corpInfo.state){
                            if(block.permutation.getState(key) !== corpInfo.state[key]){
                                mature = false;
                                break;
                            }
                        }

                        if(mature){
                            // 已成熟，放置收获标记
                            Farm.placeCorp(dimension, block.location);
                            count++;
                        }
                        searchMatrix[m_x][m_z] = true;// 无论成不成熟都结束这个坐标的判断
                        continue;
                    }

                }
                if(count > Farm.maxCount) break;
                // yield;
            }
            SpeedController.afterSearch(maid, count, Farm.maxLack, Farm.minCount);
        }
        system.runJob(newSearchJob());
        

    }
}

// 甘蔗
class SugarCane{
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
     * 寻找瓜类
     * @param {Entity} maid 
     * @param {number} range
     * @returns {object} 
     */
    static search(maid, _range=6){
        ///// 需求判断 /////
        const dimension = maid.dimension;
        const location = maid.location;
        let existedTargets = dimension.getEntities({
            "location": location, "maxDistance": _range, "type": "thlmt:melon"});
        if(existedTargets.length > 3) return;
        
        
        ///// 频率调整 /////
        let range = _range;
        let temp = SpeedController.beforeSearch(maid, this.maxLack, this.lackStep);
        if(!temp.run) return;
        if(temp.lackmode) range = range + 10; // 若进入了慢扫描模式，则增大扫描范围

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
                if(EntityMaid.Backpack.removeItem_type(maid, "minecraft:cocoa_beans", 1) === true){
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
     * 寻找可可豆，整列寻找，每列最多5个
     * @param {Entity} maid 
     * @param {number} range
     * @returns {object} 
     */
    static search(maid, _range=6){
        ///// 需求判断 /////
        const dimension = maid.dimension;
        const location = maid.location;
        let existedTargets = dimension.getEntities({
            "location": location, "maxDistance": _range, "type": "thlmt:cocoa"});
        if(existedTargets.length > 3) return;

        ///// 频率调整 /////
        let range = _range;
        let temp = SpeedController.beforeSearch(maid, this.maxLack, this.lackStep);
        if(!temp.run) return;
        if(temp.lackmode) range = range + 10; // 若进入了慢扫描模式，则增大扫描范围

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