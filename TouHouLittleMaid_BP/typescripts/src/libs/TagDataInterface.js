import { Entity } from "@minecraft/server";

/**
 * 获取tag数据 最多获取一个
 * @param {Entity} entity 
 * @param {string} prefix like "thlmo:"
 * @returns {string|undefined}
 */
export function get(entity, prefix){
    let length = prefix.length;
    for(let tag of entity.getTags()){
        if(tag.substring(0, length) == prefix){
            return tag.substring(length);
        }
    }
    return undefined;
}
/**
 * 设置tag数据
 * @param {Entity} entity 
 * @param {string} prefix like "thlmo:"
 * @param {string} data
 */
export function set(entity, prefix, data){
    del(entity, prefix)
    entity.addTag(`${prefix}${data}`);
}

/**
 * 删除tag数据 最多删除一个
 * @param {Entity} entity 
 * @param {string} prefix like "thlmo:"
 * @returns {boolean} 是否有tag被删除
 */
export function del(entity, prefix){
    let length = prefix.length;
    for(let tag of entity.getTags()){
        if(tag.substring(0, length) == prefix){
            entity.removeTag(tag);
            return true;
        }
    }
    return false;
}