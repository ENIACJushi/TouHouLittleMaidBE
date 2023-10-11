import { Entity,world,Vector,Dimension,Container } from "@minecraft/server";


export class MaidBag{
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
     * @param {MaidBag} type
     * @param {Dimension} dimension 
     * @param {Vector} location
     * @returns {Entity}
     */
    static create(maid, type, dimension, location){
        // 创建背包
        let bag = dimension.spawnEntity(
            "touhou_little_maid:maid_backpack",location
        );
        
        // 设置大小
        bag.triggerEvent(`api:${this.type2Name(type)}`);
        
        // 添加标签
        if(maid!==undefined){
            bag.addTag(`thlmb:${maid.id}`);
            maid.addTag(`thlmb:${bag.id}`);
        }
        return bag;
    }

    ///// GET /////
    /**
     * 获取背包名称
     * @param {Entity} bag
     * @return {string}
     */
    static getName(type){
        return this.type2Name(this.getType(bag));
    }
    /**
     * 获取背包类型
     * @param {Entity} bag
     * @return {MaidBag}
     */
    static getType(bag){
        return bag.getComponent("skin_id").value;
    }
    /**
     * 由类型获取名称
     * @param {MaidBag} type
     * @return {string}
     */
    static type2Name(type){
        return this.NameList[type];
    }
    /**
     * 获取背包的container对象
     * @param {Entity} bag 
     * @returns {Container}
     */
    static getContainer(bag){
        return bag.getComponent("inventory").container;
    }
    ///// SET /////
    /**
     * 设置类型
     * @param {Entity} bag 
     * @param {MaidBag} type
     * @returns {boolean}
     */
    static setType(bag, type){
        let type_old = this.getType(bag);
        if(type_old !== type){
            bag.triggerEvent(`api:quit_${this.type2Name(type_old)}`);
            bag.triggerEvent(`api:${this.type2Name(type)}`);
            return true;
        }
        return false;
    }
    /**
     * 设置不可见
     * @param {Entity} bag 
     * @param {boolean} status 
     */
    static setInvisible(bag, status){
        if(status){
            bag.triggerEvent("api:invisible");
        }
        else{
            bag.triggerEvent("api:quit_invisible");
        }
    }
    /**
     * 将背包1的物品复制到背包2
     * 背包2的容量必须大于或等于背包1，否则返回false
     * @param {Entity} bag1 
     * @param {Entity} bag2 
     * @returns {boolean}
     */
    static copy(bag1, bag2){
        let c1 = this.getContainer(bag1);
        let c2 = this.getContainer(bag2);
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
     * @param {Entity} bag 
     */
    static clear(bag){
        this.getContainer(bag).clearAll();
    }
}