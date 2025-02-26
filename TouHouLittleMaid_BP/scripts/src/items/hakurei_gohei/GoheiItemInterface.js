import { ItemStack, system, world } from "@minecraft/server";
import { logger } from "../../libs/ScarletToolKit";
const MODE_PROPERTY_KEY = 'tlm_hg:mode';
const TIME_PROPERTY_KEY = 'tlm_hg:time';
const GOHEI_TYPE_ID = 'touhou_little_maid:hakurei_gohei_v2';
export class GoheiMode {
}
GoheiMode.Amulet = 0;
GoheiMode.Heart = 1;
export class GoheiItemInterface {
    /**
     * 物品是不是御币
     * @param {ItemStack} itemStack
     */
    static isGohei(itemStack) {
        if (!itemStack) {
            return false;
        }
        return itemStack.typeId === GOHEI_TYPE_ID;
    }
    /**
     * 获取模式id
     * @param {ItemStack} itemStack
     * @returns {number}
     */
    static getMode(itemStack) {
        let res = itemStack.getDynamicProperty(MODE_PROPERTY_KEY);
        if (res === undefined) {
            return 0;
        }
        return res;
    }
    /**
     * 设置模式id
     * @param {ItemStack} itemStack
     * @param {number} mode
     */
    static setMode(itemStack, mode) {
        itemStack.setDynamicProperty(MODE_PROPERTY_KEY, mode);
    }
    /**
     * 获取物品开始使用的时间戳，第二个参数为空时设为当前时间
     * 设置回玩家主手才能生效
     * @param {ItemStack} itemStack
     * @param {number | undefined} time (ms)
     * @returns {number}
     */
    static setStartUseTime(itemStack, time) {
        let res = time ?? new Date().getTime();
        itemStack.setDynamicProperty(TIME_PROPERTY_KEY, res);
        return res;
    }
    /**
     * 获取物品开始使用的时间，第二个参数为空时设为当前时间
     * @param {ItemStack} itemStack
     */
    static getStartUseTime(itemStack) {
        return itemStack.getDynamicProperty(TIME_PROPERTY_KEY) ?? 0;
    }
    /**
     * 获取物品使用时长
     * @param {ItemStack} itemStack
     * @returns {number}
     */
    static getUseTime(itemStack) {
        let start = itemStack.getDynamicProperty(TIME_PROPERTY_KEY);
        if (start) {
            return world.getAbsoluteTime() - start;
        }
        this.setStartUseTime(itemStack);
        return 0;
    }
}
//# sourceMappingURL=GoheiItemInterface.js.map