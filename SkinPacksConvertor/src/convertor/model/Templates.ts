
/**
 * 基岩版数据模板
 */
export namespace TemplatesBE {
  // 模型包注册命令头
  export const COMMAND_IMPORT = '/scriptevent thlm:skin_set ';

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

  // 实体定义模板
  export const ENTITY_DEF: EntityDefinition = {
    "format_version": "1.10.0",
    "minecraft:client_entity": {
      "description": {
        "identifier": "thlmm:maid",
        "textures": {
        },
        "geometry": {
        },
        "render_controllers": [
          "controller.render.touhou_little_maid.maid.maid_backpack",
          "controller.render.touhou_little_maid.maid.emote",
          "controller.render.touhou_little_maid.maid_touhou_little_maid",
          "controller.render.touhou_little_maid.maid.statue_base"
          // 在此补充
        ],
      }
    }
  }
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
          pre_animation: string[],
          should_update_bones_and_effects_offscreen: true,
          animate: (string | Record<string, string>)[],
        },
        animations?: Record<string, string>,
      }
    }
  }
}
