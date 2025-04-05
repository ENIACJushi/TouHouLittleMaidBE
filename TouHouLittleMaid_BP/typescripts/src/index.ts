import { world, system } from "@minecraft/server"
import experiment from "./experiment"
import { initTest } from "../test/index";
import { BlockEvents } from "./events/BlockEvents";
import { EntityEvents } from "./events/EntityEvents";
import { ItemEvents } from "./events/ItemEvents";
import { PlayerEvents } from "./events/PlayerEvents";
import { WorldEvents } from "./events/WorlldEvents";
import { ScheduleEvents } from "./events/ScheduleEvents";
import { Logger } from "./controller/main";

const TEST = true; // 是否启用测试模块

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

if (TEST) {
  initTest();
}

if (false) {
  // 伤害统计
  var total = 0;
  var count = 0;
  var max = 0;
  var min = 999;
  var start = 0; // ms
  world.afterEvents.entityHurt.subscribe(event => {
    //// 伤害信息 ////
    Logger.info(` ${event?.damageSource?.damagingEntity?.typeId ?? '?'
      } -> ${event.hurtEntity.typeId}: ${event.damage.toFixed(2)}`);

    //// 伤害统计 ////
    if (event.damage < 0) return; // 排除治疗
    count++;
    total += event.damage;

    // 平均
    let time = new Date().getTime();
    let average1 = total / count; // 每次伤害
    let average2 = 0; // dps
    if (start === 0) {
      start = time;
    }
    else {
      average2 = total / (time - start) * 1000;
    }
    // 极值
    max = Math.max(max, event.damage);
    min = Math.min(min, event.damage);
    Logger.info(` Hit: ${count.toFixed(2)} | MIN: ${min.toFixed(2) } | MAX:${max.toFixed(2)
      } | DPH :${average1.toFixed(2)} | DPS: ${average2.toFixed(2)}`);
  });
}