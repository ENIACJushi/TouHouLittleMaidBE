// @ts-nocheck
import { Entity, Dimension, system } from "@minecraft/server";
import { Vector } from "../../libs/VectorMC";
import { SpeedController } from "./SpeedController";

/**
 * 西瓜、南瓜
 */
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
