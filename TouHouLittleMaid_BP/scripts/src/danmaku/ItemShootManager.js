/**
 * 管理物品发射弹幕
 *  发射弹幕时触发物品事件 thlm:is
 *  弹幕与物品一一对应，在定义文件中
 *   id 定义物品完整 typeId
 *   shoot 定义发射函数，接收发射实体 entity 和物品 item
 *  定义文件需要在 ItemShootManager constructor 中注册
 */
import { GoheiCherry } from "./item/GoheiCherry"

import { ItemUseAfterEvent } from "@minecraft/server";
import * as Tool from "../libs/scarletToolKit"

export class ItemShootManager{
    constructor(){
        this.map = {};
        this.register(GoheiCherry)
    }
    register(data){
        this.map[data.id] = data.shoot;
    }
    /**
     * 吓我一跳释放符卡
     * @param {ItemUseAfterEvent} event
     */
    itemShootEvent(event){
        let item = event.itemStack;
        let player = event.source;
        let group_function = this.map[item.typeId];

        if(group_function !== undefined){
            group_function(player, item);
            return true;
        }
        return false;
    }
}
export const itemShootManager = new ItemShootManager();