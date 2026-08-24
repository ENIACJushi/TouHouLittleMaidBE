import { AnimationFileInfo } from "../resource_manager/AnimationManager";
import { AnimationDefinition180 } from "./types/AnimationSchema180";
import { PROFILE } from "../config";
import { TemplatesBE } from "../model/Templates";

/**
 * 坐垫动画转换器
 *
 * 与女仆动画转换器（MaidAnimationConvertor）相对独立，专用于坐垫模型包（maid_chair.json）。
 * 由于坐垫动画通常为 gecko JSON 动画（无 AnimationTypes 语义），这里直接将每个被使用到的
 * 动画注册为唯一命名，并通过 `v.chair_anim_<modelId>_<index>` 控制播放，`v.chair_scale` 控制缩放。
 *
 * 输入来自独立的坐垫 AnimationManager（chairAnimationManager）。
 */
export class ChairAnimationConvertor {
  /** 坐垫包 id - 模型 id - 动画文件列表 */
  modelAnimation: Map<number, Map<number, AnimationFileInfo[]>>;
  /** 坐垫包 id - 模型 id - 缩放 */
  modelScale: Map<number, Map<number, number>>;
  /** 坐垫包 id - 模型 id - 是否 gecko */
  modelIsGecko: Map<number, Map<number, boolean>>;

  constructor(
    modelAnimation: Map<number, Map<number, AnimationFileInfo[]>>,
    modelScale: Map<number, Map<number, number>>,
    modelIsGecko: Map<number, Map<number, boolean>>,
  ) {
    this.modelAnimation = modelAnimation;
    this.modelScale = modelScale;
    this.modelIsGecko = modelIsGecko;
  }

  /**
   * 导出坐垫动画定义（scripts / animations / animationList）
   *  - 直接注册每个被使用到的 gecko 动画
   *  - scripts.scale 写入 `v.chair_scale`
   *  - pre_animation 汇总皮肤包/模型/缩放/动画开关条件
   *  - animate 按 `v.chair_anim_<modelId>_<index>` 控制
   */
  async exportDefinition(): Promise<ChairAnimationDefinition> {
    // 从坐垫动画定义模板创建基础动画定义（含预置的动画变量默认值）
    const res: ChairAnimationDefinition = JSON.parse(JSON.stringify(PROFILE.CHAIR_ANIMATION_DEF_TEMPLATE));

    // 记录已注册 shortKey，避免一个动画文件重复注册
    const registered = new Set<string>();
    // 记录 模型 → 动画开关变量列表（pack 内模型 id → 变量名数组）
    const animVars: Map<number, Map<number, string[]>> = new Map();

    for (const [packId, models] of this.modelAnimation) {
      for (const [modelId, fileInfos] of models) {
        let animIndex = 0;
        const vars: string[] = [];
        for (const fileInfo of fileInfos) {
          const animList = fileInfo.animation?.animations;
          if (!animList) {
            continue;
          }
          for (const name of Object.keys(animList)) {
            const sourceAnim = animList[name];
            if (!sourceAnim) {
              continue;
            }
            const shortKey = `${modelId}_${animIndex}`;
            if (!registered.has(shortKey)) {
              registered.add(shortKey);
              const exportId = fileInfo.id;
              const animationName = this.buildAnimationName(exportId, animIndex);
              const varName = `v.chair_anim_${modelId}_${animIndex}`;
              // 深拷贝，避免污染源模块
              const cloned: AnimationDefinition180 = JSON.parse(JSON.stringify(sourceAnim));
              res.animations[shortKey] = animationName;
              res.scripts.animate.push({ [shortKey]: `${varName}>0` });
              res.animationList[animationName] = cloned;
              vars.push(varName);
            }
            animIndex++;
          }
        }
        if (vars.length > 0) {
          let packMap = animVars.get(packId);
          if (!packMap) {
            packMap = new Map();
            animVars.set(packId, packMap);
          }
          packMap.set(modelId, vars);
        }
      }
    }

    // 汇总缩放与动画变量切换条件（含动画开关赋值）
    const conditionMolang = this.buildConditionMolang(animVars);
    if (conditionMolang) {
      res.scripts.pre_animation.push(conditionMolang);
    }

    return res;
  }

  /**
   * 生成基岩版唯一动画名：animation.tlm.chair.<animationId>.<index>
   */
  private buildAnimationName(animationId: number, index: number): string {
    return `animation.tlm.chair.${animationId}.${index}`;
  }

  /**
   * 汇总坐垫皮肤包/模型到缩放与动画变量的切换条件
   *  形如：temp.chair_pack=q.property('thlm:chair_pack');temp.model=q.variant;
   *   (temp.chair_pack == 1001) ? { (temp.model==0) ? { v.chair_scale=1.2; v.chair_anim_0_0=1; v.chair_anim_0_1=0; }; };
   */
  private buildConditionMolang(
    animVars: Map<number, Map<number, string[]>>,
  ): string {
    if (this.modelScale.size === 0 && this.modelIsGecko.size === 0 && animVars.size === 0) {
      return "";
    }
    let molang = `temp.chair_pack=q.property('thlm:chair_pack');temp.model=q.variant;`;

    const allPackIds = new Set<number>([
      ...animVars.keys(),
      ...this.modelScale.keys(),
      ...this.modelIsGecko.keys(),
    ]);

    for (const packId of allPackIds) {
      const chairPackId = packId + PROFILE.CHAIR_BASE_PACK_INDEX;
      const scales = this.modelScale.get(packId);
      const geckoFlags = this.modelIsGecko.get(packId);
      const varsMap = animVars.get(packId);
      const allModelIds = new Set<number>([
        ...(varsMap?.keys() ?? []),
        ...(scales?.keys() ?? []),
        ...(geckoFlags?.keys() ?? []),
      ]);

      let modelBlocks = "";
      for (const modelId of allModelIds) {
        const scale = scales?.get(modelId);
        const scaleAssign = scale !== undefined ? `v.chair_scale=${scale};` : "";
        const geckoAssign = geckoFlags?.get(modelId) ? "v.tlm_is_gecko=1;" : "";
        // 动画开关：选中该模型时播放第 0 个动画，其余关闭
        const vars = varsMap?.get(modelId) ?? [];
        let animAssign = "";
        if (vars.length > 0) {
          animAssign = vars
            .map((v, idx) => `${v}=${idx === 0 ? 1 : 0};`)
            .join("");
        }
        const assigns = `${scaleAssign}${geckoAssign}${animAssign}`;
        if (!assigns) {
          continue;
        }
        modelBlocks += `(temp.model==${modelId}) ? { ${assigns} };`;
      }

      if (!modelBlocks) {
        continue;
      }
      molang += `(temp.chair_pack == ${chairPackId}) ? { ${modelBlocks} };`;
    }
    return molang;
  }
}

/**
 * 坐垫动画定义
 */
export interface ChairAnimationDefinition {
  scripts: TemplatesBE.ChairScriptsDefinition;
  animations: Record<string, string>;
  animationList: Record<string, object>; // 用到的所有动画
}
