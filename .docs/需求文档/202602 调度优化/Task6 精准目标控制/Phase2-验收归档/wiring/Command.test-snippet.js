import { BlockComponentTypes, ItemStack, ScriptEventCommandMessageAfterEvent, system } from "@minecraft/server";
import * as Tool from"../libs/ScarletToolKit";
import {
    StrMaid,
    EntityMaid,
} from "../maid/main";
import { ConfigForm, ConfigHelper } from "./Config";
import { ManageForm } from "./ManageForm";
import { Logger } from "./Logger";
import { testCommandRegister } from "../../test/TestCommandRegister";

const TAG = 'Command';
...
    /**
     * 测试函数：转发 TestCommandRegister（seek_* / b1 等）
     * @param {ScriptEventCommandMessageAfterEvent} event
     */
    static test(event){
        let pl = event.sourceEntity;
        if (pl === undefined) {
            Logger.info(TAG, "test: no sourceEntity");
            return;
        }
        if (testCommandRegister.tryInvoke(event.message, pl)) {
            return;
        }
        Logger.info(TAG, `test unmatched message="${event.message}"`);
        if (typeof pl.sendMessage === "function") {
            pl.sendMessage(`[Command.test] unknown: "${event.message}" (try seek_help)`);
        }
    }
    /**
     * 发烟测试
     * @param {ScriptEventCommandMessageAfterEvent} event