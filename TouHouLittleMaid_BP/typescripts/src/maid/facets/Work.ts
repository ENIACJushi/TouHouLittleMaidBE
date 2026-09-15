import { Entity, system } from "@minecraft/server";
import { Level } from "./Level";
import { isSitting } from "./Anim";
import { Sound } from "./Sound";

/** 工作模式变更后的可选回调（由 events 引导注册，避免 facets → work） */
let onWorkChanged: ((maid: Entity) => void) | undefined;

/**
 * 工作模式（行为对齐 EntityMaid.Work）
 */
export const Work = {
  /**
   * 注册工作模式变更后回调（如索敌）；由 events 引导在启动时调用一次
   */
  setOnWorkChanged(handler: ((maid: Entity) => void) | undefined): void {
    onWorkChanged = handler;
  },
  AMOUNT: 7, // 总数（包含空闲）

  idle: 0, // 空闲
  attack: 1, // 攻击
  danmaku_attack: 2, // 弹幕攻击
  farm: 3, // 农场
  sugar_cane: 4, // 甘蔗
  melon: 5, // 瓜类
  cocoa: 6, // 可可

  grass: 7, // 花草
  snow: 8, // 清雪

  feed: 9, // 喂食

  shears: 10, // 剪刀
  milk: 11, // 牛奶
  torch: 12, // 火把

  feed_animal: 13, // 繁殖动物
  extinguishing: 14, // 灭火

  ranged_attack: 15,
  NAME_LIST: [
    "idle",
    "attack",
    "danmaku_attack",
    "farm",
    "sugar_cane",
    "melon",
    "cocoa",

    "grass",
    "snow",

    "feed",
    "shears",
    "milk",

    "torch",
    "feed_animal",
    "extinguishing",


    "ranged_attack",
  ],
  // 切换到模式时的音效(现在已经转移到行为包内播放)
  SOUND_LIS: [
    undefined,
    "mob.thlmm.maid.attack",
    "mob.thlmm.maid.attack",
    undefined,
    undefined,
    undefined,
    undefined,

    undefined,
    undefined,
    "mob.thlmm.maid.feed",
    undefined,
    undefined,
    undefined,
    "mob.thlmm.maid.feed",
    undefined,
  ] as (string | undefined)[],
  // UI 图标
  IMG_LIST: [
    "textures/items/feather.png",
    "textures/items/diamond_sword.png",
    "textures/items/hakurei_gohei.png",
    "textures/items/iron_hoe.png",
    "textures/items/reeds.png",
    "textures/items/melon.png",
    "textures/items/dye_powder_brown.png",

    "textures/blocks/tallgrass.png",
    "textures/items/snowball.png",
    "textures/items/beef_cooked.png",
    "textures/items/shears.png",
    "textures/items/bucket_milk.png",
    "textures/items/torch_on.png",
    "textures/items/wheat.png",
    "textures/items/extinguisher.png",

    "textures/items/bow_standby.png",
  ],

  /**
   * 获取工作模式
   */
  get(maid: Entity): number {
    return maid.getProperty("thlm:work") as number;
  },
  /**
   * 设置工作模式
   */
  set(maid: Entity, type: number): void {
    maid.triggerEvent(this.getEventName(maid, this.get(maid), true));
    // 有些工作模式存在相同的组件，延迟修改避免删除
    system.runTimeout(() => {
      // 工作属性由脚本写入；坐下相关组件由脚本按姿态选择事件，不再走 JSON 过滤器
      maid.setProperty("thlm:work", type);
      switch (type) {
        // 弹幕攻击模式
        case Work.danmaku_attack: {
          // 播放声音
          Sound.playSound(maid, "thlmm.maid.attack");
          // 根据是否坐下触发不同的附加事件
          if (isSitting(maid)) {
            maid.triggerEvent("api:mode_danmaku_attack_sit");
          } else {
            maid.triggerEvent("api:mode_danmaku_attack_stand");
          }
        } break;
        // 近战：坐下时不添加索敌/攻击组件
        case Work.attack: {
          Sound.playSound(maid, "mob.thlmm.maid.attack");
          if (!isSitting(maid)) {
            maid.triggerEvent(this.getEventName(maid, type, false));
          }
        } break;
        // 耕地模式
        case Work.farm: {
          if (!isSitting(maid)) {
            maid.triggerEvent("api:mode_farm");
          }
        } break;
        // 甘蔗模式
        case Work.sugar_cane: {
          if (!isSitting(maid)) {
            maid.triggerEvent("api:mode_sugar_cane");
          }
        } break;
        // 瓜类模式
        case Work.melon: {
          if (!isSitting(maid)) {
            maid.triggerEvent("api:mode_melon");
          }
        } break;
        // 可可
        case Work.cocoa: {
          if (!isSitting(maid)) {
            maid.triggerEvent("api:mode_cocoa");
          }
        } break;
        // 默认
        default:
          maid.triggerEvent(this.getEventName(maid, type, false));
          break;
      }
      // 设置工作状态后，立即开始寻找目标（具体逻辑由 events 注册的回调提供）
      onWorkChanged?.(maid);
    }, 1);
  },
  /**
   * 离开工作模式
   */
  quit(maid: Entity): void {
    maid.triggerEvent(this.getEventName(maid, this.get(maid), true));
  },
  /**
   * 进入工作模式 用来恢复站立状态的工作
   */
  enter(maid: Entity, type: number): void {
    maid.triggerEvent(this.getEventName(maid, type));
  },
  /**
   * 获取名称
   */
  getName(type: number): string {
    return this.NAME_LIST[type];
  },
  /**
   * 获取事件名称
   */
  getEventName(maid: Entity, type: number, quit?: boolean): string {
    // 拼接基础字符串
    let result = "api:mode_";
    if (quit) result += "quit_";
    result += this.getName(type);

    // 受等级影响的类型
    if (type === this.attack) {
      result += `_lv${Level.get(maid)}`;
    }
    return result;
  },
  /**
   * 获取语言文件字符串
   */
  getLang(type: number): string {
    return `task.touhou_little_maid:${this.getName(type)}.name`;
  },
  /**
   * 获取按钮材质
   */
  getIMG(type: number): string {
    return this.IMG_LIST[type];
  },
  /**
   * 获取切换到该工作模式时的音效 id；无对应音效时返回 undefined
   * 使用场景：外部需要按模式查音效表时（当前主流程已改为行为包内播放）
   */
  getSound(type: number): string | undefined {
    return this.SOUND_LIS[type];
  },
};
