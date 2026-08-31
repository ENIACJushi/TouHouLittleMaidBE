import { buildDefaultTemplate } from "./AnimationTemplates";
import MAID_ENTITY_DEF from "./maid.entity.json";
import MAID_ENTITY_DEF_SIMPLE from "./maid.entity.simple.json";
import CHAIR_ENTITY_DEF from "./chair.entity.json";
import {AnimationDefinition, AnimationScriptsDefinition} from "../../animation/MaidAnimationConvertor";
import {ChairAnimationDefinition} from "../../animation/ChairAnimationConvertor";
import {MAID_ENTITY_DEF_BASIC} from "../../../maid_basic";
import {CHAIR_ENTITY_DEF_BASIC} from "../../../chair_basic";
import { BUILTIN_PACK_DOMAIN_ORDER } from "../../../built_in/packOrder";

/** 是否启用内置模型包转换档案 */
const USE_INNER_PACK_PROFILE = false;

/** 网页附加包转换底板：完整 / 精简（对齐主 RP 的 subpacks） */
export type WebConvertBase = 'full' | 'lite';

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
   * 坐垫模型包编号开始的前一个编号（与女仆皮肤包相互独立）
   *  例：设为1000，则产生的第一个坐垫模型包编号为 1001
   */
  CHAIR_BASE_PACK_INDEX = 1000;

  /**
   * 同一压缩包内子模型包（assets/<domain>）的解析优先顺序。
   *  有配置的 domain 按数组顺序排在最前；未配置的排在其后。
   *  空数组表示不干预顺序（保持发现顺序）。
   */
  PACK_DOMAIN_ORDER: string[] = [];

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

  /**
   * 坐垫动画定义基础模板，导出的定义在此基础上生成
   *  内置包转换时，仅附带手动转换的坐垫基础
   *  常态附带包含内置坐垫包在内的所有信息
   */
  CHAIR_ANIMATION_DEF_TEMPLATE: ChairAnimationDefinition;

  /**
   * 坐垫基础渲染控制器，导出的坐垫实体定义在此基础上生成
   *  内置包转换时，使用chair_basic.ts的列表（空）
   *  常态附带内置坐垫在内的所有渲染控制器
   */
  CHAIR_RENDER_CONTROLLERS: string[];

  constructor() {
    if (USE_INNER_PACK_PROFILE) {
      this.loadInternalPackProfile();
    } else {
      this.loadWebAddonProfile('full');
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
    // 坐垫皮肤包id起始位置设为0（手动转换的坐垫包）
    this.CHAIR_BASE_PACK_INDEX = 0;
    // 内置包 domain 解析顺序（见 built_in/packOrder.ts）
    this.PACK_DOMAIN_ORDER = [...BUILTIN_PACK_DOMAIN_ORDER];
    // ANIMATION_DEF_TEMPLATE由maid_basic.ts构建
    this.ANIMATION_DEF_TEMPLATE = buildDefaultTemplate();
    // RENDER_CONTROLLERS取maid_basic.ts值
    this.RENDER_CONTROLLERS = JSON.parse(JSON.stringify(
      MAID_ENTITY_DEF_BASIC["minecraft:client_entity"].description.render_controllers
    ));
    // 坐垫 CHAIR_ANIMATION_DEF_TEMPLATE 由 chair_basic.ts 构建
    this.CHAIR_ANIMATION_DEF_TEMPLATE = {
      scripts: JSON.parse(JSON.stringify(
        CHAIR_ENTITY_DEF_BASIC["minecraft:client_entity"].description.scripts
      )),
      animations: JSON.parse(JSON.stringify(
        CHAIR_ENTITY_DEF_BASIC["minecraft:client_entity"].description.animations ?? {}
      )),
      animationList: {},
    };
    // 坐垫 CHAIR_RENDER_CONTROLLERS 取 chair_basic.ts 值
    this.CHAIR_RENDER_CONTROLLERS = JSON.parse(JSON.stringify(
      CHAIR_ENTITY_DEF_BASIC["minecraft:client_entity"].description.render_controllers ?? []
    ));
  }

  /**
   * 网页附加包转换档案（pack 序号从 1001 起）。
   * @param base `full`：以完整内置实体为底板；`lite`：以精简子包实体为底板
   */
  loadWebAddonProfile(base: WebConvertBase = 'full') {
    this.CONVERTED_ANIMATION_ID_START = 3000;
    this.BASE_PACK_INDEX = 1000;
    this.CHAIR_BASE_PACK_INDEX = 1000;
    this.PACK_DOMAIN_ORDER = [];

    const maidDef = base === 'lite' ? MAID_ENTITY_DEF_SIMPLE : MAID_ENTITY_DEF;
    const DESC = maidDef["minecraft:client_entity"].description;
    this.ANIMATION_DEF_TEMPLATE = {
      scripts: JSON.parse(JSON.stringify(DESC.scripts)) as AnimationScriptsDefinition,
      animations: JSON.parse(JSON.stringify(DESC.animations)),
      animationList: {},
    };
    this.RENDER_CONTROLLERS = JSON.parse(JSON.stringify(DESC.render_controllers));

    // 坐垫无精简子包，始终用全量定义
    const CHAIR_DESC = CHAIR_ENTITY_DEF["minecraft:client_entity"].description;
    this.CHAIR_ANIMATION_DEF_TEMPLATE = {
      scripts: JSON.parse(JSON.stringify(CHAIR_DESC.scripts)),
      animations: JSON.parse(JSON.stringify(CHAIR_DESC.animations ?? {})),
      animationList: {},
    };
    this.CHAIR_RENDER_CONTROLLERS = JSON.parse(JSON.stringify(CHAIR_DESC.render_controllers ?? []));
  }

  /** @deprecated 使用 {@link loadWebAddonProfile}('full') */
  loadSimpleProfile() {
    this.loadWebAddonProfile('full');
  }
}

export const PROFILE = new ConvertProfile();
