import {ANIMATION_DEF_TEMPLATE} from "./AnimationTemplates";
import MAID_ENTITY_DEF from "./maid.entity.json";
import {AnimationScriptsDefinition} from "../../animation/MaidAnimationConvertor";

/** 是否启用内置模型包转换档案 */
const USE_INNER_PACK_PROFILE = true;

/**
 * 转换配置档案
 *  包含一些需要根据情况改变的配置
 */
export class ConvertProfile {
  /**
   * 附加模型包编号开始的前一个编号
   *  例：设为1000，则产生的第一个模型包编号为 1001
   */
  BASE_PACK_INDEX = 1000;

  /**
   * 转换得到的 gecko 动画 id 起始值
   *  为默认动画预留更小的 id 空间（如后续扩展默认 idle/run 等）
   *  常态 3000，在生成预置模型包或预置动画时，设为 100
   */
  CONVERTED_ANIMATION_ID_START = 3000;

  /**
   * 动画定义基础模板，导出的定义在此基础上生成
   *  内置包转换时，仅附带手动转换的东方包
   *  常态附带包含酒狐包在内的所有内置包的信息
   */
  ANIMATION_DEF_TEMPLATE = ANIMATION_DEF_TEMPLATE;

  constructor() {
    if (USE_INNER_PACK_PROFILE) {
      this.loadInternalPackProfile();
    } else {
      this.loadSimpleProfile();
    }
  }

  /**
   * 加载内置包转换配置
   */
  loadInternalPackProfile() {
    // 动画id起始设为100
    this.CONVERTED_ANIMATION_ID_START = 100;
    // 皮肤包id起始位置设为1（手动转换的东方包）
    this.BASE_PACK_INDEX = 0;
    // ANIMATION_DEF_TEMPLATE使用兜底值即可
  }

  /**
   * 加载常态转换配置
   */
  loadSimpleProfile() {
    // 读取全量定义
    const DESC = MAID_ENTITY_DEF["minecraft:client_entity"].description;
    this.ANIMATION_DEF_TEMPLATE = {
      scripts: DESC.scripts as AnimationScriptsDefinition,
      animations: DESC.animations,
      animationList: {},
    };
  }
}

export const PROFILE = new ConvertProfile();
