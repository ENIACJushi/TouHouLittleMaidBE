import { PROFILE } from "../config";

/**
 * 基岩版数据模板
 */
export namespace TemplatesBE {
  // 模型包注册配置 JSON，写入游戏设置面板
  export function buildSkinPackConfigStr(modelAmount: number[]): string {
    const packs = modelAmount
      .filter(count => typeof count === 'number')
      .map(count => ({ count }));
    return JSON.stringify(packs);
  }

  // 资源包 manifest.json 模板
  export const MANIFEST = {
    "format_version": 2,
    "header": {
      "name": "TouHou Little Maid - Skin Pack",
      "description": "Skin Pack of TouHou Little Maid",
      "uuid": "<uuid>",
      "version": [ 1, 0, 0 ],
      "min_engine_version": [ 1, 20, 30 ]
    },
    "modules": [
      {
        "type": "resources",
        "uuid": "b283624d-5a73-4f82-9ea4-9a1f50eeb0ab",
        "version": [ 1, 0, 0 ]
      }
    ],
    "dependencies": [],
    "subpacks": []
  };

  // 语言列表
  export const LANG_LIST = ["de_DE","en_US","es_ES","fr_FR","it_IT","ja_JP","ko_KR","pt_BR","pt_PT","ru_RU","tr_TR","zh_CN"];

  // 渲染控制器总表模板
  export const RENDER_CONTROLLER_LIST = {
    "format_version": "1.8.0",
    "render_controllers": {
    }
  };

  // 渲染控制器单包模板
  export const RENDER_CONTROLLER_PACK = {
    "arrays": {
      "textures": {
        "Array.skins": [
          "Texture.void"
        ]
      },
      "geometries": {
        "Array.geos":[
          "Geometry.void"
        ]
      }
    },
    "geometry": "Array.geos[q.property('thlm:skin_pack')==<index>?q.variant+1:0]",
    "materials": [
      {"*": "Material.default"},
      {"wingLeft": "Material.wing"},
      {"wingRight": "Material.wing"},
      { "_*": "Material.emissive"}
    ],
    "part_visibility": [
      { "blink": "!q.is_in_ui && q.property('thlm:work')>=-1" }
    ],
    "textures": [ "Array.skins[q.property('thlm:skin_pack')==<index>?q.variant+1:0]" ]
  };
  export type RenderControllerPack = typeof RENDER_CONTROLLER_PACK;

  /**
   * 获取实体定义模板，每次都新建一个对象，外部无需复制
   */
  export function buildEntityDef(): EntityDefinition {
    return {
      "format_version": "1.10.0",
      "minecraft:client_entity": {
        "description": {
          "identifier": "thlmm:maid",
          "textures": {
          },
          "geometry": {
          },
      // 从定义模板获取 render_controllers
      "render_controllers": JSON.parse(JSON.stringify(PROFILE.RENDER_CONTROLLERS)),
      }
    }
  }
}

  ///// 坐垫实体渲染定义模板 /////

  /**
   * 坐垫渲染控制器单包模板
   *  - `<index>` 由转换器替换为 `packId + CHAIR_BASE_PACK_INDEX`
   */
  export const CHAIR_RENDER_CONTROLLER_PACK = {
    "arrays": {
      "textures": {
        "Array.skins": [
          "Texture.void"
        ]
      },
      "geometries": {
        "Array.geos": [
          "Geometry.void"
        ]
      }
    },
    "geometry": "Array.geos[q.property('thlm:chair_pack')==<index>?q.variant+1:0]",
    "materials": [
      { "_*": "Material.emissive" },
      { "*": "Material.default" }
    ],
    "textures": [ "Array.skins[q.property('thlm:chair_pack')==<index>?q.variant+1:0]" ]
  };
  export type ChairRenderControllerPack = typeof CHAIR_RENDER_CONTROLLER_PACK;

  /**
   * 坐垫渲染控制器总表模板
   */
  export const CHAIR_RENDER_CONTROLLER_LIST = {
    "format_version": "1.8.0",
    "render_controllers": {
    }
  };

  /**
   * 构建坐垫客户端实体定义模板，每次都新建一个对象，外部无需复制
   */
  export function buildChairEntityDef(): ChairEntityDefinition {
    return {
      "format_version": "1.10.0",
      "minecraft:client_entity": {
        "description": {
          "identifier": "touhou_little_maid:chair",
          "materials": {
            "default": "entity_alphatest"
          },
          "textures": {
            "default": "textures/entity/void"
          },
          "geometry": {
            "default": "geometry.touhou_little_maid.void"
          },
          "render_controllers": []
        }
      }
    }
  }

  export type ChairEntityDefinition = {
    format_version: string,
    "minecraft:client_entity": {
      description: {
        identifier: string,
        materials: Record<string, string>,
        textures: Record<string, string>,
        geometry: Record<string, string>,
        render_controllers: string[],
        scripts?: ChairScriptsDefinition,
        animations?: Record<string, string>,
      }
    }
  }

  export type ChairScriptsDefinition = {
    scale: string,
    initialize?: string[],
    pre_animation: string[],
    should_update_bones_and_effects_offscreen?: true,
    animate: (string | Record<string, string>)[],
  }

  ///// 坐垫包配置 /////

  /**
   * 坐垫包注册配置 JSON，写入游戏设置面板（独立于女仆皮肤包）
   * 格式示例：[{"count":20},{"count":10}]
   */
  export function buildChairPackConfigStr(chairModelAmount: number[]): string {
    const packs = chairModelAmount
      .filter(count => typeof count === 'number')
      .map(count => ({ count }));
    return JSON.stringify(packs);
  }
  export type ChairPackConfig = { count: number; }[];

  export type EntityDefinition = {
    format_version: string,
    "minecraft:client_entity": {
      description: {
        identifier: string,
        textures: Record<string, string>,
        geometry: Record<string, string>,
        render_controllers: string[],
        scripts?: {
          scale: string,
          initialize?: string[],
          pre_animation: string[],
          should_update_bones_and_effects_offscreen: true,
          animate: (string | Record<string, string>)[],
        },
        animations?: Record<string, string>,
      }
    }
  }
}
