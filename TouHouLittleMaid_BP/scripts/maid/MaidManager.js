/**
 * thlmo:<主人生物id>
 * thlmh:<家坐标x>,<家坐标y>,<家坐标z>,<维度> (整数)
 */
import { world, Entity,Vector, DataDrivenEntityTriggerBeforeEvent, ItemDefinitionTriggeredBeforeEvent } from "@minecraft/server";
import * as Tool from "../libs/scarletToolKit"
import * as UI from "./MaidUI"
import { EntityMaid } from './EntityMaid';

const HOME_RADIUS=25;

export class MaidManager{
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
            event.entity.addTag(`thlmo:${results[0].id}`); // 记录主人id - touhou little maid owner
        }
    }
    /**
     * 主人与女仆交互事件
     * @param {DataDrivenEntityTriggerBeforeEvent} event
     */
    static onInteractEvent(event){
        // Search for owner
        let pl;
        for(let tag of event.entity.getTags()){
            if(tag.substring(0, 6) == "thlmo:"){
                pl = world.getEntity(tag.substring(6));
                // Send form
                let form = new UI.MaidMenu(pl, event.entity);
                form.main();
                break;
            }
        }
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

