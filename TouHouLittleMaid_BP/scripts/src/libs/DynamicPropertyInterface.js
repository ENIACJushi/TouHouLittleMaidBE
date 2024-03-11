import { Entity, Vector } from "@minecraft/server";
import * as Tag from "./TagDataInterface"

/**
 * 获取值
 * @param {Entity} entity 
 * @param {string} key 
 * @param {string} type string | int | float | boolean | Vector3
 */
function get(entity, key, type){
    let propertyValue = entity.getDynamicProperty(key);
    if(propertyValue === undefined){
        let tagValue = Tag.get(entity, key + ':');
        if(tagValue !== undefined){
            // 转换类型
            switch(type){
                case "int": {
                    tagValue = parseInt(tagValue);
                }; break;
                case "float": {
                    tagValue = parseFloat(tagValue);
                }; break;
                case "boolean": {
                    tagValue = tagValue === "1" ? true : false;
                }; break;
                case "vector": {
                    let values = tagValue.split(',');
                    tagValue = new Vector( parseFloat(values[0]),
                                           parseFloat(values[1]),
                                           parseFloat(values[2]));
                }; break;
                case "string": default: break;
            }
            
            // 设置动态属性
            entity.setDynamicProperty(key, tagValue);

            return tagValue;
        }
        else{
            return undefined;
        }
    }
    return propertyValue;
}

/**
 * @param {Entity} entity 
 * @param {string} key
 * @returns {string | undefined}
 */
export function getString (entity, key){ return get(entity, key, "string" ); };
/**
 * @param {Entity} entity 
 * @param {string} key
 * @returns {number | undefined}
 */
export function getInt    (entity, key){ return get(entity, key, "int"    ); };
/**
 * @param {Entity} entity 
 * @param {string} key
 * @returns {number | undefined}
 */
export function getFloat  (entity, key){ return get(entity, key, "float"  ); };
/**
 * @param {Entity} entity 
 * @param {string} key
 * @returns {boolean | undefined}
 */
export function getBoolean(entity, key){ return get(entity, key, "boolean"); };
/**
 * @param {Entity} entity 
 * @param {string} key
 * @returns {Vector | undefined}
 */
export function getVector (entity, key){ return get(entity, key, "vector" ); };

/**
 * 
 * @param {Entity} entity 
 * @param {string} key 
 * @param {string | number | boolean | Vector |undefined} data 
 * @param {string} type 
 */
function set(entity, key, data, type){
    // 设置动态属性
    entity.setDynamicProperty(key, data);
    // 设置标签值
    if(data === undefined){
        Tag.del(entity, key + ':')
    }
    else{
        let tagValue;
        // 转换类型
        switch(type){
            case "int": {
                tagValue = data.toString();
            }; break;
            case "float": {
                tagValue = data.toFixed(5)
            }; break;
            case "boolean": {
                tagValue = data ? "1" : "0";
            }; break;
            case "vector": {
                tagValue = `${data.x.toFixed(4)},${data.y.toFixed(4)},${data.z.toFixed(4)}`;
            }; break;
            case "string": default: {
                tagValue = data;
            }; break;
        }
        Tag.set(entity, key + ':', tagValue);
    }
}

/**
 * @param {Entity} entity 
 * @param {string} key 
 * @param {string} data
 */
export function setString (entity, key, data){ set(entity, key, data, "string" ); };
/**
 * @param {Entity} entity 
 * @param {string} key 
 * @param {number | undefined} data
 */
export function setInt    (entity, key, data){ set(entity, key, data, "int"    ); };
/**
 * @param {Entity} entity 
 * @param {string} key 
 * @param {number | undefined} data
 */
export function setFloat  (entity, key, data){ set(entity, key, data, "float"  ); };
/**
 * @param {Entity} entity 
 * @param {string} key 
 * @param {boolean | undefined} data
 */
export function setBoolean(entity, key, data){ set(entity, key, data, "boolean"); };
/**
 * @param {Entity} entity 
 * @param {string} key 
 * @param {Vector | undefined} data
 */
export function setVector (entity, key, data){ set(entity, key, data, "vector" ); };