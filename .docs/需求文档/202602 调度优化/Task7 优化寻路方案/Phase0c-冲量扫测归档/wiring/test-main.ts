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
 * Task7 Phase2：Path.follow 冒烟（永久保留）
 */
export function initPathFollow() {
  new PathFollowTest();
}

/**
 * Task7 Phase0c：冲量扫测（测完归档；复测时恢复）
 */
export function initImpulseSweep() {
  new ImpulseSweepTest();
}
