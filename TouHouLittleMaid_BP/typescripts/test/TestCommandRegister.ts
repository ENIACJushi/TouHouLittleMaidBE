import { Entity, system } from "@minecraft/server";

/**
 * 测试子命令回调：message 首词为命令，其余为空格分隔参数。
 * 使用场景：`thlm:test path_gap_try 3 0` 等带参调试。
 */
export type TestCommandCallback = (source: Entity, args: string[]) => void;

/**
 * 测试子命令注册表：供 thlm:test 分发（首词匹配 + 参数数组）。
 * 使用场景：BulletTest / PathFollow 等。
 */
class TestCommandRegister {
  callbackMap: Map<string, TestCommandCallback> = new Map();

  /**
   * 注册测试子命令（按 message 首词匹配）。
   */
  register(key: string, callback: TestCommandCallback) {
    this.callbackMap.set(key, callback);
  }

  /**
   * 供 CommandManager.thlm:test 转发；命中则执行并返回 true。
   */
  tryInvoke(message: string, source: Entity): boolean {
    const parts = (message ?? "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return false;
    }
    const key = parts[0];
    const args = parts.slice(1);
    const cb = this.callbackMap.get(key);
    if (!cb) {
      return false;
    }
    cb(source, args);
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
