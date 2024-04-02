  /* -------------------------------------------- *\
   *  Name        :  Scarlet Tool Kit             *
   *  Description :  Lazy                         *
   *  Author      :  ENIACJushi                   *
   *  Version     :  1.0                          *
   *  Date        :  2023.02.17                   *
  \* -------------------------------------------- */

import { world, Entity, Vector, Dimension,Player, ItemStack } from "@minecraft/server";


////////// Logger //////////
export function logger(str){
    
    for(let pl of world.getPlayers()){
        pl.sendMessage({rawtext:[{"text": `${str}`}]})
    }
}
export function error(str, position=undefined){
    let msg = `§e[THLM] §cError: ${str}`
    if(position!==undefined){
        msg += `\n§a At ${position}`
    }
    logger(msg);
}
const debug = true;
export function logger_debug(str){
    if(!debug) return;
    world.getDimension("overworld").runCommand(`tellraw @a { "rawtext": [ { "text": "${str}" } ] }`);
}


////////// Math //////////
export function getRandom(min = 0, max = 1){
    if(min < max) return (min + Math.random() * (max - min));
    else return null;
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
/**
 * 获取玩家主手物品
 * @param {Player} player
 * @returns {ItemStack|undefined} 
 */
export function getPlayerMainHand(player){
    let container = player.getComponent("inventory").container;
    let slot = player.selectedSlot;
    return container.getItem(slot);
}
/**
 * 设置玩家主手物品
 * @param {Player} player
 * @param {?ItemStack} item
 */
export function setPlayerMainHand(player, item=undefined){
    let container = player.getComponent("inventory").container;
    let slot = player.selectedSlot;
    if(item===undefined){
        container.setItem(slot);
    }
    else{
        container.setItem(slot, item);
    }
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
            Tool.logger(`${en.getVelocity().x.toFixed(3)}, ${en.getVelocity().y.toFixed(3)}, ${en.getVelocity().z.toFixed(3)}`);
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

    Tool.logger(`MAX: ${vec[0]}, ${vec[1]}, ${vec[2]}`);
    Tool.logger(`MIN: ${vecn[0]}, ${vecn[1]}, ${vecn[2]}`);
}

/**
 * @param {Entity} en 
*/
export function showEntityComponents(en){
    logger(`Entity type:${en.typeId}`);
    for(let component of en.getComponents()){
        logger(component.typeId);
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
        logger(`${s} -- ${block_p.getState(s)}`);
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
