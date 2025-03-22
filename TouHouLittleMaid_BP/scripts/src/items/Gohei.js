import { ItemStack, EnchantmentTypes } from "@minecraft/server";
import { GeneralBulletType } from "../danmaku/shapes/main";
export class Gohei {
    /**
     * 激活由工作台合成的御币
     * @param {ItemUseBeforeEvent} ev
     */
    static activate(ev) {
        var _a;
        try {
            let pl = ev.source;
            if (!pl) {
                return;
            }
            let slot = pl.selectedSlotIndex;
            let container = (_a = pl.getComponent("inventory")) === null || _a === void 0 ? void 0 : _a.container;
            if (!container) {
                return;
            }
            let item = container === null || container === void 0 ? void 0 : container.getItem(slot);
            if (item && item.typeId == this.goheiPrefix + "crafting_table") {
                let itemStack = new ItemStack(this.goheiPrefix + GeneralBulletType.getName(this.goheiDefault), 1);
                let ench_list = itemStack.getComponent("minecraft:enchantable");
                if (!ench_list) {
                    return;
                }
                ench_list.addEnchantment({ type: EnchantmentTypes.get("infinity"), level: 1 });
                container.setItem(slot, itemStack);
            }
        }
        catch (_b) { }
    }
    /**
     * 切换御币弹种
     * @param ev
     * @param danmakuName 去除前缀的物品名称，如 touhou_little_maid:hakurei_gohei_crafting_table → crafting_table
     */
    static transform(ev, danmakuName) {
        var _a, _b;
        let origin_item = ev.itemStack;
        if (danmakuName === "crafting_table") {
            this.activate(ev);
        }
        else {
            for (let i = 0; i < this.goheiSequence.length; i++) {
                let name = GeneralBulletType.getName(this.goheiSequence[i]);
                if (name === danmakuName) {
                    // Get index
                    let index = i + 1;
                    if (index >= this.goheiSequence.length)
                        index = 0;
                    // Create item
                    let itemStack = new ItemStack(this.goheiPrefix + GeneralBulletType.getName(this.goheiSequence[index]), 1);
                    itemStack.getComponent("minecraft:enchantable").addEnchantments(origin_item.getComponent("minecraft:enchantable").getEnchantments());
                    itemStack.getComponent("minecraft:durability").damage = origin_item.getComponent("minecraft:durability").damage;
                    itemStack.setLore(origin_item.getLore());
                    itemStack.nameTag = origin_item.nameTag;
                    // Set item
                    let player = ev.source;
                    if (!player) {
                        return;
                    }
                    (_b = (_a = player.getComponent("inventory")) === null || _a === void 0 ? void 0 : _a.container) === null || _b === void 0 ? void 0 : _b.setItem(player.selectedSlotIndex, itemStack);
                    // Send message
                    player.sendMessage({
                        rawtext: [
                            { translate: "message.touhou_little_maid:hakurei_gohei.switch" },
                            { translate: `danmaku.${GeneralBulletType.getName(this.goheiSequence[index])}.name` }
                        ]
                    });
                }
            }
        }
    }
}
Gohei.goheiSequence = Object.freeze([
    GeneralBulletType.PELLET,
    GeneralBulletType.BALL,
    GeneralBulletType.ORBS,
    GeneralBulletType.BIG_BALL,
    GeneralBulletType.BUBBLE,
    GeneralBulletType.HEART,
    GeneralBulletType.AMULET,
    // GeneralBulletType.STAR, 用八卦炉发射
    // GeneralBulletType.BIG_STAR, 用八卦炉发射
    GeneralBulletType.GLOWEY_BALL,
]);
Gohei.goheiPrefix = "touhou_little_maid:hakurei_gohei_";
Gohei.goheiDefault = GeneralBulletType.PELLET;
//# sourceMappingURL=Gohei.js.map