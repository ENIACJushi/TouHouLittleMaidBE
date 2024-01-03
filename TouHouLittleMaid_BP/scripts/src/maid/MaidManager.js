/**
 * 女仆tag
 * thlmo:<主人生物id>
 * thlmh:<家坐标x>,<家坐标y>,<家坐标z>,<维度> (整数)
 * thlmb:<背包生物id>
 */
/**
 * 背tag
 *  thlmm:<女仆id>
 *  thlmo:<主人生物id>
 */
import { ItemStack, world, Entity,Vector, DataDrivenEntityTriggerBeforeEvent, ItemDefinitionTriggeredBeforeEvent, system, System } from "@minecraft/server";
import * as Tool from "../libs/scarletToolKit"
import * as UI from "./MaidUI"
import { EntityMaid } from './EntityMaid';
import { MaidBackpack } from "./MaidBackpack";
import { config } from '../../data/config'
import { StrMaid } from "./StrMaid";

const HOME_RADIUS=25;

export class MaidManager{
    /**
     * 初始化事件
     */
    static init(){
        MaidBackpack.loader.init();
    }
    /**
     * 女仆生成事件
     * @param {DataDrivenEntityTriggerBeforeEvent} event 
     */
    static onSpawnEvent(event){
        // 生成 默 认 背包  为脚本召唤背包预留2刻
        system.runTimeout(()=>{
            try{
                let maid = event.entity;
                var rideable = maid.getComponent("minecraft:rideable");
                const rider = rideable.getRiders()[0];
                if(rider === undefined){
                    // 生成背包
                    var backpack = MaidBackpack.create(maid, MaidBackpack.default, maid.dimension, maid.location);
                    EntityMaid.Backpack.setID(maid, backpack.id);

                    // 背上背包   无效：rideable.addRider(backpack);
                    maid.runCommand("ride @e[c=1,type=touhou_little_maid:maid_backpack] start_riding @s");
                }
            }
            catch{};
        }, 2);
        
    }
    /**
     * 女仆寄事件
     * @param {DataDrivenEntityTriggerBeforeEvent} event 
     */
    static onDeathEvent(event){
        let maid = event.entity;
        let backpack = EntityMaid.Backpack.getEntity(maid);
        let lore = EntityMaid.toLore(maid);
        let output_item = new ItemStack("touhou_little_maid:film", 1);
        output_item.setLore(lore);
        
        // 导出胶片物品
        if(config.Maid.death_bag){
            if(MaidBackpack.getType(backpack) !== MaidBackpack.default){
                let container = MaidBackpack.getContainer(backpack);
                if(container.emptySlotsCount > 0){
                    container.addItem(output_item);
                    return;
                }
            }
        }
        event.entity.dimension.spawnItem(output_item, event.entity.location);
    }
    
    /**
     * 女仆被拍照事件
     * @param {DataDrivenEntityTriggerBeforeEvent} event 
     */
    static onPhotoEvent(event){
        let maid = event.entity
        let lore = EntityMaid.toLore(maid);
        
        // 发出声音
        EntityMaid.playSound(maid, "thlm.camera_use");
        // 清除女仆
        maid.triggerEvent("despawn");
        // 输出照片
        let output_item = new ItemStack("touhou_little_maid:photo", 1);
        output_item.setLore(lore);
        maid.dimension.spawnItem(output_item, maid.location);
    }
    /**
     * 女仆被魂符收回事件
     * @param {DataDrivenEntityTriggerBeforeEvent} event 
     */
    static onSmartSlabRecycleEvent(event){
        let maid = event.entity;
        // 获取魂符物品
        let owner = EntityMaid.Owner.get(maid);
        if(owner === undefined) return;
        let item = Tool.getPlayerMainHand(owner);
        if(item === undefined || item.typeId !== "touhou_little_maid:smart_slab_empty") return;

        // 将女仆转为lore
        let lore = EntityMaid.toLore(maid);
        
        // 清除女仆
        maid.triggerEvent("despawn");

        // 修改魂符
        let new_itme = new ItemStack("touhou_little_maid:smart_slab_has_maid", 1)
        new_itme.setLore(lore);
        Tool.setPlayerMainHand(owner, new_itme);
    }

    /**
     * 照片使用事件
     * 当照片无 lore 或 使用者不为主人时，使用失败
     * @param {ItemDefinitionTriggeredBeforeEvent} event 
     */
    static photoOnUseEvent(event){
        let lore = event.itemStack.getLore();
        if(lore.length === 0) return; // 无lore
        let str="";
        for(let temp of lore){
            str += temp;
        }
        if(StrMaid.Owner.getId(str) !== event.source.id){
            // 使用者不是主人
            return;
        }

        let maid = EntityMaid.fromStr(str, event.source.dimension, event.source.location);
        maid.triggerEvent("api:reborn");
        Tool.setPlayerMainHand(event.source);
    }
    /**
     * 魂符使用事件
     * @param {ItemDefinitionTriggeredBeforeEvent} event 
     */
    static smartSlabOnUseEvent(event){
        let item = event.itemStack;
        let lore = item.getLore();
        // 生成女仆
        if(lore.length === 0){
            // 首次使用
            EntityMaid.spawnRandomMaid(event.source.dimension, event.source.location);
        }
        else{
            let str="";
            for(let temp of lore){
                str += temp;
            }
            if(StrMaid.Owner.getId(str) !== event.source.id){
                // 使用者不是主人
                return;
            }
            let maid = EntityMaid.fromStr(str, event.source.dimension, event.source.location);
            maid.triggerEvent("api:reborn");
        }
        // 转换物品
        Tool.setPlayerMainHand(event.source, new ItemStack("touhou_little_maid:smart_slab_empty", 1));
    }
    /**
     * 女仆驯服寻主事件
     * 因为 1.没有实体交互事件 2.实体触发器事件没有发动者 3.脚本无法获取主人 4.若与实体交互成功，则物品使用事件不会触发
     * 所以 让女仆自行紧跟主人并扫描，直到脚本获取到主人
     * 对于曾经有主人的女仆，当跟随到的主人与记录不符时会重新回到重生时的野生状态
     * @param {DataDrivenEntityTriggerBeforeEvent} event
     */
    static onTameFollowSuccess(event){
        const results = event.entity.dimension.getPlayers({
            maxDistance:2,
            location:event.entity.location
        })
        // 寻主成功
        if(results.length == 1){
            let maid = event.entity;
            let player = results[0];
            if(EntityMaid.Owner.getID(maid)===undefined || EntityMaid.Owner.getID(maid)===results[0].id){
                let backpack = EntityMaid.Backpack.getEntity(event.entity);
                maid.triggerEvent("api:follow_on_tame_over");
                EntityMaid.Owner.setID(maid, player.id);
                MaidBackpack.setOwnerID(backpack, player.id);
            }
            else{
                // 跟随到的主人与记录不符
                maid.triggerEvent("api:follow_on_tame_over_backreborn");
            }
            // 给予玩家一个苹果
            let apple = new ItemStack("minecraft:apple", 1);
            apple.nameTag="§cApple!"
            player.dimension.spawnItem(apple, player.location);
        }
    }
    /**
     * 主人与女仆交互事件
     * @param {DataDrivenEntityTriggerBeforeEvent} event
     */
    static onInteractEvent(event){
        let maid = event.entity;
        // Search for owner
        let pl_id = EntityMaid.Owner.getID(maid);
        if(pl_id!==undefined){
            let pl = world.getEntity(pl_id);
            // Send form
            UI.MainMenu(pl, event.entity);
            return true;
        }
        return false;
    }

    /**
     * 回家事件
     * @param {DataDrivenEntityTriggerBeforeEvent} event
     */
    static returnHomeEvent(event){
        // 比较维度
        let maid = event.entity;
        let home_location = EntityMaid.Home.getLocation(maid);
        if(home_location===undefined) return; // 没有家，不回
        Tool.logger(`${home_location[0]}, ${home_location[1]}, ${home_location[2]}, ${home_location[3]}`)
        let in_home = (maid.dimension.id===home_location[3]);
        if(in_home){
            // 计算范围
            in_home = Tool.pointInArea_2D(maid.location.x, maid.location.z,
                home_location[0] - HOME_RADIUS, home_location[2] - HOME_RADIUS,
                home_location[0] + HOME_RADIUS, home_location[2] + HOME_RADIUS);
        }
        // 维度不同或超出范围，回家
        if(!in_home){
            maid.teleport(new Vector(home_location[0]+0.5,home_location[1],home_location[2]+0.5),
                {dimension: world.getDimension(home_location[3])});
        }
    }
    /**
     * 模式切换为坐下，此时主人状态由潜行切换到站立
     * @param {DataDrivenEntityTriggerBeforeEvent} event
     */
    static sitModeEvent(event){
        let maid = event.entity;
        let bag = EntityMaid.Backpack.getEntity(maid);
        EntityMaid.dumpEntityBackpack(maid);// 转储
        // 恢复先前的拾物模式
        if(maid.getDynamicProperty("temp_pick")){
            // 因为此时必定是关闭状态，所以只有先前为开时需要设置
            EntityMaid.Pick.set(maid, true);
        }

        MaidBackpack.hide(bag);
    }
    /**
     * 模式切换为背包操作，此时主人状态由站立切换到潜行
     * @param {DataDrivenEntityTriggerBeforeEvent} event
     */
    static inventoryModeEvent(event){
        let maid = event.entity;
        let bag = EntityMaid.Backpack.getEntity(maid);

        let pick = EntityMaid.Pick.get(maid);
        maid.setDynamicProperty("temp_pick", pick);
        if(pick) EntityMaid.Pick.set(maid, false);

        EntityMaid.dumpMaidBackpack(maid);// 转储 女仆→背包实体
        // bag.nameTag = maid.nameTag===""?"entity.touhou_little_maid:maid.name":maid.nameTag;
        MaidBackpack.show(bag);
    }
    /**
     * 定时事件
     * @param {DataDrivenEntityTriggerBeforeEvent} event 
     */
    static timerEvent(event){
        let maid = event.entity;
        // 2步一次回血
        let healStep = maid.getDynamicProperty("heal_step");
        if(healStep >= 1){
            let healthComponent = EntityMaid.Health.getComponent(maid);
            if(healthComponent.currentValue < healthComponent.defaultValue){
                // 回血量 2~5
                healthComponent.setCurrentValue(
                    Math.min(healthComponent.defaultValue,
                    healthComponent.currentValue + Tool.getRandomInteger(2, 5)));
            }
            maid.setDynamicProperty("heal_step", 0);
        }
        else{
            maid.setDynamicProperty("heal_step", healStep+1);
        }
    }
    /**
     * 开盒，生成一只随机女仆
     * @param {DataDrivenEntityTriggerBeforeEvent} event
     */
    static boxOpenEvent(event){
        let box = event.entity;
        EntityMaid.spawnRandomMaid(box.dimension, box.location);
        EntityMaid.playSound(box, "thlm.box");
        box.triggerEvent("despawn");
    }
    /**
     * 坟墓受击
     * @param {DataDrivenEntityTriggerBeforeEvent} event
     */
    static graveAttackEvent(event){
        let backpack = event.entity;
        let backpackL = backpack.location;
        let owenerID = MaidBackpack.getOwnerID(backpack);
        if(owenerID !== undefined){
            // 当主人在附近时，在主人位置开包
            let owner = world.getEntity(owenerID);
            if(owner !== undefined){
                if(Tool.pointInArea_2D(owner.location.x, owner.location.z,
                    backpackL.x - 5, backpackL.z - 5, backpackL.x + 5, backpackL.z + 5)){
                        MaidBackpack.dump(backpack, owner.location);
                }
            }
        }
        else{
            // 没有主人id，所有人都可以开包
            MaidBackpack.dump(backpack, backpack.location);
        }
    }
    /**
     * 背包种类切换
     * @param {DataDrivenEntityTriggerBeforeEvent} event
     * @param {number} typeNew 1, 2, 3 
     */
    static backpackTypeChangeEvent(event, typeNew){
        let backpack = event.entity;
        let typeOld = MaidBackpack.getType(backpack);
        let dimension = backpack.dimension;
        let location = backpack.location;

        if(typeOld > typeNew){
            // 将多余的物品丢出
            let container = MaidBackpack.getContainer(backpack);
            for(let i = MaidBackpack.capacityList[typeNew]; i < MaidBackpack.capacityList[typeOld]; i++){
                let item = container.getItem(i);
                if(item !== undefined){
                    dimension.spawnItem(item, location);
                    container.setItem(i);
                }
            }
        }
        // 升级
        MaidBackpack.setType(backpack, typeNew);
        // 返还旧背包
        if(typeOld !== MaidBackpack.default){
            dimension.spawnItem(new ItemStack(MaidBackpack.type2ItemName(typeOld), 1), location);
        }
    }
}

