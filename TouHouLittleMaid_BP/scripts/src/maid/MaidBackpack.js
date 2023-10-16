import { system, Entity,world,Vector,Dimension,Container } from "@minecraft/server";
import { config } from '../../data/config'

export class MaidBackpack{
    static default = 0;
    static small   = 1;
    static middle  = 2;
    static big     = 3;
    static NameList = [
        "default",
        "small",
        "middle",
        "big"
    ]
    // 区块加载器, config.Maid.death_bag 为false时启用
    static loader = {
        // 区块加载器的实体id
        id: undefined,
        /**
         * 初始化, 放在世界生成事件后
         */
        init(){
            if(config.Maid.death_bag === false){
                var intervalID = system.runInterval(()=>{
                    let players = world.getAllPlayers()
                    let playerAmount = players.length;
                    if(playerAmount > 0){
                        if(this.get() === undefined){
                            // 生成加载器
                            for(let pl of players){
                                if(pl.dimension.id === "minecraft:overworld"){
                                    let entity = pl.dimension.spawnEntity("thlm:chunk_loader",
                                        new Vector(pl.location.x, -64, pl.location.z));
                                    entity.nameTag = "THLM_loader";
                                    this.id = entity.id;
                                    system.clearRun(intervalID);
                                    return;
                                }
                            }
                        }
                        else{
                            system.clearRun(intervalID);
                        }
                    }
                }, 10);
            }
        },
        /**
         * 获取区块加载器
         * @returns {Entity}
         */
        get(){
            if(this.id === undefined){
                let results = world.getDimension("overworld").getEntities({type: "thlm:chunk_loader"});
                if(results.length > 0){
                    this.id = results[0].id;
                    return results[0];
                }
                return undefined;
            }
            else{
                let result = world.getEntity(this.id);
                if(result === undefined){
                    this.id = undefined;
                    return this.get();
                }
                return result;
            }
        }
    }

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
            "touhou_little_maid:maid_backpack", location
        );
        
        // 设置大小
        backpack.triggerEvent(`api:${this.type2Name(type)}`);
        
        // 设置默认状态
        backpack.triggerEvent(`emoji:0`); // 表情0
        backpack.triggerEvent(`api:hide`);// 隐藏

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
    /**
     * 获取表情
     * @param {Entity} backpack
     */
    static getEmoji(backpack){
        let component = backpack.getComponent("skin_id");
        if(component === undefined){
            return undefined;
        }
        return component.value;
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
    /**
     * 缩减碰撞箱以隐藏
     * @param {Entity} backpack
     */
    static hide(backpack){
        backpack.triggerEvent("api:hide");
    }
    /**
     * 增大碰撞箱以展示
     * @param {Entity} backpack
     */
    static show(backpack){
        backpack.triggerEvent("api:show");
    }
    /**
     * 设置表情
     * TODO: value不是read-only，看看能不能直接设
     * @param {Entity} backpack
     */
    static setEmoji(backpack, emoji){
        let old = this.getEmoji(backpack);
        if(old !== undefined){
            backpack.triggerEvent(`emoji_quit:${emoji}`);
        }
        backpack.triggerEvent(`emoji:${emoji}`);

    }
}