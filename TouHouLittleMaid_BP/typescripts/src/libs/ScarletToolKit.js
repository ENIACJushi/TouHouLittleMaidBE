  /* -------------------------------------------- *\
   *  Name        :  Scarlet Tool Kit             *
   *  Description :  Lazy                         *
   *  Author      :  ENIACJushi                   *
   *  Version     :  1.0                          *
   *  Date        :  2023.02.17                   *
  \* -------------------------------------------- */

import { 
    world, 
    Entity, 
    Dimension,
    Player, 
    ItemStack, 
    EquipmentSlot, 
    Block,
} from "@minecraft/server";
import { Vector } from "./VectorMC";
import { config } from "../controller/Config";

////////// Math //////////
/**
 * 获取一个随机值
 * @param {number} a 
 * @param {number} b 
 * @returns {number}
 */
export function getRandom(a = 0, b = 1){
    if (a < b) return (a + Math.random() * (b - a));
    else return (b + Math.random() * (a - b));
}
/**
 * 获取随机整数 两边都是闭区间
 * @param {number} min 
 * @param {number} max 
 * @returns 
 */
export function getRandomInteger(min=0, max=1){
    return min + Math.floor(Math.random() * (max+1))
}

export function raduis2angle(raduis){
    return raduis*(180/Math.PI);
}

export function angle2raduis(angle){
    return angle*(Math.PI/180);
}
// 判断坐标是否在某区域内 (2D, 包含边界)
export function pointInArea_2D(x,z,areaStart_x,areaStart_z,areaEnd_x,areaEnd_z){
    if(areaStart_x < areaEnd_x){
        if(x < areaStart_x || areaEnd_x < x){
            return false;
        }
    }
    else{
        if(x < areaEnd_x || areaStart_x < x){
            return false;
        }
    }
    if(areaStart_z < areaEnd_z){
        if(z < areaStart_z || areaEnd_z < z){
            return false;
        }
    }
    else{
        if(z < areaEnd_z || areaStart_z < z){
            return false;
        }
    }
    return true;

}
export function pointInArea_3D(x,y,z,areaStart_x,areaStart_y,areaStart_z,areaEnd_x,areaEnd_y,areaEnd_z){
    if(areaStart_x < areaEnd_x){
        if(x < areaStart_x || areaEnd_x < x){
            return false;
        }
    }
    else{
        if(x < areaEnd_x || areaStart_x < x){
            return false;
        }
    }
    if(areaStart_y < areaEnd_y){
        if(y < areaStart_y || areaEnd_y < y){
            return false;
        }
    }
    else{
        if(y < areaEnd_y || areaStart_y < y){
            return false;
        }
    }
    if(areaStart_z < areaEnd_z){
        if(z < areaStart_z || areaEnd_z < z){
            return false;
        }
    }
    else{
        if(z < areaEnd_z || areaStart_z < z){
            return false;
        }
    }
    return true;
}
////////// Tool//////////
export class ItemTool {
    /**
     * 设置玩家主手物品
     * @param {Player} player
     * @param {?ItemStack} item
     */
    static setPlayerMainHand(player, item=undefined){
        let container = player.getComponent("inventory").container;
        let slot = player.selectedSlotIndex;
        if(item===undefined){
            container.setItem(slot);
        }
        else{
            container.setItem(slot, item);
        }
    }
    /**
     * 获取玩家主手物品
     * @param {Player} player
     * @returns {ItemStack|undefined} 
     */
    static getPlayerMainHand(player){
        let container = player.getComponent("inventory").container;
        let slot = player.selectedSlotIndex;
        // pl.getComponent("equippable").getEquipment(EquipmentSlot.Mainhand);
        return container.getItem(slot);
    }
    /**
     * 减少玩家主手装备的耐久
     * @param {Player} player 
     * @param {Number} amount 
     */
    static decrementMainHandStack(player, amount=1){
        // 获取物品
        let container = player.getComponent("inventory").container;
        let slot = player.selectedSlotIndex;

        let item = container.getItem(slot);
        item = item.amount - amount <= 0 ? undefined : (item.amount-=amount, item);

        container.setItem(slot, item);
    }
    /**
     * 损耗玩家主手物品 带耐久判定
     * @param {Player} player
     */
    static damageMainHandStack(player){
        let equippable = player.getComponent("minecraft:equippable");
        let item = equippable.getEquipment(EquipmentSlot.Mainhand);

        let unbreaking = 0;
        let enchantable = item.getComponent("enchantable");
        if(enchantable!==undefined){
            let temp = enchantable.getEnchantment("unbreaking");
            if(temp !== undefined){
                unbreaking = temp.level;
            }
        }
        if(unbreaking === 0 || getRandomInteger(0, unbreaking.level) === 0){
            // 磨损概率 1/(1+level)
            let damage = item.getComponent("durability").damage + 1;
            if(damage >= item.getComponent("durability").maxDurability){
                equippable.setEquipment(EquipmentSlot.Mainhand);
            }
            item.getComponent("durability").damage = damage;
            equippable.setEquipment(EquipmentSlot.Mainhand, item);
        }
    }
    /**
     * 损耗物品 带耐久判定
     * @param {ItemStack} item
     * @returns {ItemStack | undefined}
     */
    static damageItem (item) {
        let unbreaking = 0;
        let enchantable = item.getComponent("enchantable");
        if(enchantable !== undefined){
            let temp = enchantable.getEnchantment("unbreaking");
            if(temp !== undefined){
                unbreaking = temp.level;
            }
        }
        if(unbreaking === 0 || getRandomInteger(0, unbreaking.level) === 0){
            // 磨损概率 1/(1+level)
            let damage = item.getComponent("durability").damage + 1;
            if(damage >= item.getComponent("durability").maxDurability){
                return undefined;
            }
            item.getComponent("durability").damage = damage;
        }
        return item;
    }
}

export class BlockTool {
    /**
     * 在方块位置执行命令
     * @param {Block} b 
     * @param {String} cmd 
     */
    static runCommand(b, cmd){
        const l = b.location;
        b.dimension.runCommand(
            `execute positioned ${l.x} ${l.y} ${l.z} run ${cmd}`
        )
    }
}

/**
 * 返回 rawtext
 * @param {string} key 
 * @returns {object}
 */
export function lang(key) {
    return { rawtext: [{translate: key}]}
}
/**
 * 将维度字符转为数字
 * @param {string} name
 * @param {number|undefined} 
 */
export function dim_string2int(name){
    switch(name){
        case "minecraft:overworld": return 0;
        case "minecraft:nether": return 1;
        case "minecraft:the_end": return 2;
        default: return undefined;
    }
}
/**
 * 将维度数字转为字符
 * @param {number} index
 * @param {string|undefined} 
 */
export function dim_int2string(index){
    switch(index){
        case 0: return "minecraft:overworld";
        case 1: return "minecraft:nether";
        case 2: return "minecraft:the_end";
        default: return undefined;
    }
}

/**
 * 将纯净字符串转为隐形lore字符串
 * @param {string} str 
 */
export function str2Hide(strPure){
    let strLore = "";
    for(let i=0; i<strPure.length; i++){
        strLore += '§' + strPure[i];
    }
    return strLore;
}
/**
 * 将纯净字符串转为隐形物品lore
 * @param {string} strPure 
 * @returns {string[]}
 */
export function str2Lore(strPure){
    let strLore = str2Hide(strPure);
    let lore =[];
    while(true){
        if(strLore.length > 50){
            lore.push(strLore.slice(0, 50));
            strLore = strLore.slice(50);
        }
        else{
            lore.push(strLore);
            break;
        }
    }
    return lore;
}
/**
 * 将隐形lore字符串转为纯净字符串
 * @param {string[]} str 
 */
export function lore2Str(lore){
    // 拼接
    let strLore="";
    for(let temp of lore){ strLore += temp; };

    // 转换
    let strPure = "";
    for(let i=1; i<strLore.length; i+=2){
        strPure += strLore[i];
    }
    return strPure;
}
////////// Command //////////
/**
 * 
 * @param {string} name 
 * @returns 
 */
export function playerCMDName(name){
    if (name.indexOf(' ') != -1) {
        return '"' + name + '"'
    }
    return name;
}

export function executeCommand(cmd){
    world.getDimension("overworld").runCommand(cmd);
}

export function title_player_actionbar(name, text){
    world.getDimension("overworld").runCommand(`title ${playerCMDName(name)} actionbar ${text}`);
}

export function title_player_actionbar_translate(name, text){
    world.getDimension("overworld").runCommand(`titleraw ${playerCMDName(name)} actionbar {"rawtext":[{"translate":"${text}"}]}`);
}

export class ActionbarMessage{
    /**
     * 发送一条物品栏上方的翻译信息
     * @param {Player} pl 
     * @param {string} key 
     */
    static translate(pl, key){
        pl.dimension.runCommand(`titleraw ${playerCMDName(pl.name)} actionbar {"rawtext":[{"translate":"${key}"}]}`);
    }
    /**
     * 发送一条物品栏上方的文本信息
     * @param {Player} pl 
     * @param {string} text 
     */
    static text(pl, text){
        pl.runCommand(`titleraw @s actionbar {"rawtext":[{"text":"${text}"}]}`);
    }
    /**
     * 发送一条物品栏上方的rawtext信息
     * @param {Player} pl 
     * @param {Object} object 
     */
    static text(pl, object){
        pl.dimension.runCommand(`titleraw ${playerCMDName(name)} actionbar ${JSON.stringify(object)}`);
    }
}

export function title_player_actionbar_object(name, object){
    world.getDimension("overworld").runCommand(`titleraw ${playerCMDName(name)} actionbar ${JSON.stringify(object)}`);
}


////////// Experiment //////////
/**
 * Test Entity Speed
 * Put it into tick event.
 */
export function testEntitySpeed(){
    for(let pl of world.getPlayers()){
        const results = pl.dimension.getEntities({
            type: 'minecraft:xp_orb',
            maxDistance: 10,
            location: pl.location
        });
        for(let en of results){
            Logger.info(`${en.getVelocity().x.toFixed(3)}, ${en.getVelocity().y.toFixed(3)}, ${en.getVelocity().z.toFixed(3)}`);
        }
    }
}

/**
 * Test Entity MAX and MIN speed (abs).
 * 
 * Used in spawn event:
 * Tool.testEntityMSpeed(entity);
 */
var vec = [0,0,0];
var vecn = [10,10,10];
export function testEntityMSpeed(entity){
    let x = Math.abs(entity.getVelocity().x.toFixed(3));
    let y = Math.abs(entity.getVelocity().y.toFixed(3));
    let z = Math.abs(entity.getVelocity().z.toFixed(3));
    
    vec[0] = Math.max(vec[0], x);
    vec[1] = Math.max(vec[1], y);
    vec[2] = Math.max(vec[2], z);

    vecn[0] = Math.min(vecn[0], x);
    vecn[1] = Math.min(vecn[1], y);
    vecn[2] = Math.min(vecn[2], z);

    Logger.info(`MAX: ${vec[0]}, ${vec[1]}, ${vec[2]}`);
    Logger.info(`MIN: ${vecn[0]}, ${vecn[1]}, ${vecn[2]}`);
}

/**
 * @param {Entity} en 
*/
export function showEntityComponents(en){
    Logger.info(`Entity type:${en.typeId}`);
    for(let component of en.getComponents()){
        Logger.info(component.typeId);
    }
}
/**
 * Test Block Info
 * Put it into beforeItemUseOn event.
 * @param {Dimension} dimension 
 * @param {Vector} blockLocation 
 */
export function testBlockInfo(dimension, blockLocation){
    const bl = dimension.getBlock(blockLocation);
    var block_p = bl.permutation;
    var states = block_p.getAllStates();
    for(let s in states){
        Logger.info(`${s} -- ${block_p.getState(s)}`);
    }
}


////////// Useless //////////
/**
 * Send message to an entity.
 * @param {*} entity 
 * @param {*} str 
 * @param {*} mode 0: Chat bar  1: Action bar title 
 */
export function sendMessage2Entity(entity, str, mode = 0, translate = false){
    let textObject = translate ? "translate": "text";
    switch(mode){
        default: entity.runCommand(`tellraw @s {"rawtext":[{"${textObject}": "${str}"}]}`); break;
        case 1 : entity.runCommand(`titleraw @s actionbar {"rawtext":[{"${textObject}":"${str}"}]}`); break;
    }
}
