import {AnimationTypes} from "./AnimationTypes";

/**
 * 简单的 1.8.0 版本动画文件格式定义。
 *  因为目前暂不需要考虑动画内容，所以不需要管动画的内部结构
 *  https://learn.microsoft.com/zh-cn/minecraft/creator/reference/content/schemasreference/schemas/minecraftschema_actor_animation_1.8.0?view=minecraft-bedrock-stable
 */
export interface AnimationSchema180 {
  format_version: "1.8.0",
  animations: AnimationListSchema180;
}

export type AnimationListSchema180 = {
  [K in AnimationTypes]?: object
}
