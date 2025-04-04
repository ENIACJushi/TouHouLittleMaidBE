import { StartupEvent } from "@minecraft/server";

export class StatuesBlock{
    /**
     * @param {StartupEvent} event 
     */
    static registerCC(event){
        event.blockComponentRegistry.registerCustomComponent("tlm:statues", {
            onPlayerDestroy(e){
                const l = e.block.location;
                e.dimension.runCommand(
                    `execute positioned ${l.x} ${l.y} ${l.z} run event entity @e[family=thlm:statues,r=8] thlmm:u`
                )
            }
        })
    }
}