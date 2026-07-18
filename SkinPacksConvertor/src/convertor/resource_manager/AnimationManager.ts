import {ResourceManager} from "./ResourceManager";
import { MaidAnimationFileSchema180 } from "../animation/types/MaidAnimationFileSchema180";


/**
 * 全局包动画管理器
 *  在开始解析一个模型包前，先设置包资源管理器
 *  动画文件只有被使用才会被解析，一方面可以节省空间，另一方面可以方便地支持任意路径的动画
 */
export class AnimationManager {
  /** 包资源管理器，作为动画文件的来源 */
  private resource?: ResourceManager;
  /** 当前正在解析的包id */
  private packId: number = 0;
  /** 已解析的 <包id>:<动画文件标识> - 动画信息 映射 */
  private parsedAnimations: Map<string, AnimationFileInfo> = new Map();
  /** 包id - 模型id - 动画列表 映射*/
  private modelAnimation: Map<number, Map<number, AnimationFileInfo[]>> = new Map();

  constructor(resource?: ResourceManager) {
    this.resource = resource;
  }

  /**
   * 解析模型包前，设置包资源管理器
   * @param resource 包资源管理器
   * @param id 用于区分不同包，避免共用 domain（namespace）
   */
  setResourceManager(resource: ResourceManager, id: number) {
    this.resource = resource;
    this.packId = id;
  }

  /**
   * 绑定模型包对应的动画文件
   */
  async bindModelAnimation(packId: number, modelId: number, animationFile: string, defaultNamespace: string) {
    // 获取动画
    let animations = await this.getAnimationData(animationFile, defaultNamespace);
    if (!animations) {
      return;
    }
    // 进行记录
    let pack = this.modelAnimation.get(packId);
    if (!pack) {
      pack = new Map();
      this.modelAnimation.set(packId, pack);
    }
    let modelAnimations = pack.get(modelId);
    if (!modelAnimations) {
      modelAnimations = [];
      pack.set(modelId, modelAnimations);
    }
    modelAnimations.push(animations);
  }

  /**
   * 获取指定动画文件的动画数据，未解析时自动解析
   */
  async getAnimationData(_animationFile: string, defaultNamespace: string) {

    let animationFile = _animationFile;
    if (animationFile.indexOf(':') < 0) {
      // 提供的动画文件名使用缺省的 namespace，则手动拼接到开头
      animationFile = `${defaultNamespace}:${animationFile}`;
    }
    // 因为需要保证键的唯一性，在这生成 <packId>:<namespace>:<path>的键
    let cacheKey = `${this.packId}:${animationFile}`;
    // 开始获取
    let animationInfo = this.parsedAnimations.get(cacheKey);
    if (animationInfo) {
      // 已解析直接返回
      return animationInfo;
    }
    // 未解析，获取文件
    let file = this.resource.getResource(animationFile);
    if (!file) {
      // 文件不存在
      console.warn(`getAnimationData >> File not exist: ${animationFile}`)
      return undefined;
    }
    // 解析 json
    const rawStr = await file.async('string');
    let animations: MaidAnimationFileSchema180;
    try {
      animations = JSON.parse(rawStr) as MaidAnimationFileSchema180;
      if (!animations) {
        console.warn(`getAnimationData >> Animation file has no animation. name=${animationFile}, raw=`, rawStr);
        return undefined;
      }
    } catch(e) {
      console.warn(`getAnimationData >> Parse json failed: ${animationFile}, raw: `, rawStr);
      return undefined;
    }
    // 解析命名空间与文件名（去路径及 .json），供导出唯一动画名使用
    const fileName = _animationFile.substring(_animationFile.lastIndexOf('/') + 1).replace(/\.json$/i, '');
    // 将原动画直接挂到已解析列表中
    animationInfo = {
      packId: this.packId,
      id: this.parsedAnimations.size,
      fileName,
      animation: animations,
    };
    this.parsedAnimations.set(cacheKey, animationInfo);
    return animationInfo;
  }

  /**
   * 获取动画信息，用于导出
   */
  getAnimationInfos() {
    return this.modelAnimation;
  }
}

/**
 * 动画文件信息
 *  因为最终条件生成是 模型id-一组动画，所以它们之间的关系是按 id-动画 记录的，不会在这记录
 */
export interface AnimationFileInfo {
  animation: MaidAnimationFileSchema180; // 动画
  id: number; // 动画 id，子动画均取这个id。这里不会考虑主包的动画，是从0开始的，导出时要为主包动画留空
  packId: number; // 模型包id
  fileName: string; // 文件名（去路径及 .json）
}
