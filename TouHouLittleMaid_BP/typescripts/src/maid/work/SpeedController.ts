// @ts-nocheck
import { Entity } from "@minecraft/server";

/**
 * 扫描速度控制
 */
export class SpeedController{
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
