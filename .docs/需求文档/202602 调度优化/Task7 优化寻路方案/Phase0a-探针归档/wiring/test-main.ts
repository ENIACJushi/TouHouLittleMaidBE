import { BulletTest } from "./danmaku/BulletTest";
import { BlockProbeTest } from "./path/BlockProbeTest";

/**
 * 弹幕等杂项测试（依赖 main.ts TEST 开关）
 */
export function initTest() {
  new BulletTest();
}

/**
 * Task7 Phase0a：方块可站立/可穿过探针（进包即注册，不依赖 TEST）
 */
export function initBlockProbe() {
  new BlockProbeTest();
}
