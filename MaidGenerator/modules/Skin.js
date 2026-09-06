const END_INDEX = 200;
/**
 * 皮肤枚举
 */
export class Skin {
  /**
   * @param {MaidGenerator} g
   */
  static process(g) {
    console.log(`添加皮肤枚举: 0~${END_INDEX}`);
    for (let i = 0; i <= END_INDEX; i++) {
      g.addComponentGroup(`skin:${i}`, {
        "minecraft:variant": { "value": i }
      });
      g.addEvent(`skin:${i}`, {
        "add":{"component_groups":[`skin:${i}`]}
      });
    }
  }
}
