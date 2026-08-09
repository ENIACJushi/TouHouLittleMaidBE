
/**
 * 动画类型（基岩侧短名 / v.animate_xxx）
 *
 * 添加一个动画解析的流程：
 * - 在 `AnimationTemplates.ts` - `ANIMATION_DEF_TEMPLATE` 的
 *    `scripts.pre_animation`、`scripts.animate`、`animations` 三处补充定义
 * - 在 `AnimationTypes` 补充枚举
 * - 在 `ANIMATE_EXTRA_CONDITION` 定义额外条件
 * - 若 Java 源动画键名与枚举值不同，在 `ANIMATION_SOURCE_KEYS` 登记映射
 */
export enum AnimationTypes {
  hug = 'hug',
  walk = 'walk',
  beg = 'beg',
  sit = 'sit',
  parallel0 = 'parallel0',
  parallel1 = 'parallel1',
  parallel2 = 'parallel2',
  parallel3 = 'parallel3',
  parallel4 = 'parallel4',
  parallel5 = 'parallel5',
  parallel6 = 'parallel6',
  parallel7 = 'parallel7',
  pre_parallel0 = 'pre_parallel0',
  pre_parallel1 = 'pre_parallel1',
  pre_parallel2 = 'pre_parallel2',
  pre_parallel3 = 'pre_parallel3',
  pre_parallel4 = 'pre_parallel4',
  pre_parallel5 = 'pre_parallel5',
  pre_parallel6 = 'pre_parallel6',
  pre_parallel7 = 'pre_parallel7',

  idle = 'idle',

  // 可实现对应状态，但暂未加入
  // swing_hand = 'swing_hand',
  // run = 'run',
  // jump = 'jump',
  // death = 'death',
  // chair = 'chair',
  // swim_stand = 'swim_stand',
  // use_offhand = 'use_offhand',
  // use_mainhand = 'use_mainhand',

  // 目前没有对应功能的动画
  // gomoku = 'gomoku',
  // computer = 'computer',
  // keyboard = 'keyboard',
  // bookshelf = 'bookshelf',
  // sleep = 'sleep',
  // game_win = 'game_win',
  // game_lost = 'game_lost',
}

/**
 * Java 源动画 JSON 键名与 AnimationTypes 不一致时的映射。
 * 未登记的类型默认使用枚举值本身作为源键名。
 */
const ANIMATION_SOURCE_KEYS: Partial<Record<AnimationTypes, string>> = {
  [AnimationTypes.hug]: 'vehicle$minecraft:player',
};

/** 取 Java 动画文件中对应的键名 */
export function getAnimationSourceKey(type: AnimationTypes): string {
  return ANIMATION_SOURCE_KEYS[type] ?? type;
}

export enum AnimationConvertStrategy {
  ANIMATE = 0,
  ANIMATION_CONTROLLER = 1,
}
