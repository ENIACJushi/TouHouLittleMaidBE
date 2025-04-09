import { Entity } from "@minecraft/server";

export namespace TagDataHelper {
  /**
   * 获取tag数据 最多获取一个
   * @param prefix like "thlmo:"
   */
  export function get(entity: Entity, prefix: string): string | undefined {
    let length = prefix.length;
    for (let tag of entity.getTags()) {
      if (tag.substring(0, length) == prefix) {
        return tag.substring(length);
      }
    }
    return undefined;
  }
  
  /**
   * 设置tag数据
   * @param prefix like "thlmo:"
   */
  export function set(entity: Entity, prefix: string, data: string) {
    del(entity, prefix)
    entity.addTag(`${prefix}${data}`);
  }
  
  /**
   * 删除tag数据 最多删除一个
   * @param prefix like "thlmo:"
   * @returns 是否有tag被删除
   */
  export function del(entity: Entity, prefix: string): boolean {
    let length = prefix.length;
    for (let tag of entity.getTags()) {
      if (tag.substring(0, length) == prefix) {
        entity.removeTag(tag);
        return true;
      }
    }
    return false;
  }
}
