/**
 * 自定义组件注册
 * 在 early-execution 阶段顶层订阅 beforeEvents.startup，
 */
import { system, StartupEvent } from "@minecraft/server";
import { Skull } from "./blocks/Skull";
import { StatuesBlock } from "./blocks/StatuesBlock";
import { AltarBlock } from "./blocks/AltarBlock";
import { GarageKit } from "./blocks/GarageKit";
import { GoldMicrowaver } from "./blocks/GoldMicrowaver";
import { CustomSpellCardManger } from "./danmaku/CustomSpellCardManger";
import PowerPoint from "./altar/PowerPoint";
import { DeprecatedItemHelper } from "./items/deprecated_helper/DeprecatedHelper";
import { ConfigHelper } from "./controller/Config";
import { MaidSkin } from "./maid/MaidSkin";

const TAG = "CC_REGISTER";

/** 已注册的自定义组件 ID，便于日志核对 */
const REGISTERED_COMPONENT_IDS = [
  "tlm:skull",
  "tlm:statues",
  "tlm:altar",
  "tlm:garage_kit",
  "tlm:garage_kit_un_solid",
  "tlm:microwaver",
  "tlm:spell_card",
  "tlm:power_point",
  "tlm:deprecated",
] as const;

/**
 * 在 startup 回调中注册全部方块/物品自定义组件
 */
function registerAllCustomComponents(event: StartupEvent): void {
  // 方块
  Skull.registerCC(event);
  StatuesBlock.registerCC(event);
  AltarBlock.registerCC(event);
  GarageKit.registerCC(event);
  GoldMicrowaver.registerCC(event);
  // 物品
  CustomSpellCardManger.registerCC(event);
  PowerPoint.registerCC(event);
  DeprecatedItemHelper.registerCC(event);

  // 使用 console.warn 保证默认 content log 可见，不依赖 Config 初始化时机
  console.warn(
    `[TLM][${TAG}] Custom Components V2 registered (${REGISTERED_COMPONENT_IDS.length}): ${REGISTERED_COMPONENT_IDS.join(", ")}`,
  );

  // 依赖世界的初始化延后到世界就绪
  system.run(() => {
    ConfigHelper.init();
    PowerPoint.init(event);
    MaidSkin.initScoreboard();
  });
}

// 顶层立刻订阅，确保处于 early-execution
system.beforeEvents.startup.subscribe((event) => {
  registerAllCustomComponents(event);
});
