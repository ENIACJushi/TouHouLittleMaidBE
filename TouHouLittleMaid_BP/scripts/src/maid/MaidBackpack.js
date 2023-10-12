import { Entity,world,Vector,Dimension,Container } from "@minecraft/server";


export class MaidBackpack{
    static default = 0;
    static small   = 1;
    static medium  = 2;
    static big     = 3;
    static NameList = [
        "default",
        "small",
        "medium",
        "big"
    ]
    
    /**
     * 在指定位置生成一个背包
     * @param {Entity|undefined} maid 
     * @param {MaidBackpack} type
     * @param {Dimension} dimension 
     * @param {Vector} location
     * @returns {Entity}
     */
    static create(maid, type, dimension, location){
        // 创建背包
        let backpack = dimension.spawnEntity(
            "touhou_little_maid:maid_backpack",location
        );
        
        // 设置大小
        backpack.triggerEvent(`api:${this.type2Name(type)}`);
        
        // 添加标签
        if(maid!==undefined){
            backpack.addTag(`thlmb:${maid.id}`);
            maid.addTag(`thlmb:${backpack.id}`);
        }
        return backpack;
    }

    ///// GET /////
    /**
     * 获取背包名称
     * @param {Entity} backpack
     * @return {string}
     */
    static getName(type){
        return this.type2Name(this.getType(backpack));
    }
    /**
     * 获取背包类型
     * @param {Entity} backpack
     * @return {MaidBackpack}
     */
    static getType(backpack){
        return backpack.getComponent("skin_id").value;
    }
    /**
     * 由类型获取名称
     * @param {MaidBackpack} type
     * @return {string}
     */
    static type2Name(type){
        return this.NameList[type];
    }
    /**
     * 获取背包的container对象
     * @param {Entity} backpack 
     * @returns {Container}
     */
    static getContainer(backpack){
        return backpack.getComponent("inventory").container;
    }
    ///// SET /////
    /**
     * 设置类型
     * @param {Entity} backpack 
     * @param {MaidBackpack} type
     * @returns {boolean}
     */
    static setType(backpack, type){
        let type_old = this.getType(backpack);
        if(type_old !== type){
            backpack.triggerEvent(`api:quit_${this.type2Name(type_old)}`);
            backpack.triggerEvent(`api:${this.type2Name(type)}`);
            return true;
        }
        return false;
    }
    /**
     * 设置不可见
     * @param {Entity} backpack 
     * @param {boolean} status 
     */
    static setInvisible(backpack, status){
        if(status){
            backpack.triggerEvent("api:invisible");
        }
        else{
            backpack.triggerEvent("api:quit_invisible");
        }
    }
    /**
     * 将背包1的物品复制到背包2
     * 背包2的容量必须大于或等于背包1，否则返回false
     * @param {Entity} backpack1 
     * @param {Entity} backpack2 
     * @returns {boolean}
     */
    static copy(backpack1, backpack2){
        let c1 = this.getContainer(backpack1);
        let c2 = this.getContainer(backpack2);
        if(c1.size <= c2.size){
            for(let i = 0; i<c1.size; i++){
                // 将c1的物品移到c2
                c1.swapItems(i, i, c2);
            }
            return true;   
        }
        return false
    }
    /**
     * 清除背包
     * @param {Entity} backpack 
     */
    static clear(backpack){
        this.getContainer(backpack).clearAll();
    }
}