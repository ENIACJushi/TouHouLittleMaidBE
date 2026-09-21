/**
 * 女仆json生成器
 */
import * as fs from "fs";
import { TEMPLATE } from './template.js';
import {Skin} from "./modules/Skin.js";
import {Seek} from "./modules/Seek.js";
import { processSlots } from "./modules/slots/main.js";

const OUTPUT_PATH = '../TouHouLittleMaid_BP/entities/maid/maid.json'; // 输出路径

/**
 * 女仆实体 JSON 生成器：在 template 上叠加 Skin/Seek/槽位等模块后写出 maid.json。
 * 使用场景：npm run build；槽位模块产出 slot:* 原子装载事件供脚本调用。
 * @implements {import('./modules/slots/types.js').MaidGeneratorApi}
 */
export class MaidGenerator {
  /**
   * 主函数
   */
  main() {
    // 对模板执行修改
    console.log('Do modify...');
    Skin.process(this);
    Seek.process(this);
    processSlots(this);
    // 同步写出，保证 build 结束时 maid.json 已落盘
    try {
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(TEMPLATE), 'utf8');
      console.log('Complete.');
    } catch (err) {
      console.error(`写入${OUTPUT_PATH}时发生错误: `, err);
      process.exitCode = 1;
    }
  }

  /**
   * 添加组件组
   * @param name 组名称
   * @param group 组内容
   */
  addComponentGroup(name, group) {
    if (TEMPLATE["minecraft:entity"].component_groups[name] !== undefined) {
      console.warn('重复的组名: ', name);
    }
    TEMPLATE["minecraft:entity"].component_groups[name] = group;
  }

  /**
   * 添加事件
   */
  addEvent(name, event) {
    if (TEMPLATE["minecraft:entity"].events[name] !== undefined) {
      console.warn('重复的事件: ', name);
    }
    TEMPLATE["minecraft:entity"].events[name] = event;
  }

  /**
   * 添加属性
   */
  addProperty(name, property) {
    if (TEMPLATE["minecraft:entity"].description.properties[name] !== undefined) {
      console.warn('重复的属性: ', name);
    }
    TEMPLATE["minecraft:entity"].description.properties[name] = property;
  }
}

new MaidGenerator().main();
