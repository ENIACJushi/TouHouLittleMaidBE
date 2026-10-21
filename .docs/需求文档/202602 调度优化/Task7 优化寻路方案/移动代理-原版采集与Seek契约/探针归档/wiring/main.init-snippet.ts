import {
  initMovementCapture,
  initMovementProxy,
  initPathFollow,
  initPlayerJumpCapture,
  initTest,
} from "../test/main";

// …省略其它入口…

// Task7 Phase2：Path.follow 冒烟（永久保留）
initPathFollow();

// Task7：Walk/Jump1 原版运动采集（临时；测完归档卸线）
initMovementCapture();
// Task7：Walk/Jump1 冲量代理原型（临时；path_proxy_run / path_proxy_tune）
initMovementProxy();
// Task7：玩家起跳采集（临时；path_pjump → 代理 hy）
initPlayerJumpCapture();

if (TEST) {
  initTest();
}
