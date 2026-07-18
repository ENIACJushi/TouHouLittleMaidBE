
/**
 * java 动画键名列表
 */
export enum AnimationTypes {
  walk = 'walk',
  beg = 'beg',
  sit = 'sit',
  parallel0 = 'parallel0',
  parallel1 = 'parallel1',
  parallel2 = 'parallel2',
  parallel3 = 'parallel3',

  // 可实现对应状态，但暂未加入
  // swing_hand = 'swing_hand',
  // idle = 'idle',
  // run = 'run',
  // jump = 'jump',
  // death = 'death',
  // chair = 'chair',
  // swim_stand = 'swim_stand',
  // use_offhand = 'use_offhand',
  // use_mainhand = 'use_mainhand',
  // pre_parallel0 = 'pre_parallel0',
  // pre_parallel1 = 'pre_parallel1',
  // pre_parallel2 = 'pre_parallel2',
  // pre_parallel3 = 'pre_parallel3',

  // 目前没有对应功能的动画
  // gomoku = 'gomoku',
  // computer = 'computer',
  // keyboard = 'keyboard',
  // bookshelf = 'bookshelf',
  // sleep = 'sleep',
  // game_win = 'game_win',
  // game_lost = 'game_lost',
}

export enum AnimationConvertStrategy {
  ANIMATE = 0,
  ANIMATION_CONTROLLER = 1,
}
