import { Vector } from "../../libs/VectorMC";
import {Dimension, Entity} from "@minecraft/server";

/**
 * 线型弹幕基础
 *  所有的线型弹幕都可以抽象为： 指定位置 -> 朝某个方向发射
 *  对于 shooter来说，提供这两种信息就够了，剩下的就是在一些可能会变化的流程上开放通用接口
 */
export abstract class LineShapeBase {
  /**
   * 发射这种弹型，返回预设的类型
   */
  abstract shootShape(params: LineShapeShootParams): undefined;
}

export interface LineShapeShootParams {
  location: WorldLocation; // 发射位置
  velocity: Vector; // 发射动量
  // 可选参数
  inaccuracy?: number; // 不准确度，不给定时默认指哪打哪
  throwerId?: string; // 发射者 ID
  ownerId?: string; // 发射者的主人 ID
}

export interface WorldLocation {
  dimension: Dimension;
  pos: Vector;
}