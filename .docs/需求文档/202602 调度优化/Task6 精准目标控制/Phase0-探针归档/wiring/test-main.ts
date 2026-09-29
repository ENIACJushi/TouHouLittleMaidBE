import { testCommandRegister } from "./TestCommandRegister";
import { BulletTest } from "./danmaku/BulletTest";
import { SeekHateClearTest } from "./maid/SeekHateClearTest";

/**
 * 弹幕等杂项测试（依赖 main.ts TEST 开关）
 */
export function initTest() {
  new BulletTest();
}

/**
 * Task6 Phase0 仇恨探针：进包即注册，不依赖 TEST（对齐 Damage 验收方式）
 */
export function initSeekHateProbe() {
  new SeekHateClearTest();
}
