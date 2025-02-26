import { Entity, ItemStack, WorldInitializeBeforeEvent } from "@minecraft/server";
import { shoot } from "../danmaku/patterns/Cherry";
import { ItemTool, logger } from "../libs/ScarletToolKit";
export class GoheiCherry {
    /**
    * 初始化樱之御币的自定义属性
    * @param {WorldInitializeBeforeEvent} event
    */
    static registerCC(event) {
        event.itemComponentRegistry.registerCustomComponent('tlm:gohei_cherry', {
            onUse(useEvent) {
                let pl = useEvent.source;
                ItemTool.damageMainHandStack(pl);
                GoheiCherry.shoot(pl);
            }
        });
    }
    /**
     * @param {Entity} entity
     * @param {ItemStack} item
     */
    static shoot(entity, item) {
        let direction = entity.getViewDirection();
        let location = entity.getHeadLocation();
        shoot(entity, location, direction, 9, 3, 3);
    }
}
//# sourceMappingURL=GoheiCherry.js.map