import { StartupEvent } from "@minecraft/server";

export class StatuesBlock {
  static registerCC(event: StartupEvent) {
    event.blockComponentRegistry.registerCustomComponent("tlm:statues", {
      onPlayerBreak(e) {
        const l = e.block.location;
        e.dimension.runCommand(
          `execute positioned ${l.x} ${l.y} ${l.z} run event entity @e[family=thlm:statues,r=8] thlmm:u`
        );
      }
    })
  }
}