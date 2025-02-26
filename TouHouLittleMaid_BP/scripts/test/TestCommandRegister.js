import { system } from "@minecraft/server";
import { logger } from "../src/libs/ScarletToolKit";
class TestCommandRegister {
    constructor() {
        this.callbackMap = new Map();
    }
    /**
     * 注册一个函数
     * @param key
     * @param callback
     */
    register(key, callback) {
        this.callbackMap.set(key, callback);
    }
    registerScriptEvent() {
        system.afterEvents.scriptEventReceive.subscribe(event => {
            logger('register script event');
            system.run(() => {
                if (event.id === 'thlm:test' && event.sourceEntity) {
                    this.callbackMap.get(event.message)?.(event.sourceEntity);
                }
            });
        }, { namespaces: ["thlm"] });
    }
}
export const testCommandRegister = new TestCommandRegister();
//# sourceMappingURL=TestCommandRegister.js.map