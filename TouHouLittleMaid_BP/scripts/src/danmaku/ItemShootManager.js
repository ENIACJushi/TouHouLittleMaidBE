export class ItemShootManager {
    constructor() {
        this.map = new Map();
    }
    register(id, shoot) {
        this.map.set(id, shoot);
    }
    /**
     * 吓我一跳释放符卡
     * @param {ItemUseBeforeEvent} event
     */
    itemShootEvent(event) {
        let item = event.itemStack;
        let player = event.source;
        let group_function = this.map.get(item.typeId);
        let cooldown = item.getComponent("minecraft:cooldown");
        if (cooldown) {
            let remain = cooldown.getCooldownTicksRemaining(player);
            if (cooldown.cooldownTicks - remain > 1) {
                return false;
            }
        }
        if (group_function !== undefined) {
            group_function(player, item);
            return true;
        }
        return false;
    }
}
export const itemShootManager = new ItemShootManager();
//# sourceMappingURL=ItemShootManager.js.map