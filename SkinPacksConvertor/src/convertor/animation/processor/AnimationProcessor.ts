
import { AnimationTypes } from "../types/AnimationTypes";
import { AnimationDefinition180 } from "../types/AnimationSchema180";
import { data as dataWalk } from "./APWalk";
import { data as dataHug } from "./APHug";
import { data as dataMolang } from "./APMolang";

export type APFunc = (animation: AnimationDefinition180) => Promise<void>;

/**
 * 动画处理器
 */
export class AnimationProcessor {
  static instance: AnimationProcessor;
  static getInstance() {
    if (!AnimationProcessor.instance) {
      AnimationProcessor.instance = new AnimationProcessor();
    }
    return AnimationProcessor.instance;
  }

  private processFunc = new Map<AnimationTypes, APFunc[]>();

  constructor() {
    for (const type in AnimationTypes) {
      this.processFunc.set(type as AnimationTypes, []);
    }

    // 注册动画处理器
    const registerFunc = (data: { types: any, func: APFunc }) => {
      this.registerAP(data.func, data.types);
    };
    registerFunc(dataMolang);
    registerFunc(dataWalk);
    registerFunc(dataHug);
  }

  /**
   * 注册动画处理函数
   * @param callback 动画处理函数
   * @param types 处理函数将要处理的动画类型，留空时处理所有类型
   */
  registerAP(callback: APFunc, types?: AnimationTypes[]) {
    const add = (type: AnimationTypes, func: APFunc) => {
      let arr = this.processFunc.get(type);
      if (arr) {
        arr.push(func);
      }
    }

    if (types) {
      types.forEach((type) => {
        add(type, callback);
      });
    } else {
      // 为每个类型注册
      for (const type of this.processFunc.keys()) {
        add(type, callback);
      }
    }
  }

  /**
   * 接收动画，进行处理
   */
  async process(type: AnimationTypes, animation: AnimationDefinition180): Promise<AnimationDefinition180> {
    let funcArr = this.processFunc.get(type);
    if (funcArr) {
      for (let func of funcArr) {
        await func(animation);
      }
    }
    return animation;
  };
}
