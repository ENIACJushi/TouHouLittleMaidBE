
// 发射弹幕的物品命名规则 thlmd:xxx_xx前一个xxx是名称，后一个是编号
// 发射弹幕时触发事件thlm:is
import { Gossip } from "./item/Gossip";
import { ItemDefinitionTriggeredBeforeEvent } from "@minecraft/server";
import * as Tool from "../libs/scarletToolKit"

export class ItemShootManager{
    constructor(){
        this.map = {};
        this.register(Gossip);
    }
    register(data){
        this.map[data.id] = data.shoot;
    }
    /**
     * 吓我一跳释放符卡
     * @param {ItemDefinitionTriggeredBeforeEvent} event
     */
    itemShootEvent(event){
        let item = event.itemStack;
        let player = event.source;
        let group = item.typeId.substring(6).split("_");
        let group_function = this.map[group[0]];
        if(group_function !== undefined){
            group_function[parseInt(group[1])](player);
            return true;
        }
        return false;
    }
}
export const itemShootManager = new ItemShootManager();