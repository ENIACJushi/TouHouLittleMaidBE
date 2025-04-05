import { world } from "@minecraft/server";
import { config } from "../controller/Config";

const ADDON_TAG = '§e[TLM] §c';

export enum LoggerLevel {
  NONE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
}

export class Logger {
  static level: LoggerLevel = LoggerLevel.NONE;

  static debug(message?: any, ...optionalParams: any[]) {
    if (config.logger_level.value >= LoggerLevel.DEBUG) {
      console.log(ADDON_TAG, message, optionalParams);
      if (config.logger_enable) {
        world.sendMessage([message, optionalParams]);
      }
    }
  }
  
  static info(message?: any, ...optionalParams: any[]) {
    if (config.logger_level.value >= LoggerLevel.INFO) {
      console.log(ADDON_TAG, message, optionalParams);
      if (config.logger_enable) {
        world.sendMessage([message, optionalParams]);
      }
    }
  }
  
  static warn(message?: any, ...optionalParams: any[]) {
    if (config.logger_level.value >= LoggerLevel.WARN) {
      console.warn(ADDON_TAG, message, optionalParams);
      if (config.logger_enable) {
        world.sendMessage([message, optionalParams]);
      }
    }
  }
}
