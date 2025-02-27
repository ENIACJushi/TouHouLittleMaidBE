import { world, system, Entity, Player } from "@minecraft/server";
import { lang } from "../libs/ScarletToolKit";
import { ActionFormData, MessageFormData, ModalFormData } from "@minecraft/server-ui";
const CONFIG_DEFINITION = {
    ui_enable: {
        changable: true,
        default: true,
        name: lang('message.tlm.config.ui_enable.name'),
        description: lang('message.tlm.config.ui_enable.description'),
    },
    fairy_damage: {
        changable: true,
        default: 100,
        name: lang('message.tlm.config.fairy_damage.name'),
        description: lang('message.tlm.config.fairy_damage.description'),
    },
    maid_damage: {
        changable: true,
        default: 100,
        name: lang('message.tlm.config.maid_damage.name'),
        description: lang('message.tlm.config.maid_damage.description'),
    },
    danmaku_damage: {
        changable: true,
        default: 6,
        name: lang('message.tlm.config.danmaku_damage.name'),
        description: lang('message.tlm.config.danmaku_damage.description'),
    },
    player_damage: {
        changable: true,
        default: 100,
        name: lang('message.tlm.config.player_damage.name'),
        description: lang('message.tlm.config.player_damage.description'),
    },
    logger_enable: {
        changable: true,
        default: false,
        name: lang('message.tlm.config.logger_enable.name'),
        description: lang('message.tlm.config.logger_enable.description'),
    },
};
export var config = {};
/**
 * 配置管理器
 * 管理计分板配置项
 */
export class ConfigHelper {
    // 初始化计分板
    static init() {
        const scoreboard = world.scoreboard.getObjective(this.scoreName);
        if (scoreboard === undefined) { // 计分板不存在，则使用默认配置创建
            world.getDimension("overworld")
                .runCommand(`scoreboard objectives add ${this.scoreName} dummy ${this.scoreName}`);
            system.runTimeout(() => {
                this.init();
            }, 1);
            return;
        }
        // 读取或初始化计分板
        for (let key in CONFIG_DEFINITION) {
            let value;
            try {
                value = scoreboard.getScore(key);
            }
            catch {
                // 没有该项目时失败
            }
            if (value !== undefined) {
                this.set(key, value);
            }
            else {
                this.set(key, CONFIG_DEFINITION[key].default);
            }
        }
    }
    /**
     * 设置某项的值, 计分板和内存同步更改
     * @param {string} key
     * @param {int | boolean} value
     */
    static set(key, value) {
        let definition = CONFIG_DEFINITION[key];
        if (definition !== undefined) {
            if (typeof (definition.default) === 'boolean') { // 布尔型
                // 统一类型
                let value_ = value;
                if (typeof (value) === 'number') {
                    value_ = value === 1;
                }
                // 更新设置
                config[key] = value_;
                // 更新计分板
                var scoreboard = world.scoreboard.getObjective(this.scoreName);
                scoreboard.setScore(key, value_ ? 1 : 0);
            }
            else if (typeof (definition.default) === 'number') { // 整型
                // 更新设置
                config[key] = value;
                // 更新计分板
                var scoreboard = world.scoreboard.getObjective(this.scoreName);
                scoreboard.setScore(key, value);
            }
        }
    }
    // 生成字符串
    static tostring() {
        let i = 0;
        let result = "";
        for (let key in config) {
            if (i < config_lock) {
                i++;
            }
            else {
                if (typeof (config[key]) === "boolean") {
                    result += ` ${key} - ${config[key] ? "true" : "false"}\n`;
                }
                else {
                    result += ` ${key} - ${config[key]}\n`;
                }
            }
        }
        return result;
    }
}
ConfigHelper.scoreName = "thlmconfig";
/**
 * 设置面板
 */
export class ConfigForm {
    /**
     * 设置列表
     * @param {Player} player
     */
    static mainForm(player) {
        let form = new ActionFormData();
        let keys = [];
        form.title('设置');
        for (let key in CONFIG_DEFINITION) {
            let definition = CONFIG_DEFINITION[key];
            if (definition.changable) {
                keys.push(key);
                form.button(definition.name);
            }
        }
        form.show(player).then((response) => {
            if (!response.canceled && response.selection < keys.length) {
                let key = keys[response.selection];
                let definition = CONFIG_DEFINITION[key];
                if (typeof (definition.default) === 'boolean') {
                    this.boolForm(player, key, definition);
                }
                else {
                    this.numberForm(player, key, definition);
                }
            }
        });
    }
    /**
     * 设置布尔型
     * @param {Player} player
     * @param {string} key
     * @param {*} definition
     */
    static boolForm(player, key, definition) {
        let form = new ModalFormData()
            .title(definition.name)
            .toggle(definition.description, config[key])
            .submitButton('提交');
        form.show(player).then((response) => {
            if (!response.canceled) {
                ConfigHelper.set(key, response.formValues[0]);
            }
            this.mainForm(player);
        });
    }
    /**
     * 设置整型
     * @param {Player} player
     * @param {string} key
     * @param {*} definition
     */
    static numberForm(player, key, definition) {
        let form = new ModalFormData()
            .title(definition.name)
            .textField(definition.description, config[key].toString(), config[key].toString())
            .submitButton('提交');
        form.show(player).then((response) => {
            if (!response.canceled) {
                let value = parseInt(response.formValues[0]);
                if (value !== undefined && !Number.isNaN(value)) {
                    ConfigHelper.set(key, value);
                }
                else {
                    this.invalidWarning(player, () => { ConfigForm.numberForm(player, key, definition); });
                    return false;
                }
            }
            this.mainForm(player);
        });
    }
    static invalidWarning(player, lastForm) {
        let form = new MessageFormData()
            .title('失败')
            .body('无效的数据')
            .button1('重新输入')
            .button2('退出');
        form.show(player).then((response) => {
            if (!response.canceled) {
                if (response.selection === 0) {
                    lastForm();
                }
            }
        });
    }
}
//# sourceMappingURL=Config.js.map