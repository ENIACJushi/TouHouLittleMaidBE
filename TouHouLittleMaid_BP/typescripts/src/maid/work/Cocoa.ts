// @ts-nocheck
import { Entity, Dimension, system } from "@minecraft/server";
import { Vector } from "../../libs/VectorMC";
import { EntityMaid } from "../EntityMaid";
import { SpeedController } from "./SpeedController";

/**
 * 可可豆
 */
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
