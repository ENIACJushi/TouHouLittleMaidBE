import { ScriptEventCommandMessageAfterEvent } from "@minecraft/server";
import * as Tool from"../libs/scarletToolKit";
import { StrMaid } from "../maid/StrMaid";
import { MaidSkin } from "../maid/MaidSkin";
import { ConfigHelper } from "./Config";

export class CommandManager{
    /**
     * 
     * @param {ScriptEventCommandMessageAfterEvent} event 
     * @returns 
     */
    static scriptEvent(event){
        // 不要求使用者为玩家的命令，返回值均在世界范围广播
        switch(event.id){
            case "thlm:skin_set": this.setSkin(event); break;
            case "thlm:config"  : this.config(event) ; break;
            case "thlm:admin"   : this.admin(event)  ; break;
            default: break;
        }
    }
    /**
     * 设置皮肤包
     *  scriptevent thlm:skin_set 6,19,20
     * @param {ScriptEventCommandMessageAfterEvent} event 
     */
    static setSkin(event){
        let strList = event.message.split(",");
        let numList = [];
        for(let str of strList){
            Tool.logger(str);
            numList.push(parseInt(str));
        }
        MaidSkin.setSkin(numList);
        
        Tool.logger(`Add skin: ${numList}`);
    }
    /**
     * 修改配置项
     *  scriptevent thlm:config danmaku_damage:600
     * @param {ScriptEventCommandMessageAfterEvent} event 
     */
    static config(event){
        try{
            let strList = event.message.split(":");
            if(strList.length===1){
                switch(event.message){
                    case "show":
                        if(event.sourceEntity !== undefined){
                            event.sourceEntity.runCommand(`tellraw @s {"rawtext":[{"text": "${ConfigHelper.tostring()}"}]}`);
                        }
                        
                        break;
                    default: Tool.logger("Unknown config command."); break;
                }
            }
            else{
                let value = parseInt(strList[1])
                ConfigHelper.set(strList[0], value)
                Tool.logger(`Config set: ${strList[0]} - ${value}`);
            }
        }
        catch{
            Tool.logger("Invalid config command.");
        }
    }
    /**
     * 管理用指令
     * @param {ScriptEventCommandMessageAfterEvent} event
     */
    static admin(event){
        switch(event.message){
            case "iteminfo":{// 获取手持物品的信息 必须由玩家执行
                let source = event.sourceEntity;
                if(source === undefined || source.typeId !== "minecraft:player") return;

                let item = Tool.getPlayerMainHand(source);
                if(item === undefined) return;

                switch(item.typeId){
                    // 三种存储女仆的道具
                    case "touhou_little_maid:smart_slab_has_maid":
                    case "touhou_little_maid:photo":
                    case "touhou_little_maid:film":
                        // 拼接lore字符串
                        let lore = item.getLore();
                        let strLore="";
                        for(let temp of lore){ strLore += temp; }
                        let strPure = Tool.loreStr2Pure(strLore);
                        source.sendMessage(
                            {rawtext:StrMaid.formatOutput(strPure)});
                        break;
                    default:
                        break;
                }
            }; break;
            case "maidinfo":{// 获取最近的一个女仆的信息 必须由玩家执行
                let source = event.sourceEntity;
                if(source === undefined || source.typeId !== "minecraft:player") return;

                let maid = source.dimension.getEntities({"location": source.location, "type": "thlmm:maid", "closest": 1})[0];
                if(maid===undefined){
                    source.sendMessage({rawtext:[{translate: "message.tlm.admin.maid.not_found"}]});
                    return;
                }
                
                source.sendMessage({rawtext: EntityMaid.formatOutput(maid)});
            }; break;
            case "setowner":{// 设置最近一个女仆的主人id
                
            }; break;
            case "setlevel":{// 设置最近一个女仆的等级

            }; break;
            case "setkill":{// 设置最近一个女仆的杀敌数

            }; break;
            default: break;
        }
    }
}