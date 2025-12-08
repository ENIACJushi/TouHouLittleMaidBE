import { world } from "@minecraft/server";
import { config } from "./Config";

const ADDON_TAG = '§e[TLM]';

export enum LoggerLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
}

export class Logger {
  static debug(tag: string, message: string) {
    if (config.logger_level.value < LoggerLevel.DEBUG) {
      return;
    }
    let msg = `${ADDON_TAG}§7[${tag}] §r${message}`;
    console.log(msg);
    if (config.logger_enable) {
      world.sendMessage(msg);
    }
  }
  
  static info(tag: string, message: string) {
    if (config.logger_level.value < LoggerLevel.INFO) {
      return;
    }
    let msg = `${ADDON_TAG}§7[${tag}] §r${message}`;
    console.log(msg);
    if (config.logger_enable) {
      world.sendMessage(msg);
    }
  }
  
  static warn(tag: string, message: string) {
    if (config.logger_level.value < LoggerLevel.WARN) {
      return;
    }
    let msg = `${ADDON_TAG}§7[${tag}] §e${message}`;
    console.warn(msg);
    if (config.logger_enable) {
      world.sendMessage(msg);
    }
  }

  static error(tag: string, message: string) {
    if (config.logger_level.value < LoggerLevel.ERROR) {
      return;
    }
    let msg = `${ADDON_TAG}§7[${tag}] §c${message}`;
    console.error(msg);
    if (config.logger_enable) {
      world.sendMessage(msg);
    }
  }
}
