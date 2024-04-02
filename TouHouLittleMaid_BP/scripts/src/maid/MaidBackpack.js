import { system, Entity,world,Vector,Dimension,Container, ItemStack } from "@minecraft/server";
import { config } from "../controller/Config"
import * as Tool from "../libs/ScarletToolKit"
import { EntityMaid } from "./EntityMaid";
import * as Tag from "../libs/TagDataInterface"

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
    static capacityList = [6, 12, 24, 36]
    static nameTags = [
        "§t§h§l§m§d",
        "§t§h§l§m§s",
        "§t§h§l§m§m",
        "§t§h§l§m§b"
    ]
    // 区块加载器, config.Maid.death_bag 为false时启用
    static loader = {
        // 区块加载器的实体id
        id: undefined,
        /**
         * 初始化, 放在世界生成事件后
         */
        init(){
            // if(config["maid_death_bag"] === false){
            //     var intervalID = system.runInterval(()=>{
            //         let players = world.getAllPlayers()
            //         let playerAmount = players.length;
            //         if(playerAmount > 0){
            //             if(this.get() === undefined){
            //                 // 生成加载器
            //                 for(let pl of players){
            //                     if(pl.dimension.id === "minecraft:overworld"){
            //                         let entity = pl.dimension.spawnEntity("thlm:chunk_loader",
            //                             new Vector(pl.location.x, -64, pl.location.z));
            //                         entity.nameTag = "THLM_loader";
            //                         this.id = entity.id;
            //                         system.clearRun(intervalID);
            //                         return;
            //                     }
            //                 }
            //             }
            //             else{
            //                 system.clearRun(intervalID);
            //             }
            //         }
            //     }, 10);
            // }
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
     * 在指定位置生成一个指定女仆的背包
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
        backpack.nameTag = this.nameTags[type];

        // 设置默认状态
        backpack.triggerEvent(`api:hide`);// 隐藏

        // 设置关系
        if(maid!==undefined){
            MaidBackpack.setMaidID(backpack, maid.id);
            let ownerID = EntityMaid.Owner.getID(maid);
            if(ownerID !== undefined){
                MaidBackpack.setOwnerID(backpack, ownerID);
            }

            EntityMaid.Backpack.setID(maid, backpack.id);
        }
        return backpack;
    }
    /**
     * 在指定位置将背包释放
     * @param {Entity} backpack 
     * @param {Vector} location 
     */
    static dump(backpack, location){
        // 释放包内物品
        let dimension = backpack.dimension;
        let container = this.getContainer(backpack);
        for(let i = 0; i < container.size; i++){
            let item = container.getItem(i)
            if(item !== undefined){
                dimension.spawnItem(item.clone(), location);
                container.setItem(i);
            }
        }
        // 生成背包物品
        let backpackItem = this.type2ItemName(this.getType(backpack))
        if(backpackItem !== undefined){
            dimension.spawnItem(new ItemStack(backpackItem, 1), location);
        }
        // 删除背包
        backpack.triggerEvent("despawn");
    }
    ///// GET /////
    /**
     * 获取背包名称
     * @param {Entity} backpack
     * @return {string}
     */
    static getName(backpack){
        return this.type2Name(this.getType(backpack));
    }
    /**
     * 获取背包类型
     * @param {Entity} backpack
     * @return {MaidBackpack}
     */
    static getType(backpack){
        return backpack.getComponent("variant").value;
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
     * 获取主人生物id
     * @param {Entity} backpack 
     * @returns {string|undefined}
     */
    static getOwnerID(backpack){
        return Tag.get(backpack, "thlmo:");
    }
    /**
     * 获取女仆生物id
     * @param {Entity} backpack 
     * @returns {string|undefined}
     */
    static getMaidID(backpack){
        return Tag.get(backpack, "thlmm:");
    }
    /**
     * 获取女仆实体
     * @param {Entity} backpack 
     * @returns {Entity|undefined}
     */
    static getMaid(backpack){
        let maidID = this.getMaidID(backpack);
        if(maidID !== undefined){
            return world.getEntity(maidID);
        }
        return undefined;
    }
    
    /**
     * 获取类型对应物品的名称
     * @param {string} type
     * @returns {string|undefined}
     */
    static type2ItemName(type){
        if(type === this.default) return undefined;
        return `touhou_little_maid:maid_backpack_${this.type2Name(type)}`;
    }

    /**
     * 获取按钮名称
     */
    static getButtonLang(invisible){
        return invisible?"gui.touhou_little_maid:button.backpack.true.name":"gui.touhou_little_maid:button.backpack.false.name"
    }

    /**
     * 获取按钮图像
     */
    static getButtonImg(invisible){
        return invisible?"textures/gui/maid_backpack_deactivate.png":"textures/gui/maid_backpack_activate.png"
    }
    ///// SET /////
    /**
     * 设置类型 女仆自身容器的类型也会随之转换
     * @param {Entity} backpack 
     * @param {MaidBackpack} type
     * @returns {boolean}
     */
    static setType(backpack, type){
        let type_old = this.getType(backpack);
        if(type_old !== type){
            // 改变背包类型
            backpack.triggerEvent(`api:quit_${this.type2Name(type_old)}`);
            backpack.triggerEvent(`api:${this.type2Name(type)}`);
            backpack.nameTag = this.nameTags[type];
            // 改变女仆的背包类型
            let maid = this.getMaid(backpack);
            if(maid !== undefined){
                maid.triggerEvent(`api:backpack_${this.type2Name(type)}`);
            }
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
        let maid = this.getMaid(backpack);
        if(status){
            backpack.triggerEvent("api:invisible");
            if(maid !== undefined){
                maid.triggerEvent(`api:backpack_invisible`);
            }
        }
        else{
            backpack.triggerEvent("api:quit_invisible");
            if(maid !== undefined){
                maid.triggerEvent(`api:backpack_quit_invisible`);
            }
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
     * 设置主人ID
     * @param {Entity} backpack 
     * @param {string} id 
     */
    static setOwnerID(backpack, id){
        Tag.set(backpack, "thlmo:", id);
    }
    /**
     * 设置女仆ID
     * @param {Entity} backpack 
     * @param {string} id 
     */
    static setMaidID(backpack, id){
        Tag.set(backpack, "thlmm:", id);
    }
}