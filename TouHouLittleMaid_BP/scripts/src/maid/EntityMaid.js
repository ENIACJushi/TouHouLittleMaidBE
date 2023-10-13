import { Entity,world,Vector,Dimension,system, EntityHealthComponent, Container, ItemStack } from "@minecraft/server";
import { MaidBackpack } from "./MaidBackpack";
import * as Tool from "../libs/scarletToolKit"

export class EntityMaid{
    // 家模式
    static Home = {
        /**
         * 获取home模式
         * @param {Entity} maid 
         */
        getMode(maid){
            return maid.getComponent("minecraft:is_baby")!==undefined;
        },
        /**
         * 切换home模式
         * @param {Entity} maid
         */
        switchMode(maid){
            if(this.getMode(maid)===true){
                // 家模式 → 跟随模式
                this.clearLocation(maid);
                maid.triggerEvent("api:status_quit_home");
                maid.triggerEvent("api:status_follow");
            }
            else{
                // 跟随模式 → 家模式
                this.setLocation(maid);
                maid.triggerEvent("api:status_quit_follow");
                maid.triggerEvent("api:status_home");
            }
        },
        getImg(is_open){
            return is_open?"textures/gui/home_activate.png":"textures/gui/home_deactivate.png"
        },
        getLang(is_open){
            return is_open?"gui.touhou_little_maid:button.home.true.name":"gui.touhou_little_maid:button.home.false.name"
        },
        /**
         * 设置家为当前位置
         * @param {Entity} maid 
         */
        setLocation(maid){
            this.clearLocation(maid);
            let l = maid.location;
            maid.addTag(`thlmh:${Math.ceil(l.x)},${Math.ceil(l.y)},${Math.ceil(l.z)},${maid.dimension.id}`)
        },
        /**
         * 获取家的位置
         * @param {Entity} maid 
         * @returns {number[]|undefined}
         */
        getLocation(maid){
            for(let tag of maid.getTags()){
                if(tag.substring(0, 6) == "thlmh:"){
                    let lstring = tag.substring(6).split(",");
                    return [parseInt(lstring[0]), 
                            parseInt(lstring[1]),
                            parseInt(lstring[2]),
                            lstring[3]];
                }
            }
            return undefined;
        },
        /**
         * 清除家的位置
         * @param {Entity} maid 
         * @returns {number[]|undefined}
         */
        clearLocation(maid){
            for(let tag of maid.getTags()){
                if(tag.substring(0, 6) == "thlmh:"){
                    maid.removeTag(tag);
                }
            }
        }
    }
    // 拾物模式
    static Pick = {
        
    }
    ///// Core /////
    /**
     * 将女仆转为物品lore
     * 会自动清除背包
     * @param {Entity} maid 
     */
    static toLore(maid){
        let infos={};
        /**
         * 记录位置(取整)
         * l: location, 位置
         */
        let location = [Math.ceil(maid.location.x), Math.ceil(maid.location.y), Math.ceil(maid.location.z)]
        infos["l"]=location;

        /**
         * 记录女仆状态
         * 工作模式、家及家的位置转换成物品时会重置
         * h: health, 生命值
         * o: owner, 主人id
         * t: type, 女仆的命名空间
         */ 
        infos["h"] = maid.getComponent("health").currentValue;
        infos["t"] = maid.typeId;
        // 主人id, 可为空（野生女仆）
        let o_id = this.getOwnerID(maid);
        if(o_id !== undefined){
            infos["o"]=o_id;
        }

        /**
         * 打包背包
         * 正常情况不会为空，以防万一假设可为空
         * b: backpack,背包大小
         * bi: backpack id, 临时背包的生物id
         */ 
        let backpack_id = this.getBackpackID(maid);
        if(backpack_id !== undefined){
            let backpack = world.getEntity(backpack_id);
            if(backpack !==undefined){
                let backpack_type = backpack.getComponent("skin_id").value;
                infos["b"] = backpack_type;

                // 在地底创建新背包(隐形)
                let temp_backpack = MaidBackpack.create(undefined, backpack_type, backpack.dimension, 
                    new Vector(location[0], -63, location[2]));
                MaidBackpack.setInvisible(temp_backpack, true);
                infos["bi"] = temp_backpack.id;
                system.runTimeout(()=>{
                    // 将物品移入临时背包
                    MaidBackpack.copy(backpack, temp_backpack);
                    MaidBackpack.clear(backpack);
                    // 清除旧背包
                    backpack.triggerEvent("despawn");
                },1);
            }
        }

        /**
         * 生成物品lore
         */
        let str = JSON.stringify(infos);
        let lore =[];
        while(true){
            if(str.length > 50){
                lore.push(str.slice(0, 50));
                str = str.slice(50);
            }
            else{
                lore.push(str);
                break;
            }
        }
        return lore;
    }
    /**
     * 将lore转为女仆
     * @param {string} lore
     * @param {Dimension} dimension
     * @param {Vector} location 
     * @param {boolean} [set_health=false]
     * @returns {Entity|undefined} maid
     */
    static fromLore(lore, dimension, location, set_health=false){
        /**
         * 解析lore
         */
        let str="";
        for(let temp of lore){
            str += temp;
        }
        let infos = JSON.parse(str);

        /**
         * 生成女仆
         * t: type, 女仆的命名空间
         */
        let maid = dimension.spawnEntity(infos["t"], location);

        /**
         * 设置状态
         * o: owner, 主人id
         * h: health, 生命值
         */
        this.setOwnerID(maid, infos["o"]);
        if(set_health) this.setHealth(maid, infos["h"])
        /**
         * 获取背包
         * l: location, 位置
         * b: backpack,背包大小
         * bi: backpack id, 临时背包的生物id
         */
        if(infos["b"] != undefined){
            var chunk_loader = dimension.spawnEntity("touhou_little_maid:chunk_loader", location);
            chunk_loader.teleport(new Vector(infos.l[0], -63, infos.l[2]));
            Tool.logger(infos["b"]);
            var new_backpack = MaidBackpack.create(maid, infos["b"], dimension, location);
            var old_id = infos["bi"];
            system.runTimeout(()=>{
                maid.runCommand("ride @e[c=1,type=touhou_little_maid:maid_backpack] start_riding @s");
            }, 1);
            // 没法找,考虑直接ticking area或者设置常驻加载区
            let interval_id = system.runInterval(()=>{
                Tool.logger("run");
                let old_backpack = world.getEntity(old_id);
                if(old_backpack !== undefined){
                    Tool.logger("run_over");
                    MaidBackpack.copy(old_backpack, new_backpack);
                    old_backpack.triggerEvent("despawn");
                    chunk_loader.triggerEvent("despawn");
                    system.clearRun(interval_id);
                }
            }, 1);
        }
        return maid;
    }
    /**
     * 将物品转为女仆
     * @param {ItemStack} item
     * @param {Dimension} dimension
     * @param {Vector} location 
     * @param {boolean} [set_health=false]
     * @returns {Entity|undefined} maid
     */
    static fromItem(item, dimension, location, set_health=false){
        let lore = item.getLore();
        if(lore.length > 0){
            return EntityMaid.fromLore(lore, dimension, location, set_health);
        }
        return undefined;
    }
    ///// GET /////
    /**
     * 生成一个随机女仆
     * @param {Dimension} dimension 
     * @param {Vector} location 
     * @returns {Entity} maid
     */
    static spawnRandomMaid(dimension, location){
        // 现在只是生成默认女仆
        dimension.spawnEntity("thlmm:maid_basic", location);
    }
    /**
     * 获取主人id
     * @param {Entity} maid
     * @returns {string|undefined}
     */
    static getOwnerID(maid){
        for(let tag of maid.getTags()){
            if(tag.substring(0, 6) == "thlmo:"){
                return tag.substring(6);
            }
        }
        return undefined;
    }
    /**
     * 获取主人
     * @param {Entity} maid
     * @returns {string|undefined}
     */
    static getOwner(maid){
        let id = this.getOwnerID(maid);
        if(id!==undefined){
            return world.getEntity(id);
        }
        return undefined;
    }
    /**
     * 获取背包id
     * @param {Entity} maid 
     * @returns {string|undefined}
     */
    static getBackpackID(maid){
        for(let tag of maid.getTags()){
            if(tag.substring(0, 6) == "thlmb:"){
                return tag.substring(6);
            }
        }
        return undefined;
    }
    /**
     * 获取背包实体
     * @param {Entity} maid 
     * @returns {Entity|undefined}
     */
    static getBackpackEntity(maid){
        let id = this.getBackpackID(maid);
        if(id !== undefined){
            return world.getEntity(id);
        }
        return undefined;
    }
    /**
     * 获取背包
     * @param {Entity} maid 
     * @returns {Container|undefined}
     */
    static getBackpack(maid){
        let backpack = this.getBackpackEntity(maid);
        if(backpack !== undefined){
            return MaidBackpack.getContainer(backpack);
        }
        return undefined;
    }
    /**
     * 获取健康属性
     * @param {Entity} maid
     * @returns {EntityHealthComponent}
     */
    static getHealthComponent(maid){
        return this.maid.getComponent("health");
    }

    ///// SET /////
    /**
     * 设置主人id
     * @param {Entity} maid 
     * @param {string} id 
     */
    static setOwnerID(maid, id){
        // clear
        for(let tag of maid.getTags()){
            if(tag.substring(0, 6) == "thlmo:"){
                maid.removeTag(tag);
            }
        }
        // set
        maid.addTag(`thlmo:${id}`);
    }
    /**
     * 设置生命值
     * @param {Entity} maid
     * @param {number} amount 
     */
    static setHealth(maid, amount){
        return this.getHealthComponent(maid).setCurrentValue(amount);
    }
    /**
     * 设置背包id
     * @param {Entity} maid 
     * @param {string} id 
     */
    static setBackpackID(maid, id){
        for(let tag of maid.getTags()){
            if(tag.substring(0, 6) == "thlmb:"){
                maid.removeTag(tag);
                break;
            }
        }
        maid.addTag(`thlmb:${id}`);
    }
}