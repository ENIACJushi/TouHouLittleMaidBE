import { BlockComponentTypes, ItemStack, ScriptEventCommandMessageAfterEvent, system } from "@minecraft/server";
import * as Tool from"../libs/ScarletToolKit";
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
            case "thlm:info"    : this.info(event)   ; break;
            case "thlm:debug"   : this.debug(event)  ; break;
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

                let item = Tool.ItemTool.getPlayerMainHand(source);
                if(item === undefined){
                    source.sendMessage({rawtext: [{translate: "message.tlm.admin.item.void"}]});
                    return;
                }

                switch(item.typeId){
                    // 三种存储女仆的道具
                    case "touhou_little_maid:smart_slab_has_maid":
                    case "touhou_little_maid:photo":
                    case "touhou_little_maid:film":
                        // 转换lore
                        let lore = item.getLore();
                        let strPure = Tool.lore2Str(lore);
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

                    let item = Tool.ItemTool.getPlayerMainHand(source);
                    if(item === undefined){
                        source.sendMessage({rawtext: [{translate: "message.tlm.admin.item.void"}]});
                        return;
                    }

                    switch(item.typeId){
                        // 三种存储女仆的道具
                        case "touhou_little_maid:smart_slab_has_maid":
                        case "touhou_little_maid:photo":
                        case "touhou_little_maid:film":{
                            // 转换lore
                            let lore = item.getLore();
                            let strPure = Tool.lore2Str(lore);

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
                            item.setLore(Tool.str2Lore(strPure));
                            Tool.ItemTool.setPlayerMainHand(source, item);

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
        let pl = event.sourceEntity;
        Tool.logger("test")
        pl.postClientMessage("id", "value")
    }
    /**
     * 发烟测试
     * @param {ScriptEventCommandMessageAfterEvent} event
     */
    static debug(event){
        let pl = event.sourceEntity;
        
        let itemList = [
            "touhou_little_maid:power_point",
            "thlmm:maid_spawn_egg",
            "minecraft:cake",
            "touhou_little_maid:maid_backpack_big",
            "touhou_little_maid:maid_backpack_middle",
            "touhou_little_maid:maid_backpack_small",
            "touhou_little_maid:camera",
            "touhou_little_maid:chisel",
            "minecraft:clay",
            "minecraft:flint_and_steel",
            "minecraft:netherrack",
            // "touhou_little_maid:film",
            // "touhou_little_maid:garage_kit",
            "touhou_little_maid:npc_tool",
            "touhou_little_maid:photo",
            // "touhou_little_maid:smart_slab_empty",
            "touhou_little_maid:smart_slab_has_maid",

            "touhou_little_maid:fairy_spawn_egg",
            "touhou_little_maid:fairy_headwear_0",
            "touhou_little_maid:warden_skull",

            "touhou_little_maid:hakurei_gohei_crafting_table",
            "touhou_little_maid:hakurei_gohei_cherry",
            
            "thlms:border_sign.boundary_between_wave_and_particle",
            "thlms:boundary_between_wave_and_particle_3d",
            "thlms:gossip",
            "thlms:magic_sign.milky_way",
            "thlms:metal_sign.metal_fatigue",
            "thlms:night_sign.night_bird",
            
            "touhou_little_maid:dragon_skull",
            "touhou_little_maid:gold_microwaver_item",
            "touhou_little_maid:magic_powder",
            "touhou_little_maid:memorizable_gensokyo"
        ]

        for(let item of itemList){
            pl.dimension.spawnItem(new ItemStack(item, 1), pl.location);
        }
    }
    /**
     * 信息函数
     * @param {ScriptEventCommandMessageAfterEvent} event
     */
    static info(event){
        let pl = event.sourceEntity;
        
        // 视线方块
        let block = pl.getBlockFromViewDirection().block;
        if(block!==undefined){
            let info = `block: ${block.typeId}`;
            let states = block.permutation.getAllStates()
            for(let key in states){
                info += `\n ${key} - ${states[key]}`;
            }
            pl.sendMessage(info);
        }
        // let blockInv = block.getComponent(BlockComponentTypes.Inventory);
        // if(blockInv !== undefined){
        //     let container = blockInv.container;
        //     if(container !== undefined){
        //         for(let i = 0; i < container.size; i++){
        //             let item = container.getItem(i);
        //             if(item !== undefined){
        //                 Tool.logger(`${item.typeId} ${item.amount}`);
        //             }
        //         }
        //     }
        // }
        // 手持物品
        let item = Tool.ItemTool.getPlayerMainHand(pl);
        if(item!==undefined) pl.sendMessage(`item: ${item.typeId}`);
        
    }
}