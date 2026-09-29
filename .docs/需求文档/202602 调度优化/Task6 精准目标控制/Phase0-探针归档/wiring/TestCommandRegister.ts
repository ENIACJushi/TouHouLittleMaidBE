import { Entity, system } from "@minecraft/server";
import { Logger } from "../src/controller/Logger";

const TAG = "TestCommandRegister";

class TestCommandRegister {
  callbackMap: Map<string, (source: Entity) => void> = new Map();

  /**
   * 注册测试子命令（message 全匹配）
   */
  register(key: string, callback: (source: Entity) => void) {
    this.callbackMap.set(key, callback);
  }

  /**
   * 供 CommandManager.thlm:test 转发；命中则执行并返回 true
   */
  tryInvoke(message: string, source: Entity): boolean {
    const key = (message ?? "").trim();
    const cb = this.callbackMap.get(key);
    if (!cb) return false;
    cb(source);
    return true;
  }

  /**
   * 可选：独立订阅（与 Command 转发并存时也会触发）
   */
  registerScriptEvent() {
    system.afterEvents.scriptEventReceive.subscribe(
      (event) => {
        system.run(() => {
          if (event.id === "thlm:test" && event.sourceEntity) {
            this.tryInvoke(event.message, event.sourceEntity);
          }
        });
      },
      { namespaces: ["thlm"] }
    );
  }
}

export const testCommandRegister = new TestCommandRegister();
