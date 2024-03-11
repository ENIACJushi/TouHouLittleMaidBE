import { ScriptEventCommandMessageAfterEvent, system } from "@minecraft/server";
import * as Tool from"../libs/scarletToolKit";
import { StrMaid } from "../maid/StrMaid";
import { MaidSkin } from "../maid/MaidSkin";
import { ConfigHelper } from "./Config";
import {EntityMaid} from '../maid/EntityMaid'

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
            case "thlm:test"    : this.test(event)   ; break;
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
                if(item === undefined){
                    source.sendMessage({rawtext: [{translate: "message.tlm.admin.item.void"}]});
                    return;
                }

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
                    default:{
                        source.sendMessage({rawtext: [{translate: "message.tlm.admin.item.not_supported"}]});
                        return;
                    }; break;
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
            default:{
                if(event.message.substring(0, 4)==="setm"){// 修改女仆信息
                    // 获取女仆
                    let source = event.sourceEntity;
                    if(source === undefined || source.typeId !== "minecraft:player") return;
                    let maid = source.dimension.getEntities({"location": source.location, "type": "thlmm:maid", "closest": 1})[0];
                    if(maid===undefined){
                        source.sendMessage({rawtext:[{translate: "message.tlm.admin.maid.not_found"}]});
                        return;
                    }

                    // 进行修改
                    let input = event.message.substring(4);
                    input = input.split(':');
                    if(input.length === 2){
                        switch(input[0]){
                            case "owner": { // 设置最近一个女仆的主人名称
                                EntityMaid.Owner.setName(maid, input[1]);
                                source.sendMessage({rawtext: [{translate: "message.tlm.admin.set.owner.success"}, {text: input[1]}]});
                            }; break;
                            case "level":{ // 设置最近一个女仆的等级
                                let value = undefined;
                                try{ value = parseInt(input[1]); } catch{ };
                                if(typeof(value)!=='number' || isNaN(value) || value < 1 || value > EntityMaid.Level.max){
                                    source.sendMessage({rawtext: [{translate: "message.tlm.admin.set.level.out_of_range"}]})
                                    return;
                                }
                                EntityMaid.Level.set(maid, value);
                                source.sendMessage({rawtext: [{translate: "message.tlm.admin.set.level.success"}, {text: value.toString()}]});
                                
                            }; break;
                            case "kill":{ // 设置最近一个女仆的杀敌数
                                let value = parseInt(input[1]);
                                if(value===undefined || value < 0){
                                    source.sendMessage({rawtext: [{translate: "message.tlm.admin.set.kill.out_of_range"}]})
                                    return;
                                }
                                EntityMaid.Kill.set(maid, value);
                                source.sendMessage({rawtext: [{translate: "message.tlm.admin.set.kill.success"}, {text: input[1]}]});
                            }; break;
                            default: {
                                let options = "owner, level, kill"
                                source.sendMessage({rawtext: [{translate: "message.tlm.admin.set.invalid"}, {text: options}]});
                                return;
                            }break;
                        }
                    }
                    else{
                        source.sendMessage({rawtext: [{translate: "message.tlm.admin.set.lack_colon"}]});
                        return;
                    }

                    // 修改后信息
                    system.runTimeout(()=>{// 等设置好了再展示
                        source.sendMessage({rawtext: [{translate: "message.tlm.admin.set.after"}]})
                        source.sendMessage({rawtext: EntityMaid.formatOutput(maid)});   
                    }, 2);
                }
                else if(event.message.substring(0, 4)==="seti"){// 修改物品信息
                    
                    // 获取物品
                    let source = event.sourceEntity;
                    if(source === undefined || source.typeId !== "minecraft:player") return;

                    let item = Tool.getPlayerMainHand(source);
                    if(item === undefined){
                        source.sendMessage({rawtext: [{translate: "message.tlm.admin.item.void"}]});
                        return;
                    }

                    switch(item.typeId){
                        // 三种存储女仆的道具
                        case "touhou_little_maid:smart_slab_has_maid":
                        case "touhou_little_maid:photo":
                        case "touhou_little_maid:film":{
                            // 拼接lore字符串
                            let lore = item.getLore();
                            let strLore="";
                            for(let temp of lore){ strLore += temp; }
                            let strPure = Tool.loreStr2Pure(strLore);

                            // 进行修改
                            let input = event.message.substring(4);
                            input = input.split(':');
                            if(input.length === 2){
                                switch(input[0]){
                                    case "owner": { // 设置最近一个女仆的主人名称
                                        strPure = StrMaid.Str.setOwnerName(strPure, input[1]);
                                        source.sendMessage({rawtext: [{translate: "message.tlm.admin.set.owner.success"}, {text: input[1]}]});
                                    }; break;
                                    case "level":{ // 设置最近一个女仆的等级
                                        let value = undefined;
                                        try{ value = parseInt(input[1]); } catch{ };
                                        if(typeof(value)!=='number' || isNaN(value) || value < 1 || value > EntityMaid.Level.max){
                                            source.sendMessage({rawtext: [{translate: "message.tlm.admin.set.level.out_of_range"}]})
                                            return;
                                        }
                                        strPure = StrMaid.Level.set(strPure, value);
                                        source.sendMessage({rawtext: [{translate: "message.tlm.admin.set.level.success"}, {text: value.toString()}]});
                                    }; break;
                                    case "kill":{ // 设置最近一个女仆的杀敌数
                                        let value = parseInt(input[1]);
                                        if(value===undefined || value < 0){
                                            source.sendMessage({rawtext: [{translate: "message.tlm.admin.set.kill.out_of_range"}]})
                                            return;
                                        }
                                        strPure = StrMaid.Kill.set(strPure, value);
                                        source.sendMessage({rawtext: [{translate: "message.tlm.admin.set.kill.success"}, {text: input[1]}]});
                                    }; break;
                                    default: {
                                        let options = "owner, level, kill"
                                        source.sendMessage({rawtext: [{translate: "message.tlm.admin.set.invalid"}, {text: options}]});
                                        return;
                                    }break;
                                }
                            }
                            else{
                                source.sendMessage({rawtext: [{translate: "message.tlm.admin.set.lack_colon"}]});
                                return;
                            }
                            item.setLore(EntityMaid.str2Lore(strPure));
                            Tool.setPlayerMainHand(source, item);

                            // 修改后信息
                            source.sendMessage({rawtext: [{translate: "message.tlm.admin.set.after"}]})
                            source.sendMessage({rawtext: StrMaid.formatOutput(strPure)});
                        }; break;
                        default:{
                            source.sendMessage({rawtext: [{translate: "message.tlm.admin.item.not_supported"}]});
                            return;
                        }break;
                    }
                }
            }; break;
        }
    }
    /**
     * 测试函数
     * @param {ScriptEventCommandMessageAfterEvent} event
     */
    static test(event){

        // 获取一个最近的女仆
        let source = event.sourceEntity;
        if(source === undefined || source.typeId !== "minecraft:player") return;

        let maid = source.dimension.getEntities({"location": source.location, "type": "thlmm:maid", "closest": 1})[0];
        if(maid===undefined){
            source.sendMessage({rawtext:[{translate: "message.tlm.admin.maid.not_found"}]});
            return;
        }

        // 清空动态属性
        maid.setDynamicProperty("home");
        maid.setDynamicProperty("home_dim");
        maid.setDynamicProperty("level");
        maid.setDynamicProperty("kill");
        maid.setDynamicProperty("pick");
    }
}