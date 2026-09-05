
import { AnimationTypes } from "../types/AnimationTypes";
import { AnimationDefinition180 } from "../types/AnimationSchema180";
import { data as dataWalk } from "./APWalk";
import { data as dataHug } from "./APHug";
import { data as dataMolang } from "./APMolang";
import { data as dataHeadLookDedup } from "./APHeadLookDedup";
import { data as dataPreParallelEyeGuard } from "./APPreParallelEyeGuard";
import { data as dataScalarVec3Expand } from "./APScalarVec3Expand";
import { data as dataCatmullRomScaleHold } from "./APCatmullRomScaleHold";
import { data as dataCatmullRomBake } from "./APCatmullRomBake";
import { data as dataYsmAccessoryHide } from "../../ysm/accessory/APYsmAccessoryHide";
import { APContext, APFunc } from "./APTypes";

export type { APContext, APFunc } from "./APTypes";

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
    // 须在 APMolang 之后：Head 上的注视 molang 与 look_at_target 去重
    registerFunc(dataHeadLookDedup);
    // 须在 APMolang 之后：把配饰 scale 烘焙为 0，不再依赖运行时 roaming 变量
    registerFunc(dataYsmAccessoryHide);
    registerFunc(dataWalk);
    registerFunc(dataHug);
    // 须在 APMolang 之后：对已转换的眼皮 molang 包 suppress?this
    registerFunc(dataPreParallelEyeGuard);
    // 须在 ScaleHold / Bake 之前：Gecko 标量关键帧简写展开为基岩要求的 vec3
    registerFunc(dataScalarVec3Expand);
    // 须在 EyeGuard + 标量展开之后：同时处理原动画与 extractedEyeAnimation 的 scale hold
    registerFunc(dataCatmullRomScaleHold);
    // 须在 ScaleHold 之后：仅对含 Molang 的通道去掉 catmullrom，纯常量样条保留
    registerFunc(dataCatmullRomBake);
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
   * @param type 动画类型
   * @param animation 动画定义
   * @param scale 模型缩放，缺省为 1
   */
  async process(
    type: AnimationTypes,
    animation: AnimationDefinition180,
    scale: number = 1,
  ): Promise<AnimationDefinition180> {
    let funcArr = this.processFunc.get(type);
    if (funcArr) {
      const ctx: APContext = { animation, scale };
      for (let func of funcArr) {
        await func(ctx);
      }
    }
    return animation;
  };
}
