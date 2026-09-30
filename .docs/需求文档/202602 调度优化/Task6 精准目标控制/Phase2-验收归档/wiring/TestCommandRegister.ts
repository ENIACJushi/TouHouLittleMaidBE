import { Entity, system } from "@minecraft/server";

/**
 * 测试子命令注册表：供 thlm:test 的 message 全匹配分发。
 * 使用场景：BulletTest / SeekTest 等；由 CommandManager.test 调用 tryInvoke。
 */
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
   * 可选：独立订阅（与 Command 转发并存时会触发两次，默认勿开）
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
