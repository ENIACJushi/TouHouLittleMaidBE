import { world, system, Entity, Player, RawText } from "@minecraft/server";
import { lang } from "../libs/ScarletToolKit"
import { ActionFormData, MessageFormData, ModalFormData } from "@minecraft/server-ui";
import { LoggerLevel } from "./Logger";

// 计分项名称
const SCORE_NAME = "thlmconfig";

// 配置项列表
class Config {
  ui_enable = new ConfigItemBoolean({
    defaultValue: true,
    changable: true,
    configName: 'ui_enable'
  });
  fairy_damage = new ConfigItemNumber({
    defaultValue: 100,
    changable: true,
    configName: 'fairy_damage'
  });
  maid_damage = new ConfigItemNumber({
    defaultValue: 100,
    changable: true,
    configName: 'maid_damage'
  });
  danmaku_damage = new ConfigItemNumber({
    defaultValue: 6,
    changable: true,
    configName: 'danmaku_damage'
  });
  player_damage = new ConfigItemNumber({
    defaultValue: 100,
    changable: true,
    configName: 'player_damage'
  });
  logger_enable = new ConfigItemBoolean({
    defaultValue: false,
    changable: true,
    configName: 'logger_enable'
  });
  logger_level = new ConfigItemNumber({
    defaultValue: LoggerLevel.WARN,
    changable: true,
    configName: 'logger_level'
  });
}

abstract class ConfigItem<T> {
  value: T;
  defaultValue: T;
  changable: boolean = false;
  configName: string = '';

  constructor (data: {defaultValue: T, changable: boolean, configName: string}) {
    this.value = data.defaultValue;
    this.defaultValue = data.defaultValue;
    this.changable = data.changable;
    this.configName = data.configName;
  }
  
  abstract set(value: number|boolean): void;
  get name(): RawText {
    return lang(`message.tlm.config.${this.configName}.name`);
  }
  get description(): RawText {
    return lang(`message.tlm.config.${this.configName}.description`);
  }
}

class ConfigItemBoolean extends ConfigItem<boolean> {
  set (value: number|boolean) {
    let value_: boolean = false;
    // 若传入数字，先转换
    if (typeof (value) === 'number') {
      value_ = value === 1;
    } else {
      value_ = value;
    }
    // 更新设置
    this.value = value_;
    // 更新计分板
    var scoreboard = world.scoreboard.getObjective(SCORE_NAME);
    scoreboard?.setScore(this.configName, value_ ? 1 : 0);
  }
}

class ConfigItemNumber extends ConfigItem<number> {
  set (value: number|boolean) {
    let _value = typeof value === 'boolean' ? (value ? 1 : 0) : value;

    this.value = _value;
    var scoreboard = world.scoreboard.getObjective(SCORE_NAME);
    scoreboard?.setScore(this.configName, _value);
  }
}

export const config: Config = new Config();


/**
 * 配置管理器
 * 管理计分板配置项
 */
export class ConfigHelper {
  // 初始化计分板
  static init() {
    const scoreboard = world.scoreboard.getObjective(SCORE_NAME);

    // 计分板不存在，使用默认配置创建
    if (scoreboard === undefined) {
      world.getDimension("overworld")
        .runCommand(`scoreboard objectives add ${SCORE_NAME} dummy ${SCORE_NAME}`);
      system.runTimeout(() => {
        this.init();
      }, 1);
      return;
    }

    // 读取或初始化计分项
    const keys = Object.keys(config);
    keys.forEach((key) => {
      let value: number|undefined;
      try {
        value = scoreboard.getScore(key);
      } catch { }

      if (value === undefined) {
        return;
      }
      config[key as keyof Config].set(value);
    });
  }

  // 生成字符串
  static tostring() {
    let i = 0;
    let result = "";
    for (let key in config) {
      let value = config[key as keyof Config];
      if (typeof value === 'boolean') {
        result += ` ${key} - ${value ? "true" : "false"}\n`
      }
      else {
        result += ` ${key} - ${value}\n`
      }
    }
    return result;
  }
}

/**
 * 设置面板
 */
export class ConfigForm {
  /**
   * 设置列表
   */
  static mainForm(player: Player) {
    let form = new ActionFormData();
    let keys = [];
    form.title('设置');
    for (let key in config) {
      let definition = config[key as keyof Config];
      if (definition.changable) {
        keys.push(key);
        form.button(definition.name);
      }
    }
    form.show(player).then((response) => {
      if (response.canceled || response.selection === undefined || response.selection >= keys.length) {
        return;
      }
      
      let key = keys[response.selection] as keyof Config;
      let definition = config[key];
      if (typeof definition.defaultValue === 'boolean') {
        this.boolForm(player, key, definition);
      }
      else {
        this.numberForm(player, key, definition)
      }
    });
  }
  /**
   * 设置布尔型
   * @param {Player} player 
   * @param {string} key 
   * @param {*} definition 
   */
  static boolForm(player: Player, key: keyof Config, definition: any) {
    let form = new ModalFormData()
      .title(definition.name)
      .toggle(definition.description, {
        defaultValue: config[key].value as boolean
      })
      .submitButton('提交');

    form.show(player).then((response) => {
      if (!response.canceled && response?.formValues?.[0] !== undefined) {
        config[key].set(response.formValues[0] as boolean);
      }
      this.mainForm(player);
    });
  }
  /**
   * 设置整型
   */
  static numberForm(player: Player, key: keyof Config, definition: any) {
    let oriValue = config[key].value as number
    let form = new ModalFormData()
      .title(definition.name)
      .textField(definition.description, oriValue.toString(), {
        defaultValue: oriValue.toString()
      })
      .submitButton('提交');

    form.show(player).then((response) => {
      if (!response.canceled && response?.formValues?.[0] !== undefined) {
        let value = parseInt(response.formValues[0] as string);
        if (value !== undefined && !Number.isNaN(value)) {
          config[key].set(value);
        }
        else {
          this.invalidWarning(player, () => { ConfigForm.numberForm(player, key, definition) });
          return false;
        }
      }
      this.mainForm(player);
    });
  }
  static invalidWarning(player: Player, lastForm: ()=>void) {
    let form = new MessageFormData()
      .title('失败')
      .body('无效的数据')
      .button1('重新输入')
      .button2('退出')
    form.show(player).then((response) => {
      if (!response.canceled) {
        if (response.selection === 0) {
          lastForm();
        }
      }
    })
  }
}