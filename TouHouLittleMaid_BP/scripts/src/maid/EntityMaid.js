import { Entity,world,Vector,Dimension,system, EntityHealthComponent, Container, ItemStack } from "@minecraft/server";
import { MaidBackpack } from "./MaidBackpack";
import * as Tool from "../libs/scarletToolKit"
import { config } from '../../data/config'

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
                maid.triggerEvent("api:status_follow");
            }
            else{
                // 跟随模式 → 家模式
                this.setLocation(maid);
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
            let l = maid.location;
            maid.setProperty("thlm:home_x", Math.ceil(l.x));
            maid.setProperty("thlm:home_y", Math.ceil(l.y));
            maid.setProperty("thlm:home_z", Math.ceil(l.z));
            maid.setProperty("thlm:home_dim", Tool.dim_string2int(maid.dimension.id));
        },
        /**
         * 获取家的位置
         * @param {Entity} maid 
         * @returns {number[]}
         */
        getLocation(maid){
            return [maid.getProperty("thlm:home_x"), 
                    maid.getProperty("thlm:home_y"),
                    maid.getProperty("thlm:home_z"),
                    Tool.dim_int2string(maid.getProperty("thlm:home_dim"))];
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
     * @returns {string} lore
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
            if(backpack !== undefined){
                let backpack_type = MaidBackpack.getType(backpack);
                infos["b"] = backpack_type;

                // lore→实体时，靠是否有infos.bi判断用的是哪种保存方法，身上背的背包都会保留
                let deathBagSuccess = false;
                // 将物品转移到常加载区域, 若区块加载器不存在则会失败，转而使用原地生成法
                if(config.Maid.death_bag === false){
                    let loader = MaidBackpack.loader.get();
                    if(loader !== undefined){
                        // 在地底创建新背包(隐形)
                        let temp_backpack = MaidBackpack.create(maid, backpack_type,
                            backpack.dimension, loader.location);
                        MaidBackpack.setInvisible(temp_backpack, true);
                        infos["bi"] = temp_backpack.id;

                        system.runTimeout(()=>{
                            // 将物品移入临时背包
                            MaidBackpack.copy(backpack, temp_backpack);
                            MaidBackpack.clear(backpack);
                            // 清除旧背包
                            backpack.triggerEvent("despawn");
                        }, 1); // 延时是因为要等新背包完成初始化
                        deathBagSuccess = true;
                    }
                }
                // 原地生成法，如果没有背包(default)就会爆出物品
                if(deathBagSuccess === false){
                    if(backpack_type === MaidBackpack.default){
                        // 爆出物品
                        MaidBackpack.dump(backpack, backpack.location);
                    }
                    else{
                        MaidBackpack.setInvisible(backpack, false);
                        backpack.triggerEvent("api:grave");
                    }
                }
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
        if(infos["b"] !== undefined){
            // 生成新包
            var new_backpack = MaidBackpack.create(maid, infos["b"], dimension, location);
            // 隐藏包（因为无法正常渲染）
            MaidBackpack.setInvisible(new_backpack, true);

            // 寻找旧包(保存到常加载区域的方案)
            let old_id = infos["bi"];
            if(old_id !== undefined){
                system.runTimeout(()=>{
                    let old_backpack = world.getEntity(old_id);
                    if(old_backpack !== undefined){
                        MaidBackpack.copy(old_backpack, new_backpack);
                        old_backpack.triggerEvent("despawn");
                    }
                }, 1);// 延迟是为了背包初始化
            }
           

            // 背上包
            system.runTimeout(()=>{
                maid.runCommand("ride @e[c=1,type=touhou_little_maid:maid_backpack] start_riding @s");
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
    /**
     * 播放声音
     * @param {Entity} maid 
     * @param {string} name 
     */
    static playSound(maid, name){
        maid.dimension.runCommand(`playsound ${name} @a ${maid.location.x} ${maid.location.y} ${maid.location.z}`);
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
        dimension.spawnEntity("thlmm:maid", location);
    }
    /**
     * 获取主人id
     * @param {Entity} maid
     * @returns {string|undefined}
     */
    static getOwnerID(maid){
        return Tool.getTagData(maid, "thlmo:");
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
        return Tool.getTagData(maid, "thlmb:");
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
    static getBackpackContainer(maid){
        let backpack = this.getBackpackEntity(maid);
        if(backpack !== undefined){
            return MaidBackpack.getContainer(backpack);
        }
        return undefined;
    }
    /**
     * 获取背包是否隐藏
     * @param {Entity} maid 
     * @returns {boolean}
     */
    static getBackPackInvisible(maid){
        return maid.getProperty("thlm:backpack_invisible");
    }
    /**
     * 获取健康属性
     * @param {Entity} maid
     * @returns {EntityHealthComponent}
     */
    static getHealthComponent(maid){
        return this.maid.getComponent("health");
    }

    /**
     * 获取模型包编号
     * @param {Entity} maid 
     * @returns {number}
     */
    static getSkinPack(maid){
        return maid.getProperty("thlm:skin_pack");
    }
    /**
     * 获取模型编号
     * @param {Entity} maid 
     * @returns {number}
     */
    static getSkinIndex(maid){
        return maid.getProperty("thlm:skin_index");
    }
    ///// SET /////
    /**
     * 设置主人id
     * @param {Entity} maid 
     * @param {string} id 
     */
    static setOwnerID(maid, id){
        Tool.delTagData(maid, "thlmo:");
        Tool.setTagData(maid, "thlmo:", id);
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
        Tool.delTagData(maid, "thlmb:");
        Tool.setTagData(maid, "thlmb:", id);
    }
    /**
     * 设置背包是否隐藏
     * @param {Entity} maid
     * @param {boolean} target
     */
    static setBackPackInvisible(maid, value){
        return maid.setProperty("thlm:backpack_invisible", value);
    }

    /**
     * 设置模型包编号
     * @param {Entity} maid 
     * @param {number} skinpack
     * @returns {number}
     */
    static setSkinPack(maid, skinpack){
        return maid.setProperty("thlm:skin_pack", skinpack);
    }
    /**
     * 设置模型编号
     * @param {Entity} maid 
     *  @param {number} index
     * @returns {number} 
     */
    static setSkinIndex(maid, index){
        return maid.setProperty("thlm:skin_index", index);
    }
}