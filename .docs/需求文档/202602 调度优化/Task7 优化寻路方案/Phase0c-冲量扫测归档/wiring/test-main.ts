import { BulletTest } from "./danmaku/BulletTest";
import { PathFollowTest } from "./path/PathFollowTest";
import { ImpulseSweepTest } from "./path/ImpulseSweepTest";

/**
 * 弹幕等杂项测试（依赖 main.ts TEST 开关）
 */
export function initTest() {
  new BulletTest();
}

/**
 * Task7 Phase2：Path.follow 冒烟（永久保留；由 main 直接 init，不依赖 TEST 开关）
 */
export function initPathFollow() {
  new PathFollowTest();
}

/**
 * Task7 Phase0c：冲量扫测（测完归档；本轮复测临时接线）
 */
export function initImpulseSweep() {
  new ImpulseSweepTest();
}
