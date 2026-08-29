/**
 * 坐垫实体渲染定义基础模板包，只由开发者手动修改
 *  主要包含一些和坐垫自定义动画无关的基础定义
 */
export const CHAIR_ENTITY_DEF_BASIC = {
  "format_version": "1.10.0",
  "minecraft:client_entity": {
    "description": {
      // 完全保留
      "identifier": "touhou_little_maid:chair",
      // 完全保留
      "materials": {
        "default": "entity_alphatest",
        "emissive": "entity_emissive_alpha"
      },

      // 和需要转换的内置坐垫模型包合并后写入模组资源包 TouHouLittleMaid_RP
      "textures": {
        "default": "textures/entity/void",
        "void": "textures/entity/void",
      },
      // 和需要转换的内置坐垫模型包合并后写入模组资源包 TouHouLittleMaid_RP
      "geometry": {
        "default": "geometry.touhou_little_maid.void",
        "void": "geometry.touhou_little_maid.void",
      },

      // 内置坐垫模型包的动画包转换使用，会附加上一些动画信息
      "scripts": {
        "should_update_bones_and_effects_offscreen": true,
        // 完全保留
        "scale": "v.chair_scale",
        // 完全保留（每帧默认值，动画开关在此基础上赋值）
        "pre_animation": [
          "v.chair_anim_0_0 = 0;",
          "v.chair_scale = 1;",
        ],
        // 朝向动画始终播放；内置坐垫模型包的其它动画在其后添加
        "animate": [
          "yaw"
        ]
      },
      // 内置坐垫模型包的动画包转换使用，会附加上一些动画信息
      "animations": {
        // 末影水晶 runtime 无实体角度，用属性驱动 Root/MRoot 旋转
        "yaw": "animation.touhou_little_maid.chair.yaw"
      },

      // 内置坐垫模型包的实体定义使用，在此基础上增加额外的内置坐垫模型包渲染控制器
      "render_controllers": []
    }
  }
};
