import { initImpulseSweep, initPathFollow, initTest } from "../test/main";

// …省略其它入口…

// Task7 Phase2：Path.follow 冒烟（永久保留）
initPathFollow();
// Task7 Phase0c：冲量→落点扫测（首触地+Seek；测完归档卸掉）
initImpulseSweep();

if (TEST) {
  initTest();
}
