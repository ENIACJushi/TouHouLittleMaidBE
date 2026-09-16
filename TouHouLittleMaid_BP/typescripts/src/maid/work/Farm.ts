// @ts-nocheck
import { Entity, Dimension, system, BlockPermutation, BlockVolume } from "@minecraft/server";
import { Vector } from "../../libs/VectorMC";
import { EntityMaid } from "../EntityMaid";
import { FarmBlocks } from "../../../data/FarmBlocks/main";
import { SpeedController } from "./SpeedController";

/**
 * 耕地作物 thlmt:farm
 */
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
            let seedInfos = FarmBlocks.getInstance().getSeed(seedName);
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
                        FarmBlocks.getInstance().getLand()
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
                let corpInfo = FarmBlocks.getInstance().getCorp(type);
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
                let seedList = FarmBlocks.getInstance().getLand(landBlock.typeId);
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
            let info = FarmBlocks.getInstance().getCorp(cropName);
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
    static search(maid, _range=6, force=false){
        // 已经有目标时不需要扫描
        if(maid.target !== undefined) {
            return; 
        }
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
        if(!force && !temp.run) {
            return;
        }
        if(temp.lackmode) {
            range = range + 10; // 若进入了慢扫描模式，则增大扫描范围
        }

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
                        if(FarmBlocks.getInstance().getLand(block.typeId) !== undefined){
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
                        let corpInfo = FarmBlocks.getInstance().getCorp(block.typeId);
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
                        if(FarmBlocks.getInstance().getLand(block.typeId) !== undefined){
                            // 是耕地，在上方放置种植标记
                            if(upAir) Farm.placeSeed(dimension, new Vector(x, A-i+1, z));
                            count++;
                            break;
                        }

                        // 作物判断
                        let corpInfo = FarmBlocks.getInstance().getCorp(block.typeId);
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
                let blockVolume = new BlockVolume(
                    new Vector(location.x + ix, location.y-2, location.z - range),
                    new Vector(location.x + ix + 1, location.y+2, location.z + range)
                );
                let lands = dimension.getBlocks(
                    blockVolume,
                    {
                        "includePermutations": FarmBlocks.getInstance().getCorpPermutations(),
                        "includeTypes": FarmBlocks.getInstance().getLands()
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
                    if(FarmBlocks.getInstance().getLand(block.typeId) !== undefined){
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
                    let corpInfo = FarmBlocks.getInstance().getCorp(block.typeId);
                    if(corpInfo !== undefined){
                        // 是作物，判断是否成熟
                        let mature = true;
                        for(let key in corpInfo.state){
                            if(block.permutation.getState(key) !== corpInfo.state[key]){
                                // console.info('not mature, exit')
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
