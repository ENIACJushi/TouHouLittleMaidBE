import { WorldInitializeBeforeEvent } from "@minecraft/server";

export class StatuesBlock{
    /**
     * @param {WorldInitializeBeforeEvent} event 
     */
    static registerCC(event){
        event.blockTypeRegistry.registerCustomComponent("tlm:statues", {
            onPlayerDestroy(e){
                const l = e.block.location;
                e.dimension.runCommand(
                    `execute positioned ${l.x} ${l.y} ${l.z} run event entity @e[family=thlm:statues,r=8] thlmm:u`
                )
            }
        })
    }
}