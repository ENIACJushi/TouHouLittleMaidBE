  /* -------------------------------------------- *\
   *  Name        :  Scarlet Tool Kit             *
   *  Description :  Lazy                         *
   *  Author      :  ENIACJushi                   *
   *  Version     :  1.0                          *
   *  Date        :  2023.02.17                   *
  \* -------------------------------------------- */

import { world, Entity, Vector, Dimension } from "mojang-minecraft";

////////// Logger //////////
export function logger(str){
    world.getDimension("overworld").runCommand(`tellraw @a { "rawtext": [ { "text": "${str}" } ] }`);
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


////////// Experiment //////////
/**
 * Test Entity Speed
 * Put it into tick event.
 */
export function testEntitySpeed(){
    for(let pl of world.getPlayers()){
        const playerQueryOptions = new EntityQueryOptions();
        playerQueryOptions.type = 'minecraft:xp_orb';
        playerQueryOptions.maxDistance = 10;
        playerQueryOptions.location = pl.location;
        const results = pl.dimension.getEntities(playerQueryOptions);
        for(let en of results){
            Tool.logger(`${en.velocity.x.toFixed(3)}, ${en.velocity.y.toFixed(3)}, ${en.velocity.z.toFixed(3)}`);
        }
    }
}

/**
 * Test Entity MAX and MIN speed (abs).
 * 
 * Used in spawn event:
 * scheduling.setTickTimeout(() =>{ 
        Tool.testEntityMSpeed(entity);
    }, 1, "test");
 */
var vec = [0,0,0];
var vecn = [10,10,10];
export function testEntityMSpeed(entity){
    let x = Math.abs(entity.velocity.x.toFixed(3));
    let y = Math.abs(entity.velocity.y.toFixed(3));
    let z = Math.abs(entity.velocity.z.toFixed(3));
    
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
 * Test Block Info
 * Put it into beforeItemUseOn event.
 * @param {Dimension} dimension 
 * @param {BlockLocation} blockLocation 
 */
export function testBlockInfo(dimension, blockLocation){
    try{
        const bl = dimension.getBlock(blockLocation);
        var block_p = bl.permutation;
        logger(`touhou_little_maid:rotation ${block_p.getProperty("touhou_little_maid:rotation").value}`);
        logger(`touhou_little_maid:number ${block_p.getProperty("touhou_little_maid:number").value}`);
        logger(bl.id);
    }
    catch{}
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

/**
 * Give a random velocity vector to an entity.
 * @param {Entity} entity 
 * @param {Int[2]} rangeX
 * @param {Int[2]} rangeY
 * @param {Int[2]} rangeZ
 */
export function setVelocityRandomly(entity, rangeX, rangeY = rangeX, rangeZ = rangeX){
    entity.setVelocity(new Vector(getRandom(rangeX[0], rangeX[1]), getRandom(rangeY[0], rangeY[1]), getRandom(rangeZ[0], rangeZ[1])));
}
