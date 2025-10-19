import { Entity, ItemReleaseUseAfterEvent, ItemStack, ItemStartUseAfterEvent, StartupEvent } from "@minecraft/server";
import { SakuraLaser } from "../danmaku/patterns/SakuraLaser";
import { ItemTool } from "../libs/ScarletToolKit";

export class GoheiCherry {
  /**
  * 初始化樱之御币的自定义属性
  */
  static registerCC(event: StartupEvent) {
    event.itemComponentRegistry.registerCustomComponent('tlm:gohei_cherry', {
      onUse(useEvent) {
        let pl = useEvent.source;
        ItemTool.damageMainHandStack(pl);
        GoheiCherry.shoot(pl);
      }
    });
  }

  static shoot(entity: Entity, item?: ItemStack) {
    let direction = entity.getViewDirection();
    let location = entity.getHeadLocation();

    SakuraLaser.shoot(entity, location, direction, 9, 3, 3);
  }
}
