import { ItemStack } from "@minecraft/server";
import { Data as Vallina } from "./Vallina";
import { logger } from "../../src/libs/ScarletToolKit";

let checkList = [Vallina]

export var Data = {
    crops:{}, // 作物
    seeds:{}, // 种子
    lands:{}  // 耕地（根据种子自动生成）
}

function addCrop(key, value){
    Data.crops[key] = value;
}

function addSeed(key, value){
    Data.seeds[key] = value;
    // 耕地
    for(let land of value.land){
        if(Data.lands[land] === undefined) Data.lands[land] = [];
        Data.lands[land].push(key);
    }
}
// Object.assign(Data.blocks, Vallina.blocks);
// Object.assign(Data.seeds, Vallina.seeds);

for(let addonData of checkList){
    try{
        new ItemStack(addonData.tester, 1);
        logger("添加了一个模组" + addonData.tester);

        for(let crop in addonData.crops){
            addCrop(crop, addonData.crops[crop]);
        }
        for(let seed in addonData.seeds){
            addCrop(seed, addonData.seeds[seed]);
        }
    }
    catch{}
}
