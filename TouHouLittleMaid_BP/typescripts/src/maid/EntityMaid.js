import { Entity, world, Dimension,system, EntityHealthComponent, Container, ItemStack, Block, Player, ContainerSlot, EntityRemoveAfterEvent } from "@minecraft/server";
import { Vector } from "../libs/VectorMC";
import * as Tool from "../libs/ScarletToolKit";
import { StrMaid } from "./StrMaid";
import { emote } from "../../data/emote";
import { MaidSkin } from "./MaidSkin";
import { TagDataHelper } from '../libs/TagDataInterface'
import { DP } from '../libs/DynamicPropertyInterface';
import { MaidTarget } from "./MaidTarget";

export class EntityMaid{
    /**
     * 格式化输出 rawtext
     * @param {Entity} maid
     * @returns {object}
     */
    static formatOutput(maid){
        let rawtext = []
        // 标题
        rawtext.push({"translate": "message.tlm.admin.maid_info"});
        rawtext.push({"text":"\n"});
        // 女仆名称
        rawtext.push({"translate": "message.tlm.admin.maid.name"});
        rawtext.push({"text": `${this.getNameTag(maid)}\n`});
        // 主人名称
        rawtext.push({"translate": "message.tlm.admin.maid.owner.name"});
        rawtext.push({"text": `${this.Owner.getName(maid)}\n`});
        // 主人ID
        rawtext.push({"translate": "message.tlm.admin.maid.owner.id"});
        rawtext.push({"text": `${this.Owner.getID(maid)}\n`});
        // 等级
        rawtext.push({"translate": "message.tlm.admin.maid.level"});
        rawtext.push({"text": `${this.Level.get(maid)}\n`});
        // 杀敌数
        rawtext.push({"translate": "message.tlm.admin.maid.kill"});
        rawtext.push({"text": `${this.Kill.get(maid)}\n`});
        // 生命值
        rawtext.push({"translate": "message.tlm.admin.maid.health"});
        rawtext.push({"text": `${this.Health.get(maid)}/${this.Health.getMax(maid)}\n`});
        // 工作模式
        rawtext.push({"translate": "message.tlm.admin.maid.work"});
        rawtext.push({"text": `${EntityMaid.Work.getName(this.Work.get(maid))}\n`});
        // 隐藏背包
        rawtext.push({"translate": "message.tlm.admin.maid.backpack"});
        rawtext.push({"text": `${this.Backpack.getInvisible(maid)}\n`});
        // 拾物模式
        rawtext.push({"translate": "message.tlm.admin.maid.pick"});
        rawtext.push({"text": `${this.Pick.get(maid)}\n`});
        // 静音模式
        rawtext.push({"translate": "message.tlm.admin.maid.mute"});
        rawtext.push({"text": `${this.Mute.get(maid)}\n`});

        return rawtext;
    }

    /**
     * 初始化女仆动态属性
     *  在刚生成时调用
     * @param {Entity} maid 
     */
    static initDynamicProperties(maid){
        // 可以丢失的量 仅用动态属性存储
        // if(maid.getDynamicProperty("temp_pick") === undefined) maid.setDynamicProperty("temp_pick", false);

        // 有持久化存储需求的变量 使用标签辅助存储
        if(DP.getVector (maid, "home")     === undefined) DP.setVector (maid, "home"     , {x:0, y:0, z:0});
        if(DP.getInt    (maid, "home_dim") === undefined) DP.setInt    (maid, "home_dim" , 0);
        if(DP.getInt    (maid, "level")    === undefined) DP.setInt    (maid, "level"    , 1);
        if(DP.getInt    (maid, "kill")     === undefined) DP.setInt    (maid, "kill"     , 0);
        if(DP.getBoolean(maid, "pick")     === undefined) DP.setBoolean(maid, "pick"    , true);
    }
    // 等级
    static Level = {
        max:2,
        properties:[
            {// lv.1
                "danmaku": 15,    // 弹幕伤害
                "heal"   : [3, 6] // 单次回血量（3秒一次）
            },
            {// lv.2
                "danmaku": 24,    // 弹幕伤害
                "heal"   : [5, 8] // 单次回血量（3秒一次）
            },
            {// lv.3
                "danmaku": 24,    // 弹幕伤害
                "heal"   : [5, 8] // 单次回血量（3秒一次）
            }
        ],
        str:[
            "§l§aLv.1§r",
            "§l§bLv.2§r",
            "§l§cLv.3§r",
            "§l§dLv.4§r",
            "§l§eLv.5§r",
            "§l§bL§cv§d.§e6§r",
        ],
        /**
         * 获取等级
         * @param {Entity} maid
         * @returns {number}
         */
        get(maid){
            return DP.getInt(maid, "level")
        },
        /**
         * 获取等级字符串
         * @param {Entity} maid
         * @returns {number}
         */
        getStr(maid){
            return this.str[this.get(maid)-1];
        },
        /**
         * 设置等级
         * @param {Entity} maid
         * @param {number} level
         */
        set(maid, level){
            let oldLevel = this.get(maid);
            if(oldLevel !== undefined){
                maid.triggerEvent(`api:lv_${oldLevel}_basic_quit`);
            }
            if(maid.getComponent("minecraft:is_tamed") !== undefined){
                maid.triggerEvent(`api:lv_${oldLevel}_tame_quit`);
            }

            system.runTimeout(()=>{
                this.eventBasic(maid, level);
                if(maid.getComponent("minecraft:is_tamed") !== undefined){
                    this.eventTamed(maid, level);
                }
            },1);
            DP.setInt(maid, "level", level);
        },
        /**
         * 触发基础事件
         * @param {Entity} maid
         * @param {number} level 
         */
        eventBasic(maid, level){
            maid.triggerEvent(`api:lv_${level}_basic`);
        },
        /**
         * 触发驯服事件
         * @param {Entity} maid
         * @param {number} level 
         */
        eventTamed(maid, level){
            maid.triggerEvent(`api:lv_${level}_tame`);
        },
        /**
         * 属性值获取
         * @param {Entity} maid 
         * @param {string} key danmaku | heal
         * @returns {number | Array}
         */
        getProperty(maid, key){
            return this.properties[this.get(maid)-1][key];
        }
    }
    // 主人
    static Owner = {
        /**
         * 更新动态属性的数据
         * @param {Entity} maid 
         */
        refresh(maid){
            let tameable = maid.getComponent("tameable");
            // if(tameable === undefined) return;
            
            if(tameable.tamedToPlayerId !== undefined){
                this.setID(maid, tameable.tamedToPlayerId);
            }
            if(tameable.tamedToPlayer !== undefined){
                this.setName(maid, tameable.tamedToPlayer.name);
            }
        },
        /**
         * 是否有主人
         * @returns {boolean}
         */
        has(maid){
            if(this.getID(maid) === undefined && this.getName(maid) == undefined){
                return false;
            }
            return true;
        },
        /**
         * 获取主人ID
         * @param {Entity} maid
         * @returns {string|undefined}
         */
        getID(maid){
            return TagDataHelper.get(maid, "thlmo:");
        },
        /**
         * 设置主人ID
         * @param {Entity} maid 
         * @param {string} id 
         */
        setID(maid, id){
            TagDataHelper.del(maid, "thlmo:")
            TagDataHelper.set(maid, "thlmo:", id);
        },
        /**
         * 获取主人名称
         * @param {Entity} maid
         * @returns {string|undefined}
         */
        getName(maid){
            return TagDataHelper.get(maid, "thlmn:");
        },
        /**
         * 设置主人名称
         * @param {Entity} maid 
         * @param {string} name 
         */
        setName(maid, name){
            TagDataHelper.del(maid, "thlmn:");
            TagDataHelper.set(maid, "thlmn:", name);
        },
        /**
         * 获取主人实体
         * @param {Entity} maid
         * @returns {Player|undefined}
         */
        get(maid){
            let id = this.getID(maid);
            if(id !== undefined){
                return world.getEntity(id);
            }
            let name = this.getName(maid);
            if(name!==undefined){
                let players = world.getPlayers({"name": name});
                if(players.length()!==0){
                    return players[0];
                }
            }
            return undefined;
        },
        /**
         * 设置主人实体
         * @param {Entity} maid
         * @param {Player} player
         */
        set(maid, player){
            maid.getComponent("tameable").tame(player);
            this.setID(maid, player.id);
            this.setName(maid, player.name);
        }
    }
    // 生命值
    static Health = {
        /**
         * 获取生命值属性
         * @param {Entity} maid
         * @returns {EntityHealthComponent}
         */
        getComponent(maid){
            return maid.getComponent("health");
        },
        /**
         * 获取最大生命值
         * @param {Entity} maid
         * @returns {Number} Max value
         */
        get(maid){
            return this.getComponent(maid).currentValue;
        },
        /**
         * 获取最大生命值
         * @param {Entity} maid
         * @returns {Number} Max value
         */
        getMax(maid){
            return this.getComponent(maid).defaultValue;
        },

        /**
         * 设置生命值
         * @param {Entity} maid
         * @param {number} amount 
         */
        set(maid, amount){
            return this.getComponent(maid).setCurrentValue(amount);
        },
        /**
         * TODO: 设置最大生命值 *未实现
         * @param {Entity} maid
         * @param {number} amount 
         */
        setMax(maid, amount){
            
        },
        // 特殊字符的起始位置
        strOffset: 0xE600,
        /**
         * 将健康值（整数）转换为文本
         * @param {Int} health
         */
        toStr(health){
            let result = "";
            let stack = Math.floor(health / 20);
            let value = health % 20;
            if(value===0) value=20;
            for(let i = 10; i > 0;){
                if(value >= 2){
                    value -= 2;
                    result += this.fullStr();
                }
                else if(value === 1){
                    value -= 1;
                    result += this.halfStr();
                }
                else{
                    result += this.emptyStr();
                }
                i--;
            }
            return result
        },
        emptyStr(){ return String.fromCodePoint(this.strOffset + 0x03); },
        halfStr(){ return String.fromCodePoint(this.strOffset + 0x04); },
        fullStr(){ return String.fromCodePoint(this.strOffset + 0x05); }
    }
    // 击杀数
    static Kill = {
        /**
         * 获取杀敌数
         * @param {Entity} maid 
         * @returns {number}
         */
        get(maid){
            let result = DP.getInt(maid, "kill");
            if(result===undefined) return 0;
            return result;
        },
        /**
         * 设置杀敌数
         * @param {Entity} maid 
         * @param {number} amount
         */
        set(maid, amount){
            DP.setInt(maid, "kill", amount);
        }
    }
    // 皮肤
    static Skin = {
        /**
         * 设置模型包编号
         * @param {Entity} maid 
         * @param {number} skinpack
         * @returns {number}
         */
        setPack(maid, skinpack){
            maid.setProperty("thlm:skin_pack", skinpack);
        },
        /**
         * 设置模型编号 从 0 开始
         * @param {Entity} maid
         *  @param {number} index
         */
        setIndex(maid, index){
            maid.triggerEvent(`skin:${index}`);
        },
        /**
         * 获取模型包编号
         * @param {Entity} maid 
         * @returns {number}
         */
        getPack(maid){
            return maid.getProperty("thlm:skin_pack");
        },
        /**
         * 获取模型编号
         * @param {Entity} maid 
         * @returns {number}
         */
        getIndex(maid){
            return maid.getComponent("minecraft:variant").value;
        },
        /**
         * 随机设置一个皮肤
         * @param {Entity} maid 
         */
        setRandom(maid){
            let target = MaidSkin.getRandom();
            this.setPack(maid, target.pack);
            this.setIndex(maid, target.seq);
        }
    }
    // 拾物模式
    static Pick = {
        /**
         * 设置模式
         * @param {Entity} maid 
         * @param {boolean} value
         */
        set(maid, value){
            maid.triggerEvent(value ? "api:mode_pick" : "api:mode_quit_pick");
            DP.setBoolean(maid, "pick", value);
        },
        switchMode(maid){
            this.set(maid, !this.get(maid));
        },
        /**
         * 获取模式
         * @param {Entity} maid 
         * @returns {boolean}
         */
        get(maid){
            return DP.getBoolean(maid, "pick");
        },
        /**
         * 吸取范围内的物品
         * @param {Entity} maid
         * @param {number} range
         */
        magnet(maid, range){
            let container = EntityMaid.Backpack.getContainer(maid);

            let items = maid.dimension.getEntities({"location": maid.location, "type": "minecraft:item", "maxDistance": range});
            for(let item of items){
                let itemStack = item.getComponent("minecraft:item").itemStack;
                let beforeAmount = itemStack.amount;

                let result = container.addItem(itemStack);
                if(result===undefined){
                    item.dimension.spawnParticle("touhou_little_maid:item_get", item.location);
                    item.remove();
                }
                else if(beforeAmount !== result.amount){
                    item.dimension.spawnItem(result, item.location).clearVelocity();
                    item.dimension.spawnParticle("touhou_little_maid:item_get", item.location);
                    item.remove();
                }
            }
        },
        getImg(is_open){
            return is_open?"textures/gui/pick_activate.png":"textures/gui/pick_deactivate.png"
        },
        getLang(is_open){
            return is_open?"gui.touhou_little_maid:button.pick.true.name":"gui.touhou_little_maid:button.pick.false.name"
        }
    }
    // 骑乘模式
    static Ride = {
        switchMode(maid){
            
        },
        getImg(is_open){
            return is_open?"textures/gui/ride_activate.png":"textures/gui/ride_deactivate.png"
        },
        getLang(is_open){
            return is_open?"gui.touhou_little_maid:button.ride.true.name":"gui.touhou_little_maid:button.ride.false.name"
        }
    }
    // 工作模式
    static Work = {
        AMOUNT         : 7,  // 总数（包含空闲）
        
        idle           : 0,  // 空闲
        attack         : 1,  // 攻击
        danmaku_attack : 2,  // 弹幕攻击
        farm           : 3,  // 农场
        sugar_cane     : 4,  // 甘蔗
        melon          : 5,  // 瓜类
        cocoa          : 6,  // 可可
        
        grass          : 7,  // 花草
        snow           : 8,  // 清雪

        feed           : 9,  // 喂食
        
        shears         : 10, // 剪刀
        milk           : 11, // 牛奶
        torch          : 12, // 火把
        
        feed_animal    : 13, // 繁殖动物
        extinguishing  : 14, // 灭火
        
        ranged_attack  : 15,
        NAME_LIST:[
            "idle",
            "attack",
            "danmaku_attack",
            "farm",
            "sugar_cane",
            "melon",
            "cocoa",

            "grass",      
            "snow",
            
            "feed",
            "shears",
            "milk",
            
            "torch",
            "feed_animal",
            "extinguishing",
            
            
            "ranged_attack"
        ],
        // 切换到模式时的音效(现在已经转移到行为包内播放)
        SOUND_LIS:[
            undefined,
            "mob.thlmm.maid.attack",
            "mob.thlmm.maid.attack",
            undefined,
            undefined,
            undefined,
            undefined,

            undefined,      
            undefined,
            "mob.thlmm.maid.feed",
            undefined,
            undefined,
            undefined,
            "mob.thlmm.maid.feed",
            undefined
        ],
        // UI 图标
        IMG_LIST:[
            "textures/items/feather.png",
            "textures/items/diamond_sword.png",
            "textures/items/hakurei_gohei.png",
            "textures/items/iron_hoe.png",
            "textures/items/reeds.png",
            "textures/items/melon.png",
            "textures/items/dye_powder_brown.png",

            "textures/blocks/tallgrass.png",
            "textures/items/snowball.png",
            "textures/items/beef_cooked.png",
            "textures/items/shears.png",
            "textures/items/bucket_milk.png",
            "textures/items/torch_on.png",
            "textures/items/wheat.png",
            "textures/items/extinguisher.png",

            "textures/items/bow_standby.png"
        ],
    
        /**
         * 获取工作模式
         * @param {Entity} maid 
         * @returns {number}
         */
        get(maid){
            return maid.getProperty("thlm:work");
        },
        /**
         * 设置工作模式
         * @param {Entity} maid 
         * @param {number} type
         */
        set(maid, type){
            maid.triggerEvent(this.getEventName(maid, this.get(maid), true));
            // 有些工作模式存在相同的组件，延迟修改避免删除
            system.runTimeout(()=>{
                maid.triggerEvent(this.getEventName(maid, type, false));
                MaidTarget.search(maid, 15);
            },1);
        },
        /**
         * 离开工作模式
         * @param {Entity} maid
         */
        quit(maid){
            maid.triggerEvent(this.getEventName(maid, this.get(maid), true));
        },
        /**
         * 进入工作模式 用来恢复站立状态的工作
         * @param {Entity} maid 
         * @param {number} type
         */
        enter(maid, type){
            maid.triggerEvent(this.getEventName(maid, type));
        },
        /**
         * 获取名称
         * @param {number} type
         * @returns {string}
         */
        getName(type){
            return this.NAME_LIST[type];
        },
        /**
         * 获取事件名称
         */
        getEventName(maid, type, quit){
            // 拼接基础字符串
            let result = "api:mode_";
            if(quit) result += "quit_";
            result += this.getName(type);
            
            // 受等级影响的类型
            if(type === this.attack){
                result += `_lv${EntityMaid.Level.get(maid)}`;
            }
            return result;
        },
        /**
         * 获取语言文件字符串
         * @param {number} type
         * @returns {string}
         */
        getLang(type){
            return `task.touhou_little_maid:${this.getName(type)}.name`;
        },
        /**
         * 获取按钮材质
         * @param {number} type
         * @returns {string}
         */
        getIMG(type){
            return this.IMG_LIST[type];
        },
        /**
         * 获取声音
         * @param {*} type
         * @returns {string|undefined}
         */
        getSound(type){
            return this.SOUND_LIST[type];
        }
    }
    /// 字符化时不(全)记录的属性
    // 家 
    static Home = {
        /**
         * 获取home模式
         * @param {Entity} maid 
         */
        getMode(maid){
            return maid.getProperty("thlm:home");
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
            DP.setVector(maid, "home", {x: l.x, y:l.y, z:l.z});
            DP.setInt(maid, "home_dim", Tool.dim_string2int(maid.dimension.id))
        },
        /**
         * 获取家的位置
         * @param {Entity} maid 
         * @returns {[number,number,number,string]|undefined}
         */
        getLocation(maid){
            let location = DP.getVector(maid, "home");
            if(location === undefined) return undefined;

            let dim = DP.getInt(maid, "home_dim");
            if(dim === undefined) return undefined;

            let x = location.x;
            let y = location.y;
            let z = location.z;
            if(x===0 && y===0 && z===0 && dim===0) return undefined;
            return [x, y, z, Tool.dim_int2string(dim)];
        }
    }    
    // 背包
    static Backpack = class{
        static default = 0;
        static small   = 1;
        static middle  = 2;
        static big     = 3;
        static capacityList = [6, 12, 24, 36];
        static nameList = [
            "default",
            "small",
            "middle",
            "big"
        ]
        /**
         * 获取背包是否隐藏
         * @param {Entity} maid 
         * @returns {boolean}
         */
        static getInvisible(maid){
            return maid.getProperty("thlm:backpack_invisible");
        }
        /**
         * 设置背包是否隐藏
         * @param {Entity} maid
         * @param {boolean} target
         */
        static setInvisible(maid, value){
            return maid.setProperty("thlm:backpack_invisible", value);
        }
        /**
         * 获取背包内容
         * @param {Entity} maid 
         * @returns {Container|undefined}
         */
        static getContainer(maid){
            return maid.getComponent("inventory").container;
        }
        /**
         * 获取背包类型（大小）
         * @param {Entity} maid
         * @returns {number} 0~3 
         */
        static getType(maid){
            return maid.getProperty("thlm:backpack_type");
        }
        /**
         * 设置背包类型（大小）
         * @param {Entity} maid
         * @returns {number} 0~3 
         */
        static setType(maid, type){
            maid.triggerEvent(`api:backpack_${this.getName(type)}`);
        }

        ///// 查包管理 /////
        static nameTags = [
            "§t§h§l§m§d§r",
            "§t§h§l§m§s§r",
            "§t§h§l§m§m§r",
            "§t§h§l§m§b§r"
        ]
        /**
         * 是否处于查包模式
         * @param {Entity} maid 
         * @returns {boolean}
         */
        static isCheckMode(maid){
            return maid.getDynamicProperty("inv_check")===true;
        }
        /**
         * 获取查包模式的前缀
         * @param {number} maid 
         */
        static getNamePrefix(maid){
            return this.nameTags[this.getType(maid)];
        }
        /**
         * 主人查包模式
         * 修改女仆的名称
         * @param {Entity} maid 
         * @returns {boolean}
         */
        static checkMode(maid){
            maid.setDynamicProperty("name", maid.nameTag);
            maid.setDynamicProperty("inv_check", true);

            maid.nameTag = this.getNamePrefix(maid);
            return true;
        }
        /**
         * 退出主人查包模式
         * @param {Entity} maid
         * @returns {boolean}
         */
        static quitCheckMode(maid){
            maid.nameTag = maid.getDynamicProperty("name");

            maid.setDynamicProperty("name");
            maid.setDynamicProperty("inv_check", false);
            return true;
        }

        ///// 辅助函数 /////
        /**
         * 添加物品 可以和现有的同种物品堆叠
         *  若全部添加成功，返回-1
         *  若没有空间或只能添加一部分，返回值是什么有待实验 可能是未成功添加的部分
         * @param {Entity} maid 
         * @param {ItemStack} itemStack
         * @returns {ItemStack|undefined}
         */
        static addItem(maid, itemStack){
            let container = this.getContainer(maid);
            if(container === undefined) return 0;

            return container.addItem(itemStack);
        }
        /**
         * 移除物品 数量由count指定，itemStack中的数量不被考虑
         *  若成功移除则返回true
         *  数量不足则返回已移除的数量
         * @param {Entity} maid
         * @param {ItemStack} itemStack
         * @param {number} count
         * @returns {true|number}
         */
        static removeItem(maid, itemStack, count){
            let container = this.getContainer(maid);
            if(container === undefined) return false;

            let left = count;
            for(let i = 0; i < container.size; i++){
                let item = container.getItem(i);
                if(item !== undefined && item.isStackableWith(itemStack)){
                    // 查找成功, 移除
                    if(item.amount < left){
                        left -= count;
                        container.setItem(i);
                    }
                    else if(item.amount === left){
                        container.setItem(i);
                        return true;
                    }
                    else{
                        let afterItem = item.clone();
                        afterItem.amount -= left;
                        container.setItem(i, afterItem);
                        return true;
                    }
                }

            }
            return left;
        }
        /**
         * 移除物品 类型符合即可移除 数量由count指定
         *  若成功移除则返回true
         *  数量不足则返回已移除的数量
         * @param {Entity} maid
         * @param {string} typeId
         * @param {number} count
         * @returns {true|number}
         */
        static removeItem_type(maid, typeId, count){
            let container = this.getContainer(maid);
            if(container === undefined) return false;

            let left = count;
            for(let i = 0; i < container.size; i++){
                let item = container.getItem(i);
                if(item !== undefined && item.typeId === typeId){
                    // 查找成功, 移除
                    if(item.amount < left){
                        left -= count;
                        container.setItem(i);
                    }
                    else if(item.amount === left){
                        container.setItem(i);
                        return true;
                    }
                    else{
                        let afterItem = item.clone();
                        afterItem.amount -= left;
                        container.setItem(i, afterItem);
                        return true;
                    }
                }

            }
            return left;
        }
        /**
         * 清除所有物品
         * @param {Entity} maid 
         */
        static clearAll(maid){
            let container = this.getContainer(maid);
            if(container === undefined) return false;
            
            container.clearAll();
        }
        /**
         * 获取某个栏位的物品
         * @param {number} slot
         * @returns {ItemStack | undefined} 
         */
        static getItem(maid, slot){
            let container = this.getContainer(maid);
            if(container === undefined) return undefined;

            return container.getItem(slot);
        }
        /**
         * 获取某个栏位的对象
         * @param {number} slot
         * @returns {ContainerSlot | undefined} 
         */
        static getSlot(maid, slot){
            let container = this.getContainer(maid);
            if(container === undefined) return undefined;

            return container.getSlot(slot);
        }
        /**
         * 移动物品到容器
         * @param {Entity} maid 
         * @param {number} fromSlot 
         * @param {number} toSlot 
         * @param {Container} toContainer 
         */
        static moveItem(maid, fromSlot, toSlot, toContainer){
            let container = this.getContainer(maid);
            if(container === undefined) return;

            container.moveItem(fromSlot, toSlot, toContainer);
        }
        /**
         * 设置某个栏位的物品
         * @param {Entity} maid 
         * @param {number} slot 
         * @param {ItemStack|undefined} itemStack 
         */
        static setItem(maid, slot, itemStack=undefined){
            let container = this.getContainer(maid);
            if(container === undefined) return undefined;

            container.setItem(slot, itemStack);
        }
        /**
         * 与其它容器交换物品
         * @param {Entity} maid 
         * @param {number} otherSlot 
         * @param {Container} otherContainer 
         */
        static swapItems(maid, otherSlot, otherContainer){
            let container = this.getContainer(maid);
            if(container === undefined) return undefined;

            container.swapItems(otherSlot, otherContainer);
        }

        ///// 数据函数 /////
        /**
         * 获取某种类型的背包容量
         * @param {number} type 
         * @returns {number}
         */
        static getCapacity(type){
            return this.capacityList[type];
        }
        /**
         * 获取某种类型的背包名称
         * @param {number} type 
         * @returns {string}
         */
        static getName(type){
            return this.nameList[type];
        }
        /**
         * 获取某种类型的背包名称
         * @param {number} type 
         * @returns {string}
         */
        static getItemName(type){
            return `touhou_little_maid:maid_backpack_${this.getName(type)}`;
        }
        /**
         * 在指定位置将背包释放
         * @param {Entity} maid 
         * @param {Vector} location 
         */
        static dump(maid, location=maid.location){
            // 释放包内物品
            let dimension = maid.dimension;
            let container = this.getContainer(maid);

            for(let i = 0; i < container.size; i++){
                let item = container.getItem(i)
                if(item !== undefined){
                    dimension.spawnItem(item.clone(), location);
                    container.setItem(i);
                }
            }
        }
        /**
         * 获取UI按钮名称
         */
        static getButtonLang(invisible){
            return invisible?"gui.touhou_little_maid:button.backpack.true.name":"gui.touhou_little_maid:button.backpack.false.name"
        }
        /**
         * 获取UI按钮图像
         */
        static getButtonImg(invisible){
            return invisible?"textures/gui/maid_backpack_deactivate.png":"textures/gui/maid_backpack_activate.png"
        }
    }
    // 表情
    static Emote = {
        timeout:undefined,
        /**
         * 获取当前表情ID
         * @param {Entity} maid 
         * @returns {number}
         */
        get(maid){
            return maid.getProperty("thlm:emote");
        },
        /**
         * 设置表情ID
         * @param {Entity} maid 
         * @param {number} index 
         */
        set(maid, index){
            if(this.timeout !== undefined){
                system.clearRun(this.timeout);
                this.timeout=undefined;
            }
            let value = index;
            if(emote[index] !== undefined){
                value += 1000*emote[index][0];
                value += 1000000*emote[index][1];
                this.timeout = system.runTimeout(()=>{
                    this.set(maid, 0);
                }, emote[index][2]);
            }
            maid.setProperty("thlm:emote", value);
        },
        /**
         * 清除表情
         * @param {Entity} maid 
         */
        clear(maid){
            this.set(maid, 0);
        },
        // 背包 起始位置1
        backpack(maid){
            this.set(maid, 1 + EntityMaid.Backpack.getType(maid));
        },
        apple(maid){ this.set(maid, 5); }, // 苹果 5
        cake (maid){ this.set(maid, 6); } // 蛋糕 6
    }
    // 静音模式
    static Mute = {
        /**
         * 设置模式
         * @param {Entity} maid 
         * @param {boolean} value
         */
        set(maid, value){
            DP.setBoolean(maid, "mute", value);
        },
        switchMode(maid){
            this.set(maid, !this.get(maid));
        },
        /**
         * 获取模式
         * @param {Entity} maid 
         * @returns {boolean}
         */
        get(maid){
            let res = DP.getBoolean(maid, "mute");
            if(res===undefined){
                this.set(maid, false);
                return false;
            }
            else{
                return res;
            }
        },
        getImg(is_mute){
            return is_mute?"textures/gui/mute_activate.png":"textures/gui/mute_deactivate.png"
        },
        getLang(is_mute){
            return is_mute?"gui.touhou_little_maid:button.mute.true.name":"gui.touhou_little_maid:button.mute.false.name"
        }
    }
    // 雕塑状态
    static Statues = {
        scale:{
            /**
             * 设置缩放比例
             * @param {Entity} maid 
             * @param {Float} scale 
             */
            set(maid, scale){
                maid.setProperty("thlm:scale", scale);
            },
            /**
             * 获取缩放比例
             * @param {Entity} maid 
             * @returns {Float}
             */
            get(maid){
                return maid.getProperty("thlm:scale");
            }
        },
        space:{
            /**
             * 设置占位方块尺寸
             * @param {Entity} maid
             * @param {Vector} space 
             */
            set(maid, space){
                DP.setVector(maid, "space", space);
            },
            /**
             * 获取占位方块尺寸
             * @param {Entity} maid 
             * @returns {Vector|undefined}
             */
            get(maid){
                return DP.getVector(maid, "space");
            }
        }
    }
    static Sound = class{
        /**
         * 取消驯服语音
         * @param {Entity} maid 
         */
        static disableTamed(maid){
            maid.setDynamicProperty("sound:disable_tamed", true);
        }
        static tamed(maid){
            if(maid.getDynamicProperty("sound:disable_tamed") === true){
                maid.setDynamicProperty("sound:disable_tamed");
                return;
            }
            this.playSound(maid, "mob.thlmm.maid.tamed");
        }
        /**
         * 播放声音
         * @param {Entity} maid 
         * @param {string} name 
         */
        static playSound(maid, name){
            maid.dimension.runCommand(`playsound ${name} @a ${maid.location.x} ${maid.location.y} ${maid.location.z}`);
        }
    }
    /**
     * 初始化女仆实体为女仆
     * @param {Entity} maid 
     * @param {boolean} [reborn=true] 是否是重生的女仆
     */
    static init_maid(maid, reborn=false){
        if(maid.getDynamicProperty("spawn_set")!==undefined) return;

        // 添加女仆属性
        maid.triggerEvent(reborn ? "become_maid_reborn" : "become_maid");
        
        // 首次生成
        if (!reborn) {
            // 设置动态属性
            EntityMaid.initDynamicProperties(maid);
            system.runTimeout(()=>{
                if(EntityMaid.Work.get(maid)<0) return;
                // 选择随机皮肤
                if(!EntityMaid.Owner.has(maid)){
                    EntityMaid.Skin.setRandom(maid);
                }
            },1);
        }
        maid.setDynamicProperty("spawn_set", true);
    }
    /// 字符化
    /**
     * 将女仆转为字符
     * @param {Entity} maid 
     * @param {boolean} [dump=true] 
     * @returns {string}
     */
    static toStr(maid, dump=true){
        let maidStr = "";
        /// 记录女仆状态 ///
        // 主人id, 可为空（野生女仆）
        let o_id = this.Owner.getID(maid);
        if(o_id !== undefined){
            maidStr = StrMaid.Owner.setID(maidStr, o_id);
        }
        // 等级
        maidStr = StrMaid.Level.set(maidStr, this.Level.get(maid));
        // 杀敌数
        maidStr = StrMaid.Kill.set(maidStr, this.Kill.get(maid));
        // 生命值
        let health = maid.getComponent("health");
        maidStr = StrMaid.Health.set(maidStr, health.currentValue, health.defaultValue);
        // 皮肤
        maidStr = StrMaid.Skin.set(maidStr, this.Skin.getPack(maid),this.Skin.getIndex(maid))
        // 工作模式
        maidStr = StrMaid.Work.set(maidStr, this.Work.get(maid));
        // maidStr = StrMaid.Work.set(maidStr, this.Work.get(maid));
        // 拾物模式
        maidStr = StrMaid.Pick.set(maidStr, this.Pick.get(maid));
        // 静音模式
        maidStr = StrMaid.Mute.set(maidStr, this.Mute.get(maid));
        // 背包是否隐藏
        maidStr = StrMaid.backpackInvisibility.set(maidStr, this.Backpack.getInvisible(maid));
        // 背包等级
        maidStr = StrMaid.backpackType.set(maidStr, this.Backpack.getType(maid));
        // 是否坐下
        maidStr = StrMaid.Sit.set(maidStr, this.isSitting(maid));

        // 字符类数据最后设置
        if(o_id !== undefined){
            // 主人名称
            maidStr = StrMaid.Str.setOwnerName(maidStr, this.Owner.getName(maid));
            // 女仆名称
            if(this.getNameTag(maid) !== "") maidStr = StrMaid.Str.setMaidName(maidStr, this.getNameTag(maid));
        }

        // 爆出物品
        if(dump) this.Backpack.dump(maid);

        return maidStr;
        
    }
    /**
     * 将字符转为女仆  由照片、魂符放出的女仆不会回满血
     * @param {string} maidStr
     * @param {Dimension} dimension
     * @param {Vector} location 
     * @param {boolean} [set_health=false]
     * @returns {Entity|undefined} maid
     */
    static fromStr(maidStr, dimension, location, set_health=false){
        /// 数据合法性校验 ///
        // 若有主人 则主人必须在世界中
        let ownerID = StrMaid.Owner.getId(maidStr);
        let ownerName = StrMaid.Str.getOwnerName(maidStr);
        let ownerEntity = undefined;
        let hasOwner = false;
        if(ownerID !== undefined){
            hasOwner = true;
            ownerEntity = world.getEntity(ownerID);
        }
        if(ownerEntity === undefined && ownerName !== undefined){
            hasOwner = true;
            ownerEntity = world.getPlayers({"name": ownerName})[0];
        }
        if(hasOwner && ownerEntity === undefined){
            return undefined;
        }

        /// 生成女仆 ///
        var maid = dimension.spawnEntity("thlmm:maid", location);
        this.init_maid(maid, true);
        
        /// 设置状态 ///
        // 等级
        this.Level.set(maid, StrMaid.Level.get(maidStr));
        // 杀敌数
        this.Kill.set(maid, StrMaid.Kill.get(maidStr));
        // 主人ID  可为空  非空时主人必须在世界中
        if(ownerID !== undefined) this.Owner.setID(maid, ownerID);
        // 生命值  延时设置，等待 level 调血
        if(set_health){
            system.runTimeout(()=>{
                this.Health.set(maid, StrMaid.Health.get(maidStr).current);
            }, 2);
        }
        // 皮肤
        let skin = StrMaid.Skin.get(maidStr);
        this.Skin.setPack(maid, skin.pack);
        this.Skin.setIndex(maid, skin.index);
        // 工作模式 驯服成功后才会恢复
        maid.setDynamicProperty("temp_work", StrMaid.Work.get(maidStr))
        // this.Work.set(maid, StrMaid.Work.get(maidStr));
        // 拾物模式
        this.Pick.set(maid, StrMaid.Pick.get(maidStr));
        // 静音模式
        this.Mute.set(maid, StrMaid.Mute.get(maidStr));
        // 背包是否隐藏
        this.Backpack.setInvisible(maid, StrMaid.backpackInvisibility.get(maidStr));
        // 背包类型
        let backpackType = StrMaid.backpackType.get(maidStr);
        if(backpackType !== undefined && backpackType > 0 && backpackType <= 3){
            this.Backpack.setType(maid, backpackType);
        }
        
        // 字符数据
        // 女仆名称
        let maidName = StrMaid.Str.getMaidName(maidStr);
        if(maidName!==undefined){ maid.nameTag = maidName }
        // 主人名称
        if(ownerName!==undefined){ this.Owner.setName(maid, ownerName)};
        
        // 设置主人
        if(hasOwner){
            this.Sound.disableTamed(maid);
            system.runTimeout(()=>{maid.getComponent("tameable").tame(ownerEntity);}, 1); // 等待女仆属性设置完成
        }

        // 设置坐下状态
        if(StrMaid.Sit.get(maidStr) === true){
            system.runTimeout(()=>{
                try{
                    if(maid !== undefined){
                        this.sitDown(maid);
                    }
                }
                catch { }
            }, 2);
        }
        return maid;
    }
    /**
     * 将女仆转为物品lore
     * 会自动清除背包
     * @param {Entity} maid
     * @param {boolean} [dump=true] 
     * @returns {string} lore
     */
    static toLore(maid, dump=true){
        let strPure = this.toStr(maid, dump);
        return Tool.str2Lore(strPure);
    }

    /// 其它
    /**
     * 移除
     * @param {Entity} maid 
     */
    static despawn(maid){
        maid.triggerEvent("despawn");
    }
    /**
     * 播放声音
     * @param {Entity} maid 
     * @param {string} name 
     */
    static playSound(maid, name){
        maid.dimension.runCommand(`playsound ${name} @a ${maid.location.x} ${maid.location.y} ${maid.location.z}`);
    }
    /**
     * 生成一个随机女仆
     * @param {Dimension} dimension 
     * @param {Vector} location 
     * @returns {Entity} maid
     */
    static spawnRandomMaid(dimension, location){
        // 现在只是生成默认女仆
        return dimension.spawnEntity("thlmm:maid", location);
    }
    /**
     * 判断一个方块是否安全（用于放置女仆）
     * @param {Block|undefined} block 
     * @returns {boolean}
     */
    static isSafeBlock(block){
        if(block===undefined || block.isAir) return true;
        return false;
    }
    /**
     * 是否处于坐下状态
     * @param {Entity} maid
     * @returns {boolean}
     */
    static isSitting(maid){
        return maid.getProperty('thlm:is_sitting');
    }
    /**
     * 坐下
     * @param {Entity} maid
     */
    static sitDown(maid){
        maid.triggerEvent("thlmm:v");
    }
    /**
     * 站起
     * @param {Entity} maid
     */
    static standUp(maid){
        maid.triggerEvent("thlmm:w");
    }
    /**
     * 获取名称
     * @param {Entity} maid 
     */
    static getNameTag(maid){
        if(this.Backpack.isCheckMode(maid)){
            let name = maid.getDynamicProperty("name");
            return name === undefined ? "" : name;
        }
        return maid.nameTag;
    }
}