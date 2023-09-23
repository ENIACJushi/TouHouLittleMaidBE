import { world, system, Enchantment, ItemEnchantsComponent } from "@minecraft/server"
import * as Tool from"./libs/scarletToolKit";

export default class experiment {
    static main(){
        // Entity Events
        // world.afterEvents.projectileHit.subscribe(event =>{
        //     try{
        //         Tool.showEntityComponents(event.getEntityHit().entity);
        //     }
        //     catch{}
        // })
        world.afterEvents.blockBreak.subscribe(event =>{
            try{
                Tool.showEntityComponents(event.player);
            }
            catch{}
        })
    }
}