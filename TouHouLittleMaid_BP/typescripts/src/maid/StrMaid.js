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

    Logger.info(TAG, info);
    Logger.info(TAG, `OwnerID:${StrMaid.Owner.getId(info)}`);
    let health = StrMaid.Health.get(info);
    Logger.info(TAG, `Health:${health.current},${health.max}`);
    let skin = StrMaid.Skin.get(info);
    Logger.info(TAG, `Skin:${skin.pack},${skin.index}`);
    Logger.info(TAG, `Work:${StrMaid.Work.get(info)}`);
    Logger.info(TAG, `backpackInvisibility:${StrMaid.backpackInvisibility.get(info)}`);
 */

import * as Tool from "../libs/ScarletToolKit"
import { EntityMaid } from "./EntityMaid";

const TAG = 'StrMaid';

export class StrMaid {
    /**
     * 格式化输出 rawtext
     * @param {string} maidStr 
     * @returns {object}
     */
    static formatOutput(maidStr){
        let rawtext = []
        // 标题
        rawtext.push({"translate": "message.tlm.admin.item_info"});
        rawtext.push({"text":"\n"});
        // 女仆名称
        rawtext.push({"translate": "message.tlm.admin.maid.name"});
        rawtext.push({"text": `${this.Str.getMaidName(maidStr)}\n`});
        // 主人名称
        rawtext.push({"translate": "message.tlm.admin.maid.owner.name"});
        rawtext.push({"text": `${this.Str.getOwnerName(maidStr)}\n`});
        // 主人ID
        rawtext.push({"translate": "message.tlm.admin.maid.owner.id"});
        rawtext.push({"text": `${this.Owner.getId(maidStr)}\n`});
        // 等级
        rawtext.push({"translate": "message.tlm.admin.maid.level"});
        rawtext.push({"text": `${this.Level.get(maidStr)}\n`});
        // 杀敌数
        rawtext.push({"translate": "message.tlm.admin.maid.kill"});
        rawtext.push({"text": `${this.Kill.get(maidStr)}\n`});
        // 生命值
        rawtext.push({"translate": "message.tlm.admin.maid.health"});
        let health = this.Health.get(maidStr);
        rawtext.push({"text": `${health.current}/${health.max}\n`});
        // 工作模式
        rawtext.push({"translate": "message.tlm.admin.maid.work"});
        rawtext.push({"text": `${EntityMaid.Work.getName(this.Work.get(maidStr))}\n`});
        // 隐藏背包
        rawtext.push({"translate": "message.tlm.admin.maid.backpack"});
        rawtext.push({"text": `${this.backpackInvisibility.get(maidStr)}\n`});
        // 拾物模式
        rawtext.push({"translate": "message.tlm.admin.maid.pick"});
        rawtext.push({"text": `${this.Pick.get(maidStr)}\n`});
        // 静音模式
        rawtext.push({"translate": "message.tlm.admin.maid.mute"});
        rawtext.push({"text": `${this.Mute.get(maidStr)}\n`});

        return rawtext;
    }
    // L O H S W B P M N K
    // L 等级
    static Level = {
        /**
         * 获取等级
         * @param {string} maidStr
         * @returns {number|undefined}
         */
        get(maidStr){
            let str = StrHelper.getValue(maidStr, 'L', 1);
            if(str === undefined) return undefined;
            return StrHelper.str2short(str);
        },
        /**
         * 设置等级
         * @param {string} maidStr
         * @param {number} index
         * @returns {string} New Maid String
         */
        set(maidStr, index){
            let str = StrHelper.short2str(index);
            return StrHelper.setValue(maidStr, 'L', str);
        }
    }
    // K 杀敌数
    static Kill = {
        /**
         * 获取杀敌数
         * @param {string} maidStr
         * @returns {number|undefined}
         */
        get(maidStr){
            let str = StrHelper.getValue(maidStr, 'K', 2);
            if(str === undefined) return undefined;
            return StrHelper.str2int(str.slice(0, 2));
        },
        /**
         * 设置杀敌数
         * @param {string} maidStr
         * @param {number} amount
         * @returns {string} New Maid String
         */
        set(maidStr, amount){
            let str = StrHelper.int2str(amount);
            return StrHelper.setValue(maidStr, 'K', str);
        }
    }
    // O 主人生物ID 可为空
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
    // H 生命值 左2当前值 右2最大值
    static Health = {
        /**
         * 获取生命值  {current:1, max:1}
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
    // S 皮肤 左2包 右2索引
    static Skin = {
        /**
         * 获取皮肤
         * @param {string} maidStr
         * @returns {{pack:number; index:number}} {pack:1, index:1}
         */
        get(maidStr){
            let str = StrHelper.getValue(maidStr, 'S', 4);
            if (str === undefined) {
                return { pack: 0, index: 0 };
            }
            return {
                pack: StrHelper.str2int(str.slice(0, 2)),
                index: StrHelper.str2int(str.slice(2, 4))
            };
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
    // W 工作模式
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
    // B 背包是否隐藏
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
    // C 背包类型
    static backpackType = {
        /**
         * 获取背包类型
         * @param {string} maidStr
         * @returns {number|undefined}
         */
        get(maidStr){
            let str = StrHelper.getValue(maidStr, 'C', 2);
            if(str === undefined) return undefined;
            return StrHelper.str2int(str.slice(0, 2));
        },
        /**
         * 设置背包类型
         * @param {string} maidStr
         * @param {number} type
         * @returns {string} New Maid String
         */
        set(maidStr, type){
            let str = StrHelper.int2str(type);
            return StrHelper.setValue(maidStr, 'C', str);
        }
    }
    // P 拾物模式
    static Pick = {
        /**
         * 获取模式
         * @param {string} maidStr
         * @returns {boolean}
         */
        get(maidStr){
            let str = StrHelper.getValue(maidStr, 'P', 1);
            if(str === undefined) return true;
            return StrHelper.str2bool(str);
        },
        /**
         * 设置模式
         * @param {string} maidStr
         * @param {boolean} value
         * @returns {string} New Maid String
         */
        set(maidStr, value){
            let str = StrHelper.bool2str(value);
            return StrHelper.setValue(maidStr, 'P', str);
        }
    }
    // M 静音模式
    static Mute = {
        /**
         * 获取模式
         * @param {string} maidStr
         * @returns {boolean}
         */
        get(maidStr){
            let str = StrHelper.getValue(maidStr, 'M', 1);
            if(str === undefined) return false;
            return StrHelper.str2bool(str);
        },
        /**
         * 设置模式
         * @param {string} maidStr
         * @param {boolean} value
         * @returns {string} New Maid String
         */
        set(maidStr, value){
            let str = StrHelper.bool2str(value);
            return StrHelper.setValue(maidStr, 'M', str);
        }
    }
    // I 是否坐下
    static Sit = {
        /**
         * 获取模式
         * @param {string} maidStr
         * @returns {boolean}
         */
        get(maidStr){
            let str = StrHelper.getValue(maidStr, 'I', 1);
            if(str === undefined) return false;
            return StrHelper.str2bool(str);
        },
        /**
         * 设置模式
         * @param {string} maidStr
         * @param {boolean} value
         * @returns {string} New Maid String
         */
        set(maidStr, value){
            let str = StrHelper.bool2str(value);
            return StrHelper.setValue(maidStr, 'I', str);
        }
    }
    /**
     * N 字符串数据，放在最后，使用json数组格式存储： ["12",0,0]
     * 数据为空时，设为数字 0，因为只占一个字符的位置
     * 包含数据：主人名称 女仆名称
     * 当数据没有被设置时，留空
     */
    static Str = {
        //// 指定键操作 ////
        // 数据数量，向少兼容
        amount: 2,
        /**
         * 获取主人名称
         * @param {string} maidStr 
         * @returns {string | undefined}
         */
        getOwnerName(maidStr){ return this.getValue(maidStr, 0); },
        /**
         * 设置主人名称
         * @param {string} maidStr 
         * @param {string|undefined} value 
         * @returns {string}
         */
        setOwnerName(maidStr, value){
            return this.setValue(maidStr, 0, value) },
        /**
         * 获取女仆名称
         * @param {string} maidStr 
         * @returns {string | undefined}
         */
        getMaidName(maidStr){ return this.getValue(maidStr, 1); },
        /**
         * 设置女仆名称
         * @param {string} maidStr 
         * @param {string|undefined} value 
         * @returns {string}
         */
        setMaidName(maidStr, value){ return this.setValue(maidStr, 1, value) },

        //// 基础操作 ////
        /**
         * 获取所有字符串数据
         * @param {string} maidStr
         * @returns {string[]|undefined}
         */
        get(maidStr){
            try{
                let str = StrHelper.getValue(maidStr, 'N', undefined);
                if(str === undefined) return undefined;
                return JSON.parse(str);
            }
            catch{
                return undefined;
            }
        },
        /**
         * 设置所有字符串数据
         * @param {string} maidStr
         * @param {string[]} value
         * @returns {string} New Maid String
         */
        set(maidStr, value){
            try{
                return StrHelper.setValue(maidStr, 'N', JSON.stringify(value));
            }
            catch{
                return maidStr;
            }
        },
        /**
         * 设置指定位置的数据
         * @param {string} maidStr 
         * @param {number} index 
         * @param {string|undefined} value 
         * @returns {string}
         */
        setValue(maidStr, index, value){
            // 获取旧值
            let oldValue = this.get(maidStr);
            if(oldValue===undefined){
                // 不存在则新建
                oldValue = [];
                for(let i = 0; i < this.amount; i++){
                    oldValue[i] = 0;
                }
            }
            else{
                // 若数组长度比数据量小，则补齐空字符串
                for(let i = oldValue.length-1; i < this.amount; i++){
                    oldValue[i] = 0;
                }
            }

            // 设置新值
            oldValue[index] = value===undefined?0:value;
            return this.set(maidStr, oldValue);
        },
        /**
         * 获取指定位置的数据
         * @param {string} maidStr 
         * @param {number} index 
         * @returns {string|undefined}
         */
        getValue(maidStr, index){
            let allValues = this.get(maidStr);
            if(allValues === undefined){
                return undefined;
            }
            else{
                let result = allValues[index];
                return result===0?undefined:result;
            }
        }
    }
}

class StrHelper{
    /**
     * 由key搜索值
     * @param {string} str 
     * @param {Char} key 键名
     * @param {number} length 数据长度 为undefined代表一直截到末尾
     * @returns {undefined|string} 字符表示的数据
     */
    static getValue(str, key, length){
        let start = str.search(key);
        if(start === -1) return undefined;
        return str.slice(start+1, length===undefined?undefined:start+1+length);
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
        let low8 = Math.floor(num % 0x100)
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
     * 将整数(0~4,095)转为 1 位字符
     * 为了避开特殊字符，选定特定范围的字符作为存储用字符
     * @param {Int16} num 整数 0 ~ 4095
     * @returns {string} 1位字符
     */
    static short2str(num){
        return String.fromCodePoint(0xA000 + num);
    }
    /**
     * 将两位字符转为短整型
     * @param {string} str 1位字符
     * @returns {Int16} 短整型
     */
    static str2short(str){
        return str.charCodeAt(0) - 0xA000;
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
        if(str==='0') return false;
        return true;
    }
    static bool2str(value){
        return value===true?'1':'0';
    }
}