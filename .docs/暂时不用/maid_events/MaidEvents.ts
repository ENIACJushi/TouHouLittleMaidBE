/**
 @deprecated
 * 定义女仆的全部可注册事件及回调类型
 */
import {DataDrivenEntityTriggerAfterEvent} from "@minecraft/server";


/**
 * 女仆事件 名称及回调数据
 */
export type MaidEvents = {
  //// 生命周期事件 ////
  ['timer']: DataDrivenEntityTriggerAfterEvent; // 心跳事件
  ['spawn']: DataDrivenEntityTriggerAfterEvent; // 生成
  ['death']: DataDrivenEntityTriggerAfterEvent; // 死亡
  ['tamed']: DataDrivenEntityTriggerAfterEvent; // 被驯服
  ['photo']: DataDrivenEntityTriggerAfterEvent; // 被拍照
  ['smartSlabRecycle']: DataDrivenEntityTriggerAfterEvent; // 被魂符收回

  //// 交互事件 ////
  ['interact']: DataDrivenEntityTriggerAfterEvent; // 主人交互
  ['enterInventoryMode']: DataDrivenEntityTriggerAfterEvent; // 进入查包模式
  ['startHug']: DataDrivenEntityTriggerAfterEvent; // 开始被抱起
  ['stopHug']: DataDrivenEntityTriggerAfterEvent; // 停止被抱起
  ['sit']: DataDrivenEntityTriggerAfterEvent; // 坐下
  ['stand']: DataDrivenEntityTriggerAfterEvent; // 站起

  //// 工作事件 ////
  ['tryDanmakuAttack']: DataDrivenEntityTriggerAfterEvent; // 进行弹幕攻击
  ['setLevel']: DataDrivenEntityTriggerAfterEvent; // 设置等级
  ['tryReturnHome']: DataDrivenEntityTriggerAfterEvent; // 尝试回家

  //// 其它事件 ////
  ['NPC']: DataDrivenEntityTriggerAfterEvent; // 转化为NPC
  ['statusScan']: DataDrivenEntityTriggerAfterEvent; // 雕像扫描事件
}
