import {AnimationTypes} from "./AnimationTypes";

/**
 * 女仆的动画转换器
 * 尽量不使用额外实体属性实现模型动画状态变化，因为实体属性只能设32个
 */
export class MaidAnimationConvertor {
  /** 动画类型及对应的动画列表 */
  animations: Map<AnimationTypes, MaidAnimationInfo> = new Map();
  constructor() {
  }

  /**
   * 导出实体定义的动画信息
   */
  exportDefinition(): AnimationDefinition {
    let res: AnimationDefinition = {
      scripts: {
        scale: "query.property('thlm:scale')",
        pre_animation: [],
        should_update_bones_and_effects_offscreen: true,
        animate: [],
      },
      animations: {},
    }


    return res;
  }

  /**
   * 导出资源决策 molang 字符串
   */
  exportPreAnimation() {
    let res = `temp.pack=q.property('thlm:skin_pack');temp.model=q.variant;`;

    `(temp.pack == 1001) ? { ${`(temp.model==1) ? { v.scale = 5; };`} } : { v.scale = 0.1; };`;
  }
}

/**
 * 某一动画的定义
 */
export interface MaidAnimationInfo {
  key: string; // 动画键名
  models: MaidAnimationModel[]; // 使用该动画的模型列表
}

/**
 * 模型信息
 */
export interface MaidAnimationModel {
  packId: number; // 模型包 id
  ModelId: number; // 模型 id
}

/**
 * 实体动画定义
 */
export interface AnimationDefinition {
  scripts: AnimationScriptsDefinition;
  animations: Record<string, string>;
}

/**
 * 实体动画 scripts 定义
 */
export interface AnimationScriptsDefinition {
  scale: string;
  pre_animation: string[];
  should_update_bones_and_effects_offscreen: true;
  animate: (string | Record<string,string>)[];
}
