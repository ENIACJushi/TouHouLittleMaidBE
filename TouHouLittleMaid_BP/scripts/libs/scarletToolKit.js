  /* -------------------------------------------- *\
   *  Name        :  Scarlet Tool Kit             *
   *  Description :  Lazy                         *
   *  Author      :  ENIACJushi                   *
   *  Version     :  1.0                          *
   *  Date        :  2023.02.17                   *
  \* -------------------------------------------- */

import { world, Entity, Vector } from "mojang-minecraft";

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

export function getRandom(min = 0, max = 1){
    if(min < max) return (min + Math.random() * (max - min));
    else return null;
}

export function logger(str){
    world.getDimension("overworld").runCommand(`tellraw @a { "rawtext": [ { "text": "${str}" } ] }`);
}
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

