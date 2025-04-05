import { Entity, Player, system } from "@minecraft/server";
import { Logger } from "../src/controller/Logger";

class TestCommandRegister {
  callbackMap: Map<string, (source: Entity) => void> = new Map();

  /**
   * 注册一个函数
   * @param key 
   * @param callback 
   */
  register (key: string, callback: (source: Entity) => void) {
    this.callbackMap.set(key, callback);
  }
  
  registerScriptEvent () {
    system.afterEvents.scriptEventReceive.subscribe(event => {
      Logger.info('register script event')
      system.run(()=>{
        if (event.id === 'thlm:test' && event.sourceEntity) {
          this.callbackMap.get(event.message)?.(event.sourceEntity);
        }
      })
    }, {namespaces: ["thlm"]});
  }
}

export const testCommandRegister = new TestCommandRegister();