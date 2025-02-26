import { world, system } from "@minecraft/server";
import { getRandomInteger } from "../libs/ScarletToolKit";
export class MaidSkin {
    /**
     * 初始化模型包计分板
     */
    static initScoreboard() {
        var scoreboard = world.scoreboard.getObjective("thlmskin");
        if (scoreboard == null) {
            world.getDimension("overworld").runCommand("scoreboard objectives add thlmskin dummy THLMSkin");
            system.runTimeout(() => {
                scoreboard = world.scoreboard.getObjective("thlmskin");
                for (let i = 0; i < this.SkinList.length; i++) {
                    scoreboard.setScore(`${i}`, this.SkinList[i]);
                }
            }, 1);
        }
        else {
            var i = 0;
            while (true) {
                try {
                    let score = scoreboard.getScore(`${i}`);
                    if (score === undefined)
                        break;
                    this.SkinList[i] = score;
                    i++;
                }
                catch {
                    break;
                }
            }
        }
    }
    /**
     * 获取一个随机皮肤 {pack, seq}
     * @returns {object}
     */
    static getRandom() {
        // 计算总数
        let total = 0;
        for (let amount of this.SkinList) {
            total += amount;
        }
        let seqAll = getRandomInteger(0, total - 1);
        // 获取一个
        let pack = 0;
        let seq = seqAll;
        for (let amount of this.SkinList) {
            seqAll -= amount;
            if (seqAll < 1) {
                break;
            }
            seq = seqAll;
            pack++;
        }
        if (pack > this.DEFAULTAMOUNT)
            pack += 100;
        return { pack: pack, seq: seq };
    }
    /**
     * 设置皮肤列表，使用重置-追加模式，从1开始
     * @param {number[]} list
     */
    static setSkin(list) {
        // 更新缓存
        this.SkinList = [this.SkinList[0]].concat(list);
        // 更新计分板
        world.getDimension("overworld").runCommand("scoreboard objectives remove thlmskin");
        system.runTimeout(() => {
            this.initScoreboard();
        }, 2);
    }
    /**
     * 注册皮肤包
     * @param {string} name 皮肤包命名空间
     * @param {number} index 皮肤包编号
     * @param {number} length 数量
     * @returns {boolean} 已存在同名或同序号皮肤包时返回false
     */
    static register(name, index, length) {
        for (let pack of this.SkinList) {
            if (name === pack["name"] || index === pack["index"])
                return false;
            this.SkinList.push({
                "name": name,
                "index": index,
                "length": length
            });
            //TODO: 计分板存储
            return true;
        }
    }
    /**
     * 获取皮肤包的显示名称（translate）
     * @param {number} id
     * @param {object}
     */
    static getPackDisplayName(id) {
        return { translate: `maid_pack.${id}.name` };
    }
    /**
     * 获取皮肤包的描述
     * @param {number} id
     */
    static getPackDesc(id) {
        return { translate: `maid_pack.${id}.desc` };
    }
    /**
     * 获取皮肤包的图标
     * @param {number} id
     * @return {string} 图标路径
     */
    static getPackIcon(id) {
        return `textures/thlm/pack_pack_${id}.png`;
    }
    /**
     * 由展示顺序获取皮肤包的所有数据
     * @param {number} index 展示顺序
     * @returns {object}
    */
    static getPack(index) {
        return this.SkinList[index];
    }
    /**
     * 由ID获取皮肤包的所有数据
     * @param {number} index ID
     * @return {object|undefined}
     */
    static getPack_ID(index) {
        for (let pack of this.SkinList) {
            if (pack["index"] === index) {
                return pack;
            }
        }
        return undefined;
    }
    /**
     * 获取皮肤的显示名称（translate）
     * @param {number} id 皮肤包序号
     * @param {number} index 皮肤在皮肤包内的顺序
     * @param {object}
     */
    static getSkinDisplayName(id, index) {
        return { translate: `model.${id}.${index}.name` };
    }
    /**
     * 输入 translate文本（`model.${id}.${index}.name`）， 获取皮肤信息
     * @param {String} translate
     * @returns {{ pack: number; index: number; }}
     */
    static decodeName(translate) {
        let str = translate.split('.');
        return {
            pack: Number(str[1]),
            index: Number(str[2])
        };
    }
    /**
     * 获取作者
     * @param {number} id
     * @returns {object}
     */
    static getAuthors(id) {
        return { translate: `maid_pack.${id}.authors` };
    }
    static length() {
        return this.SkinList.length;
    }
    /**
     * 获取模型包的模型数量
     * @param {number} packId
     */
    static getSkinAmount(packId) {
        if (packId > this.DEFAULTAMOUNT) {
            return this.SkinList[packId - 100];
        }
        else {
            return this.SkinList[packId];
        }
    }
}
MaidSkin.DEFAULTAMOUNT = 1; // 默认模型包数量
MaidSkin.PLACEHOLDER = 100; // 最大默认模型包预留序号
MaidSkin.SkinList = [
    120
];
//# sourceMappingURL=MaidSkin.js.map