import { BulletTest } from "./danmaku/BulletTest";
import { PathPlanTest } from "./path/PathPlanTest";

/**
 * 弹幕等杂项测试（依赖 main.ts TEST 开关）
 */
export function initTest() {
  new BulletTest();
}

/**
 * Task7 Phase1：寻路规划验收（进包即注册，不依赖 TEST）
 */
export function initPathPlan() {
  new PathPlanTest();
}
