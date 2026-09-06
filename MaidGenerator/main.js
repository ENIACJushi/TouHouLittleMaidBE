/**
 * 女仆json生成器
 */
import * as fs from "fs";
import { TEMPLATE } from './template.js';
import {Skin} from "./modules/Skin.js";
import {Seek} from "./modules/Seek.js";

const OUTPUT_PATH = '../TouHouLittleMaid_BP/entities/maid/maid.json'; // 输出路径

class MaidGenerator {
  /**
   * 主函数
   */
  main() {
    // 对模板执行修改
    console.log('Do modify...');
    Skin.process(this);
    Seek.process(this);
    // 输出到文件
    fs.writeFile(OUTPUT_PATH, JSON.stringify(TEMPLATE), 'utf8', (err) => {
      if (err) {
        console.error(`写入${OUTPUT_PATH}.lang文件时发生错误: `, err);
      }
    });
    console.log('Complete.');
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
