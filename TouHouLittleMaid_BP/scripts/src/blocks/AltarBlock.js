import { WorldInitializeBeforeEvent } from "@minecraft/server";

export class AltarBlock{
    /**
     * @param {WorldInitializeBeforeEvent} event 
     */
    static registerCC(event){
        event.blockComponentRegistry.registerCustomComponent("tlm:altar", {
            onPlayerDestroy(e){
                const l = e.block.location;
                e.dimension.runCommand(
                    `execute positioned ${l.x} ${l.y} ${l.z} run function touhou_little_maid/altar_destroy`
                )
            },
            onPlayerInteract(e){}
        })
    }
}