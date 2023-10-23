
export class MaidSkin{
    static SkinList = [
        {"name": "touhou_little_maid", "index": 0, "length": 120}
    ]

    /**
     * 注册皮肤包
     * @param {string} name 皮肤包命名空间
     * @param {number} index 皮肤包编号
     * @param {number} length 数量
     * @returns {boolean} 已存在同名或同序号皮肤包时返回false
     */
    static register(name, index, length){
        for(let pack of this.SkinList){
            if(name === pack["name"] || index === pack["index"])
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
     * @param {string} name 
     * @param {object}
     */
    static getPackDisplayName(name){
        return {translate: `pack.${name}.maid.name`}
    }
    /** 
     * 由展示顺序获取皮肤包的所有数据
     * @param {number} index 展示顺序
     * @returns {object}
    */
    static getPack(index){
        return this.SkinList[index]
    }
    /**
     * 由ID获取皮肤包的所有数据
     * @param {number} index ID
     * @return {object|undefined}
     */
    static getPack_ID(index){
        for(let pack of this.SkinList){
            if(pack["index"] === index){
                return pack;
            }
        }
        return undefined;
    }
    /**
     * 获取皮肤的显示名称（translate）
     * @param {string} name 皮肤包名称
     * @param {number} index 皮肤在皮肤包内的顺序
     * @param {object}
     */
    static getSkinDisplayName(name, index){
        return {translate: `model.${name}.${index}.name`}
    }
    /**
     * 获取作者
     * @param {string} name 
     * @returns {object}
     */
    static getAuthors(name){
        return {translate: `pack.${name}.maid.authors`}
    }
    static length(){
        return this.SkinList.length
    }
}