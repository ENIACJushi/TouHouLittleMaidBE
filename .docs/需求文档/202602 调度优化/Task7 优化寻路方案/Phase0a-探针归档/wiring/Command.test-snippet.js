/**
 * 测试函数：转发 TestCommandRegister（block_probe_* 等）
 * 复测时可将 unknown 提示改回 block_probe_help；tryInvoke 通道一般已常驻。
 * @param {ScriptEventCommandMessageAfterEvent} event
 */
static test(event){
    let pl = event.sourceEntity;
    if (pl === undefined) {
        Logger.info(TAG, "test: no sourceEntity");
        return;
    }
    if (testCommandRegister.tryInvoke(event.message, pl)) {
        return;
    }
    Logger.info(TAG, `test unmatched message="${event.message}"`);
    if (typeof pl.sendMessage === "function") {
        pl.sendMessage(`[Command.test] unknown: "${event.message}" (try block_probe_help)`);
    }
}
