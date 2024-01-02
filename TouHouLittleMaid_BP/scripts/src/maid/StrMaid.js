/**
 * 字符串化的女仆信息
 * 格式 OoooHhhhhSssssMm
 */
/**
 * 测试代码
    let info = ""
    info = StrMaid.Owner.setID(info, "-4294967256");
    info = StrMaid.Health.set(info, 9961, 65535)
    info = StrMaid.Skin.set(info, 0, 10);
    info = StrMaid.Work.set(info, 6);
    info = StrMaid.backpackInvisibility.set(info, true);

    Tool.logger(info);
    Tool.logger(`OwnerID:${StrMaid.Owner.getId(info)}`);
    let health = StrMaid.Health.get(info);
    Tool.logger(`Health:${health.current},${health.max}`);
    let skin = StrMaid.Skin.get(info);
    Tool.logger(`Skin:${skin.pack},${skin.index}`);
    Tool.logger(`Work:${StrMaid.Work.get(info)}`);
    Tool.logger(`backpackInvisibility:${StrMaid.backpackInvisibility.get(info)}`);
 */

import * as Tool from "../libs/scarletToolKit"

export class StrMaid{
    // 主人 O
    static Owner = {
        /**
         * 获取字符串包含的主人ID
         * @param {string} maidStr
         * @returns {string|undefined} Owner ID
         */
        getId(maidStr){
            let str = StrHelper.getValue(maidStr, 'O', 5);
            if(str===undefined) return undefined;
            return `-${StrHelper.str2ID(str)}`;
        },
        /**
         * 为字符串设置主人ID
         * @param {string} maidStr
         * @param {string} Owner ID
         * @returns {string} New Maid String
         */
        setID(maidStr, ownerID){
            let numID = parseInt(ownerID.slice(1));
            let strID = StrHelper.ID2str(numID);
            return StrHelper.setValue(maidStr, 'O', strID);
        }
    }
    // 生命值 H 左2当前值 右2最大值
    static Health = {
        /**
         * 获取生命值 
         * @param {string} maidStr
         * @returns {object|undefined} {current:1, max:1}
         */
        get(maidStr){
            let str = StrHelper.getValue(maidStr, 'H', 4);
            if(str === undefined) return undefined;
            return {
                current: StrHelper.str2int(str.slice(0, 2)),
                max: StrHelper.str2int(str.slice(2, 4))
            }
        },
        /**
         * 设置生命值 当前值和最大值需要同时设定
         * @param {string} maidStr
         * @param {number} current
         * @param {number} max
         * @returns {string} New Maid String
         */
        set(maidStr, current, max){
            let str = StrHelper.int2str(current) + StrHelper.int2str(max)
            return StrHelper.setValue(maidStr, 'H', str);
        }
    }
    // 皮肤 S左2包 右2索引
    static Skin = {
        /**
         * 获取皮肤
         * @param {string} maidStr
         * @returns {object|undefined} {pack:1, index:1}
         */
        get(maidStr){
            let str = StrHelper.getValue(maidStr, 'S', 4);
            if(str === undefined) return undefined;
            return {
                pack: StrHelper.str2int(str.slice(0, 2)),
                index: StrHelper.str2int(str.slice(2, 4))
            }
        },
        /**
         * 设置生命值 当前值和最大值需要同时设定
         * @param {string} maidStr
         * @param {number} pack
         * @param {number} index
         * @returns {string} New Maid String
         */
        set(maidStr, pack, index){
            let str = StrHelper.int2str(pack) + StrHelper.int2str(index)
            return StrHelper.setValue(maidStr, 'S', str);
        }
    }
    // 工作模式 W
    static Work = {
        /**
         * 获取工作模式
         * @param {string} maidStr
         * @returns {number|undefined}
         */
        get(maidStr){
            let str = StrHelper.getValue(maidStr, 'W', 2);
            if(str === undefined) return undefined;
            return StrHelper.str2int(str.slice(0, 2));
        },
        /**
         * 设置工作模式
         * @param {string} maidStr
         * @param {number} index
         * @returns {string} New Maid String
         */
        set(maidStr, index){
            let str = StrHelper.int2str(index);
            return StrHelper.setValue(maidStr, 'W', str);
        }
    }
    // 背包是否隐藏 B
    static backpackInvisibility = {
        /**
         * 获取是否隐藏
         * @param {string} maidStr
         * @returns {boolean|undefined}
         */
        get(maidStr){
            let str = StrHelper.getValue(maidStr, 'B', 1);
            if(str === undefined) return undefined;
            return StrHelper.str2bool(str);
        },
        /**
         * 设置是否隐藏
         * @param {string} maidStr
         * @param {boolean} value
         * @returns {string} New Maid String
         */
        set(maidStr, value){
            let str = StrHelper.bool2str(value);
            return StrHelper.setValue(maidStr, 'B', str);
        }
    }
}

class StrHelper{
    /**
     * 由key搜索值
     * @param {string} str 
     * @param {Char} key 键名
     * @param {number} length 数据长度
     * @returns {undefined|string} 字符表示的数据
     */
    static getValue(str, key, length){
        let start = str.search(key);
        if(start === -1) return undefined;
        return str.slice(start+1, start+1+length);
    }
    /**
     * 由key value设置值
     * 值不存在则新建
     * @param {string} str 
     * @param {Char} key 键名
     * @param {string} value 键名
     * @returns {undefined|string} 修改后的字符串
     */
    static setValue(str, key, value){
        let start = str.search(key);
        if(start === -1){
            return str + key + value;
        }
        else{
            return str.slice(0, start) + key + value + str.slice(start+1+value.length);
        }
        
    }


    /// 整数压缩
    /**
     * 将短整型转为两位字符
     * 为了避开特殊字符，选定特定范围的字符作为存储用字符
     * @param {Int16} num 短整型
     * @returns {string} 两位字符
     */
    static int2str(num){
        let high8 = Math.floor(num / 0x100)
        let low8 = num % 0x100
        return String.fromCodePoint(0xA000 + high8) + String.fromCodePoint(0xA000 + low8);
    }
    /**
     * 将两位字符转为短整型
     * @param {string} str 两位字符
     * @returns {Int16} 短整型
     */
    static str2int(str){
        let high8 = str.charCodeAt(0) - 0xA000
        let low8 = str.charCodeAt(1) - 0xA000
        return high8*0x100 + low8;
    }
    /**
     * 将正整数转为 5 位字符
     * @param {Int} num 位正整数
     * @returns {string} 5 位字符
     */
    static ID2str(num){
        let low1_12  = num % 0x1000;
        let low2_12  = Math.floor(num % 0x1000000       / 0x1000      );
        let mid_12   = Math.floor(num % 0x1000000000    / 0x1000000   );
        let high1_12 = Math.floor(num % 0x1000000000000 / 0x1000000000);
        let high2_5  = Math.floor(num / 0x1000000000000);
        return String.fromCodePoint(0xA000 + high2_5)
             + String.fromCodePoint(0xA000 + high1_12)
             + String.fromCodePoint(0xA000 + mid_12)
             + String.fromCodePoint(0xA000 + low2_12)
             + String.fromCodePoint(0xA000 + low1_12);
    }
    /**
     * 将 5 位字符转为正整数
     * @param {string} str 5 位字符
     * @returns {Int} 正整数
     */
    static str2ID(str){
        let high2_5  = str.charCodeAt(0) - 0xA000
        let high1_12 = str.charCodeAt(1) - 0xA000
        let mid_12   = str.charCodeAt(2) - 0xA000
        let low2_12  = str.charCodeAt(3) - 0xA000
        let low1_12  = str.charCodeAt(4) - 0xA000
        return high2_5 *0x1000000000000
             + high1_12*0x1000000000
             + mid_12  *0x1000000
             + low2_12 *0x1000
             + low1_12;
    }
    // 布尔转换
    static str2bool(str){
        if(str===0) return false;
        return true;
    }
    static bool2str(value){
        return value?1:0;
    }
}