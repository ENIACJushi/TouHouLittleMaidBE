import {AnimationDefinition180} from "./AnimationSchema180";

/**
 * 简单的 java 版女仆动画文件格式定义（ 1.8.0 版本）
 */
export interface MaidAnimationFileSchema180 {
  format_version: "1.8.0",
  animations: MaidAnimationListSchema180;
}

/**
 * Java 动画列表：键多为 AnimationTypes 枚举值，
 * 少数例外（如 hug → vehicle$minecraft:player）见 getAnimationSourceKey。
 */
export type MaidAnimationListSchema180 = {
  [key: string]: AnimationDefinition180 | undefined;
};
