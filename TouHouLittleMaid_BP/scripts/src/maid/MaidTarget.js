import { EntityHitEntityAfterEvent, Entity, Dimension, Vector } from "@minecraft/server";

class MaidTarget{
    /**
     * 标志物取得
     * @param {EntityHitEntityAfterEvent} event 
     */
    static targetAcquire(event){
        let maid = event.damagingEntity;
        let target = event.hitEntity;

        switch(target.typeId.substring(6)){
            case "sugar_cane": this.acquireSugarCane(target, maid); break;
            default: break;
        }
    }
    /**
     * 收集甘蔗
     * @param {Entity} target 
     * @param {Entity} maid 
     */
    static acquireSugarCane(target, maid){
        let block = target.dimension.getBlock(target.location);
        if(block !== undefined){
            if(block.typeId === "minecraft:sugar_cane"){
                const l = block.location;
                block.dimension.runCommand(`setblock ${l.x} ${l.y} ${l.z} air destroy`);
            }
        }
        // 无论是否成功破坏甘蔗，都清除目标
        target.triggerEvent("despawn");
    }
    /**
     * 寻找甘蔗 最多设置16个目标
     * @param {Dimension} dimension 
     * @param {Vector} location 
     * @param {number} range 
     * @param {number} height 
     */
    static searchSugarCane(dimension, location, range){
        /**
         * 获取方块耗时 0.01ms，一刻 50ms，尽量在10ms内完成搜索，即1000次查询
         * 一般来说，甘蔗地的起伏不会太大，设女仆位置的高度为 y，搜索 y-2 ~ y+3 就足够了，即6格高，对应面积 166 的 2D 区域，边长大约为 13
         * 
         * 目标方块下方的方块是甘蔗，且下下方的方块不是甘蔗
         * 为了方便搜索，匹配目标方块下方的方块，即上方是甘蔗，而下方不是甘蔗的甘蔗。
         */
        const xMax = location.x + 6;
        const zMax = location.z + 6;
        for(let x = location.x - 6; x < xMax; x++){
            for(let z = location.z - 6; z < zMax; z++){
                let y = location.y;
                // 滑动窗口搜索 s s x
                let block = dimension.getBlock({x:x, y:y, z:z});
                if(block.typeId === "minecraft:sugar_cane"){
                    let downBlock = dimension.getBlock({x:x, y:y-1, z:z});
                    if(downBlock.typeId !== "minecraft:sugar_cane"){
                        
                    }
                }
                else{

                }
            }
        }
    }
}