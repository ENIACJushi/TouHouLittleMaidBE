import {AnimationTypes} from "./AnimationTypes";
import {AnimationDefinition180} from "./AnimationSchema180";

/**
 * 简单的 java 版女仆动画文件格式定义（ 1.8.0 版本）
 */
export interface MaidAnimationFileSchema180 {
  format_version: "1.8.0",
  animations: MaidAnimationListSchema180;
}

export type MaidAnimationListSchema180 = {
  [K in AnimationTypes]?: AnimationDefinition180;
}
