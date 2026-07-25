import { ScriptEventCommandMessageAfterEvent, system } from "@minecraft/server";
import { CommandManager } from "../controller/Command";

/**
 * 世界级脚本事件等（自定义组件注册已移至 registerCustomComponents.ts）
 */
export class WorldEvents {
  public registerAllEvents () {
    system.afterEvents.scriptEventReceive.subscribe(event => {
      system.run(() => { this.thlmScriptEventReceive(event); })
    }, { namespaces: ["thlm"] });
  }

  // 脚本事件：THLM
  private thlmScriptEventReceive(event: ScriptEventCommandMessageAfterEvent) {
    CommandManager.scriptEvent(event);
  }
}
