import { BulletTest } from "./danmaku/BulletTest";
import { MovementCaptureTest } from "./path/MovementCaptureTest";
import { MovementProxyTest } from "./path/MovementProxyTest";
import { PathFollowTest } from "./path/PathFollowTest";
import { PlayerJumpCaptureTest } from "./path/PlayerJumpCaptureTest";

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
 * Walk/Jump1 原版运动采集（临时；测完归档卸线，勿卸 initPathFollow）
 * 使用场景：path_mov_run；控制台搜 PATHMOV|
 */
export function initMovementCapture() {
  new MovementCaptureTest();
}

/**
 * Walk/Jump1 冲量代理原型（临时；对照 PATHMOV）
 * 使用场景：path_proxy_run / path_proxy_tune；控制台搜 PATHPROXY|
 */
export function initMovementProxy() {
  new MovementProxyTest();
}

/**
 * 玩家起跳冲量采集（临时；供代理 hy）
 * 使用场景：path_pjump；控制台搜 PATHPJUMP|
 */
export function initPlayerJumpCapture() {
  new PlayerJumpCaptureTest();
}
