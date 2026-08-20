import { buildDefaultTemplate } from "./AnimationTemplates";
import MAID_ENTITY_DEF from "./maid.entity.json";
import {AnimationDefinition, AnimationScriptsDefinition} from "../../animation/MaidAnimationConvertor";
import {MAID_ENTITY_DEF_BASIC} from "../../../maid_basic";

/** 是否启用内置模型包转换档案 */
const USE_INNER_PACK_PROFILE = false;

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
  ANIMATION_DEF_TEMPLATE: AnimationDefinition;

  /**
   * 基础渲染控制器，导出的女仆实体定义在此基础上生成
   *  内置包转换时，使用maid_basic.ts的列表
   *  常态附带酒狐在内的所有渲染控制器
   */
  RENDER_CONTROLLERS: string[];

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
    // 皮肤包id起始位置设为0（手动转换的东方包）
    this.BASE_PACK_INDEX = 0;
    // ANIMATION_DEF_TEMPLATE由maid_basic.ts构建
    this.ANIMATION_DEF_TEMPLATE = buildDefaultTemplate();
    // RENDER_CONTROLLERS取maid_basic.ts值
    this.RENDER_CONTROLLERS = JSON.parse(JSON.stringify(
      MAID_ENTITY_DEF_BASIC["minecraft:client_entity"].description.render_controllers
    ));
  }

  /**
   * 加载常态转换配置
   */
  loadSimpleProfile() {
    // 动画id起始设为3000
    this.CONVERTED_ANIMATION_ID_START = 3000;
    // 皮肤包id起始位置设为1000
    this.BASE_PACK_INDEX = 1000;
    // 读取全量定义
    const DESC = MAID_ENTITY_DEF["minecraft:client_entity"].description;
    // ANIMATION_DEF_TEMPLATE取全量定义值
    this.ANIMATION_DEF_TEMPLATE = {
      scripts: JSON.parse(JSON.stringify(DESC.scripts)) as AnimationScriptsDefinition,
      animations: JSON.parse(JSON.stringify(DESC.animations)),
      animationList: {},
    };
    // RENDER_CONTROLLERS取全量定义值
    this.RENDER_CONTROLLERS = JSON.parse(JSON.stringify(DESC.render_controllers));
  }
}

export const PROFILE = new ConvertProfile();
