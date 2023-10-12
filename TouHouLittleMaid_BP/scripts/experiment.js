import { world, system, Enchantment, ItemEnchantsComponent } from "@minecraft/server"
import * as Tool from"./src/libs/scarletToolKit";

export default class experiment {
    static main(){
        // Entity Events
        // world.afterEvents.projectileHit.subscribe(event =>{
        //     try{
        //         Tool.showEntityComponents(event.getEntityHit().entity);
        //     }
        //     catch{}
        // })
        
        // 获取方块属性
        world.afterEvents.itemUseOn.subscribe(event=>{
            Tool.testBlockInfo(event.source.dimension, event.block.location);
        });
        // 显示玩家属性
        world.afterEvents.playerBreakBlock.subscribe(event =>{
            try{
                Tool.showEntityComponents(event.player);
            }
            catch{}
        });
    }
}