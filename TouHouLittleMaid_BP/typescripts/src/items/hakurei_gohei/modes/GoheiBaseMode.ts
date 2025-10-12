import {
  ItemReleaseUseAfterEvent,
  ItemStartUseAfterEvent,
} from "@minecraft/server";

export class GoheiBaseMode {
  /**
   * 处理开始蓄力事件
   */
  startUseEvent (event: ItemStartUseAfterEvent) { }

  /**
   * 处理结束蓄力事件
   */
  stopUseEvent (event: ItemReleaseUseAfterEvent) { }
}