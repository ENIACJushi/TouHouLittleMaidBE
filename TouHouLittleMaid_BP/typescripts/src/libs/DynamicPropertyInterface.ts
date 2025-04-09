import { Entity } from "@minecraft/server";
import { Vector } from "./VectorMC";
import { TagDataHelper } from "./TagDataInterface"

export namespace DP {
  function getTemplate<T extends boolean|number|string|Vector>(entity: Entity,
    key: string, tagFunction: (raw:string)=>T): T|undefined {
    // 尝试从动态属性获取
    let propertyValue = entity.getDynamicProperty(key) as T;
    if (propertyValue !== undefined) {
      return propertyValue;
    }
    // 尝试从TAG获取
    let tagValue = TagDataHelper.get(entity, key + ':');
    if (tagValue === undefined) {
      return undefined;
    }
    // 设置动态属性并返回
    let res = tagFunction(tagValue);
    entity.setDynamicProperty(key, res);
    return res;
  }
  
  export function getString(entity: Entity, key: string): string | undefined {
    return getTemplate<string>(entity, key, raw => raw);
  };
  
  export function getInt(entity: Entity, key: string): number | undefined {
    return getTemplate<number>(entity, key, raw => parseInt(raw));
  };
  
  export function getFloat(entity: Entity, key: string): number | undefined {
    return getTemplate<number>(entity, key, raw => parseFloat(raw));
  };
  
  export function getBoolean(entity: Entity, key: string): boolean | undefined {
    return getTemplate<boolean>(entity, key, raw => raw === '1');
  };
  
  export function getVector(entity: Entity, key: string): Vector | undefined {
    return getTemplate<Vector>(entity, key, (raw) => {
      let values = raw.split(',');
      return  new Vector(parseFloat(values[0]), parseFloat(values[1]), parseFloat(values[2]));
    });
  };
  
  
  function setTemplate<T extends boolean|number|string|Vector>(entity: Entity,
    key: string, tagFunction: (data:T)=>string, data?: T) {
    entity.setDynamicProperty(key, data);
    if (data === undefined) {
      TagDataHelper.del(entity, key + ':');
      return;
    }
    TagDataHelper.set(entity, key + ':', tagFunction(data));
  }
  
  export function setString(entity: Entity, key: string, data?: string) {
    setTemplate<string>(entity, key, d => d, data);
  };
  
  export function setInt(entity: Entity, key: string, data?: number) {
    setTemplate<number>(entity, key, d => d.toString(), data);
  };
  
  export function setFloat(entity: Entity, key: string, data?: number) {
    setTemplate<number>(entity, key, d => d.toFixed(5), data);
  };
  
  export function setBoolean(entity: Entity, key: string, data: boolean | undefined) {
    setTemplate<boolean>(entity, key, d => d ? '1' : '0', data);
  };
  
  export function setVector(entity: Entity, key: string, data: Vector | undefined) {
    setTemplate<Vector>(entity, key,
      d => `${d.x.toFixed(4)},${d.y.toFixed(4)},${d.z.toFixed(4)}`, data);
  };
}