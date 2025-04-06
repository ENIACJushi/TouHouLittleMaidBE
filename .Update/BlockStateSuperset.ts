/**
 * 在ts定义中，permutation.withState 目前只能用原版属性，但实际上非原版的也可以
 * 需要在 mojang-block.d.ts 的 BlockStateSuperset 补充如下定义
 * 如果找不着文件，就从 minecraft-server 的 withState 方法的参数定位过去
 */
export type BlockStateSuperset = {
  ['thlm:is_down']?: boolean;
};