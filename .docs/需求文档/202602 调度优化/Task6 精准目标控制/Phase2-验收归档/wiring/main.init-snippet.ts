import { world, system } from "@minecraft/server"
import experiment from "./experiment"
import { initSeekAccept, initTest } from "../test/main";
import { BlockEvents } from "./events/BlockEvents";
import { EntityEvents } from "./events/EntityEvents";
import { ItemEvents } from "./events/ItemEvents";
import { PlayerEvents } from "./events/PlayerEvents";
import { WorldEvents } from "./events/WorlldEvents";
import { ScheduleEvents } from "./events/ScheduleEvents";
import { Logger } from "./controller/main";

const TAG = 'INDEX';
const TEST = false; // 是否启用测试模块

new WorldEvents().registerAllEvents();
system.runTimeout(() => {
  new PlayerEvents().registerAllEvents();
  new ItemEvents().registerAllEvents();
  new EntityEvents().registerAllEvents();
  new BlockEvents().registerAllEvents();
  new ScheduleEvents().startAllEvents();
}, 20);

system.run(() => {
  world.sendMessage("§e[Touhou Little Maid] Addon Loaded!");
})

// todo: 移走下面这些
if (false) {
  world.sendMessage('§e[Touhou Little Maid] 现在是实验模式。');
  experiment.main();
}

// Task6 Phase2：Seek 独占验收命令（不依赖 TEST）
initSeekAccept();

if (TEST) {
  initTest();
}
