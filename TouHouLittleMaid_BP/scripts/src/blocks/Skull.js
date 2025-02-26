import { WorldInitializeBeforeEvent } from "@minecraft/server";
import { logger } from "../libs/ScarletToolKit";
export class Skull {
    /**
     * @param {WorldInitializeBeforeEvent} event
     */
    static registerCC(event) {
        event.blockComponentRegistry.registerCustomComponent("tlm:skull", {
            onPlace(e) {
                if (e.block.permutation.getState("minecraft:block_face") === "down") {
                    e.block.setPermutation(e.block.permutation.withState("thlm:is_down", true));
                }
            }
        });
    }
}
//# sourceMappingURL=Skull.js.map