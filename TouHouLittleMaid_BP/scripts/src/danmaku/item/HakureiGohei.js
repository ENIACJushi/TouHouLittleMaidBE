import {DanmakuType}   from "../DanmakuType";
import { ItemStack, ItemUseOnBeforeEvent, EnchantmentTypes, WorldInitializeBeforeEvent} from "@minecraft/server";
import { logger } from '../../libs/ScarletToolKit'
export class HakureiGohei {
    /**
    * 初始化御币的自定义属性
    * @param {WorldInitializeBeforeEvent} event 
    */
    static registerCC(event){
        event.itemComponentRegistry.registerCustomComponent('tlm:hakurei_gohei', {
            onUse (useEvent) {
                logger('onUse')
                
            },
            onCompleteUse (useEvent) {
                logger('onCompleteUse')
            },
            
        });
    }
}