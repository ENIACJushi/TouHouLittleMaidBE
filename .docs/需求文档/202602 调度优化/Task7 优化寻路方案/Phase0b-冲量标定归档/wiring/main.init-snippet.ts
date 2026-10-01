import { initPathFollow, initPathGapCalib, initTest } from "../test/main";

// …省略其它入口…

// Task7 Phase2：Path.follow 冒烟（永久保留）
initPathFollow();
// Task7 Phase0b：Gap 冲量标定（测完归档）
initPathGapCalib();

if (TEST) {
  initTest();
}
