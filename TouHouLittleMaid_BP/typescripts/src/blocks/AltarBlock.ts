import { StartupEvent } from "@minecraft/server";

export class AltarBlock {
  static registerCC(event: StartupEvent) {
    event.blockComponentRegistry.registerCustomComponent("tlm:altar", {
      onPlayerBreak(e) {
        const l = e.block.location;
        e.dimension.runCommand(
          `execute positioned ${l.x} ${l.y} ${l.z} run function touhou_little_maid/altar_destroy`
        );
      },
      onPlayerInteract(e) { }
    })
  }
}