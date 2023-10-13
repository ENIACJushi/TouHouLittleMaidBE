/**
 * 女仆tag
 * thlmo:<主人生物id>
 * thlmh:<家坐标x>,<家坐标y>,<家坐标z>,<维度> (整数)
 * thlmb:<背包生物id>
 */
/**
 * 其它tag
 * 背包：thlmb:<女仆id>
 */
import { ItemStack, world, Entity,Vector, DataDrivenEntityTriggerBeforeEvent, ItemDefinitionTriggeredBeforeEvent, system } from "@minecraft/server";
import * as Tool from "../libs/scarletToolKit"
import * as UI from "./MaidUI"
import { EntityMaid } from './EntityMaid';
import { MaidBackpack } from "./MaidBackpack";

const HOME_RADIUS=25;

export class MaidManager{
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
                    EntityMaid.setBackpackID(maid, backpack.id);
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
        let lore = EntityMaid.toLore(event.entity);
        let output_item = new ItemStack("touhou_little_maid:film", 1);
        output_item.setLore(lore);
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
        Tool.executeCommand(`playsound camera_use @a ${maid.location.x} ${maid.location.y} ${maid.location.z}`);
        
        // 清除实体
        maid.triggerEvent("despawn");
        let backpack=EntityMaid.getBackpackEntity(maid);
        if(backpack!=undefined){
            MaidBackpack.setInvisible(backpack, true);
        }

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
        let owner = EntityMaid.getOwner(maid);
        if(owner === undefined) return;
        let item = Tool.getPlayerMainHand(owner);
        if(item === undefined || item.typeId !== "touhou_little_maid:smart_slab_empty") return;

        // 将女仆转为lore
        let lore = EntityMaid.toLore(maid);
        
        // 清除实体
        maid.triggerEvent("despawn");
        let backpack=EntityMaid.getBackpackEntity(maid);
        if(backpack!=undefined){
            MaidBackpack.setInvisible(backpack, true);
        }

        // 修改魂符
        let new_itme = new ItemStack("touhou_little_maid:smart_slab_has_maid", 1)
        new_itme.setLore(lore);
        Tool.setPlayerMainHand(owner, new_itme);
    }

    /**
     * 照片使用事件
     * @param {ItemDefinitionTriggeredBeforeEvent} event 
     */
    static photoOnUseEvent(event){
        EntityMaid.fromItem(event.itemStack, event.source.dimension, event.source.location);
        Tool.setPlayerMainHand(event.source);
    }
    /**
     * 魂符使用事件
     * @param {ItemDefinitionTriggeredBeforeEvent} event 
     */
    static smartSlabOnUseEvent(event){
        let item = event.itemStack;
        // 生成女仆
        if(item.getLore().length === 0){
            // 首次使用
            EntityMaid.spawnRandomMaid(event.source.dimension, event.source.location);
        }
        else{
            EntityMaid.fromItem(event.itemStack, event.source.dimension, event.source.location);
        }
        // 转换物品
        Tool.setPlayerMainHand(event.source, new ItemStack("touhou_little_maid:smart_slab_empty", 1));
    }
    /**
     * 女仆驯服寻主事件
     * 因为 1.没有实体交互事件 2.实体触发器事件没有发动者 3.脚本无法获取主人 4.若与实体交互成功，则物品使用事件不会触发
     * 所以 让女仆自行紧跟主人并扫描，直到脚本获取到主人
     * @param {DataDrivenEntityTriggerBeforeEvent} event 
     */
    static onTameFollowSuccess(event){
        const results = event.entity.dimension.getPlayers({
            maxDistance:2,
            location:event.entity.location
        })
        // 寻主成功
        if(results.length == 1){
            event.entity.triggerEvent("api:follow_on_tame_over");
            EntityMaid.setOwnerID(event.entity, results[0].id);
        }
    }
    /**
     * 主人与女仆交互事件
     * @param {DataDrivenEntityTriggerBeforeEvent} event
     */
    static onInteractEvent(event){
        let maid = event.entity;

        // Search for owner
        let pl_id = EntityMaid.getOwnerID(maid);
        if(pl_id!==undefined){
            let pl = world.getEntity(pl_id);
            // Send form
            let form = new UI.MaidMenu(pl, event.entity);
            form.main();
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
}

