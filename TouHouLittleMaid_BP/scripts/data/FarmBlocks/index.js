import { ItemStack } from "@minecraft/server";
import { Data as Vallina } from "./Vallina";
import { logger } from "../../src/libs/ScarletToolKit";

var checkList = [Vallina]

export const farmBlocks = new FarmBlocks();

class FarmBlocks{
    Data = {
        crops:{}, // 作物
        seeds:{}, // 种子
        lands:{}  // 耕地（根据种子自动生成）
    }
    constructor(){
        for(let addonData of checkList){
            try{
                new ItemStack(addonData.tester, 1);
                logger("添加了一个模组" + addonData.tester);
        
                for(let crop in addonData.crops){
                    this.addCrop(crop, addonData.crops[crop]);
                }
                for(let seed in addonData.seeds){
                    this.addSeed(seed, addonData.seeds[seed]);
                }
            }
            catch{}
        }
    }
    
    // 添加作物信息
    addCrop(key, value){
        this.Data.crops[key] = value;
    }
    
    // 添加种子信息
    addSeed(key, value){
        this.Data.seeds[key] = value;
        // 耕地
        for(let land of value.land){
            if(this.Data.lands[land] === undefined) this.Data.lands[land] = [];
            this.Data.lands[land].push(key);
        }
    }

    /**
     * 获取作物信息
     * @param {string} name 
     * @returns {{state:object; seed: string}}}
     */
    getCorp(name){
        return this.Data.crops[name];
    }

    /**
     * 获取种子信息
     * @param {string} name
     * @returns {{block:string; state:object; land: string[]}}}
     */
    getSeed(name){
        return this.Data.seeds[name];
    }

    /**
     * 获取耕地能种植的种子列表
     * @param {string} name 
     * @returns {string[]}
     */
    getLand(name){
        return this.Data.lands[name]
    }
}
