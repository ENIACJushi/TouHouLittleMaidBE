import { world, system, Entity, Player } from "@minecraft/server";
import * as Tool from "../libs/ScarletToolKit"
import { ActionFormData, MessageFormData, ModalFormData } from "@minecraft/server-ui";

const CONFIG_DEFINITION = {
    ui_enable: {
        changable: true,
        default: false,
        name: '特殊UI',
        description: 'UI与其他模组冲突时可关闭此选项，展示普通UI'
    },
    fairy_damage: {
        changable: true,
        default: 100,
        name: '妖精女仆攻击倍数',
        description: '妖精女仆的弹幕伤害会乘上 (设置项/100)'
    },
    maid_damage: {
        changable: true,
        default: 100,
        name: '女仆攻击倍数',
        description: '女仆的弹幕伤害会乘上 (设置项/100)'
    },
    danmaku_damage: {
        changable: false,
        default: 6,
        name: '默认弹幕攻击力',
        description: '弹幕的默认伤害，弹幕没有设置伤害时生效，目前只对玩家使用普通御币发射的弹幕有效'
    },
    player_damage: {
        changable: true,
        default: 100,
        name: '玩家攻击倍数',
        description: '玩家的弹幕伤害会乘上 (设置项/100)'
    },
    logger_enable: {
        changable: true,
        default: false,
        name: '日志输出',
        description: '广播调试日志到世界'
    },
}
export var config = {};

/**
 * 配置管理器
 * 管理计分板配置项
 */
export class ConfigHelper {
    static name = "thlmconfig";
    // 初始化计分板
    static init(){
        const scoreboard = world.scoreboard.getObjective(this.name);
        if (scoreboard === undefined) { // 计分板不存在，则使用默认配置创建
            world.getDimension("overworld")
                .runCommand(`scoreboard objectives add ${this.name} dummy ${this.name}`);
            system.runTimeout(() => {
                this.init();
            }, 1);
            Tool.logger("what");
            return;
        }
        // 读取或初始化计分板
        for(let key in CONFIG_DEFINITION){
            let value = scoreboard.getScore(key);
            if (value !== undefined) {
                this.set(key, value);
            } else {
                this.set(key, CONFIG_DEFINITION[key].default);
            }
        }
        Tool.logger(config["ui_enable"]);
    }

    /**
     * 设置某项的值, 计分板和内存同步更改
     * @param {string} key 
     * @param {int | boolean} value
     */
    static set(key, value) {
        let definition = CONFIG_DEFINITION[key];
        if(definition !== undefined){
            if (typeof(definition.default) === 'boolean') { // 布尔型
                // 统一类型
                let value_ = value;
                if (typeof(value) === 'number') {
                    value_ = value === 1;
                }
                // 更新设置
                config[key] = value_;
                // 更新计分板
                var scoreboard = world.scoreboard.getObjective(this.name);
                scoreboard.setScore(key, value_ ? 1 : 0);
            } else if (typeof(definition.default) === 'number') { // 整型
                // 更新设置
                config[key] = value;
                // 更新计分板
                var scoreboard = world.scoreboard.getObjective(this.name);
                scoreboard.setScore(key, value);
            }
        }
    }

    // 生成字符串
    static tostring(){
        let i = 0;
        let result = "";
        for(let key in config){
            if(i < config_lock){
                i++
            }
            else{
                if(typeof(config[key])==="boolean"){
                    result += ` ${key} - ${config[key]?"true":"false"}\n`
                }
                else{
                    result += ` ${key} - ${config[key]}\n`
                }
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
     * @param {Player} player 
     */
    static mainForm (player) {
        let form = new ActionFormData();
        let keys = [];
        form.title('设置');
        for(let key in CONFIG_DEFINITION){
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
                if(typeof(definition.default) === 'boolean'){
                    this.boolForm(player, key, definition);
                }
                else{
                    this.numberForm(player, key, definition)
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
    static boolForm(player, key, definition){
        let form = new ModalFormData()
            .title(definition.name)
            .toggle(definition.description, config[key])
            .submitButton('提交');

        form.show(player).then((response) => {
            if(!response.canceled){
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
    static numberForm(player, key, definition){
        let form = new ModalFormData()
            .title(definition.name)
            .textField(definition.description, config[key].toString(), config[key].toString())
            .submitButton('提交');
            
        form.show(player).then((response) => {
            if(!response.canceled){
                let value = parseInt(response.formValues[0]);
                if(value !== undefined && !Number.isNaN(value)){
                    ConfigHelper.set(key, value);
                }
                else{
                    this.invalidWarning(player, ()=>{ConfigForm.numberForm(player, key, definition)});
                    return false;
                }
            }
            this.mainForm(player);
        });
    }
    static invalidWarning (player, lastForm){
        let form = new MessageFormData()
            .title('失败')
            .body('无效的数据')
            .button1('重新输入')
            .button2('退出')
        form.show(player).then((response) => {
            if (!response.canceled) {
                if(response.selection === 0){
                    lastForm();
                }
            }
        })
    }
}