import { AnimationDefinition180 } from "../types/AnimationSchema180";

/** 动画处理器入参：动画定义 + 模型缩放 */
export type APContext = {
  animation: AnimationDefinition180;
  /** 模型缩放（render_entity_scale，默认 1） */
  scale: number;
};

export type APFunc = (ctx: APContext) => Promise<void>;
