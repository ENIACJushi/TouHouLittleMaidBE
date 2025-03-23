import { spellCardList } from "../../data/spellcard/CustomSpellCardEntry";
export class CustomSpellCardManger {
    /**
    * 初始化樱之御币的自定义属性
    */
    static registerCC(event) {
        event.itemComponentRegistry.registerCustomComponent('tlm:spell_card', {
            onUse(useEvent) {
                CustomSpellCardManger.onSpellCardUseEvent(useEvent);
            }
        });
    }
    /**
     * 吓我一跳释放符卡
     */
    static onSpellCardUseEvent(event) {
        var _a;
        let item = event.itemStack;
        let player = event.source;
        for (let spellCard of spellCardList) {
            if (spellCard["id"] == (item === null || item === void 0 ? void 0 : item.typeId)) {
                spellCard.spellCard(player.dimension, player);
                (_a = item.getComponent("cooldown")) === null || _a === void 0 ? void 0 : _a.startCooldown(player);
                return true;
            }
        }
        return false;
    }
}
//# sourceMappingURL=CustomSpellCardManger.js.map