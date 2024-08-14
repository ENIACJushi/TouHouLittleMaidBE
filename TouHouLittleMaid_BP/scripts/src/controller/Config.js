import { world, system, Entity } from "@minecraft/server";
import * as Tool from "../libs/ScarletToolKit"


const config_lock = 1;// 锁定的配置项数量,锁定配置项总放在最前
export var config={
    /**
     * 已弃用
     * true ：阵亡时在原地生成背包
     * false：不生成背包，在复活时物品会自动回到女仆身上
     * 建议多人游戏时设为true
     */
    "maid_death_bag": false,
    // 公开的配置项 只能为 整数 或 布尔值
    "ui_enable"     : 1,   // 是否启用特殊UI
    "fairy_damage"  : 100, // 妖精女仆弹幕攻击力的倍数因子，伤害最后会乘上(这个数/100)
    "maid_damage"   : 100, // 女仆弹幕攻击力的倍数因子，伤害最后会乘上(这个数/100)
    "danmaku_damage": 6,   // 弹幕的默认伤害，弹幕没有设置伤害时生效，目前只对玩家使用普通御币发射的弹幕有效
    "player_damage" : 100, // 玩家弹幕攻击力的倍数因子，伤害最后会乘上(这个数/100)
    "logger_enable" : 0,   // 是否启用日志输出
    "glyph"         : 0xE5 // 指南书特殊字符的起点 (除以0xFF)
}

/**
 * 配置管理器
 * 管理计分板配置项
 */
export class ConfigHelper{
    static name = "thlmconfig";
    // 初始化计分板   若不存在，则使用默认配置创建，若存在，则读取
    static init(){
        var scoreboard = world.scoreboard.getObjective(this.name);
        if( scoreboard === undefined){
            // 创建
            world.getDimension("overworld").runCommand(`scoreboard objectives add ${this.name} dummy ${this.name}`);
            system.runTimeout(()=>{
                this.setScoreboard()
            },1);
            
        }
        else{
            // 读取
            let allScores = scoreboard.getScores();
            for(let score of allScores){
                let key = score.participant.displayName;
                switch(typeof(config[key])){
                    case "boolean": config[key] = score.score===1?true:false; break;
                    case "number": config[key] = score.score; break;
                    default: break;
                }
            }
        }
    }

    // 用内存中的设置覆盖计分板
    static setScoreboard(){
        var scoreboard = world.scoreboard.getObjective(this.name);
        // 设置计分项
        let i=0;
        for(let key in config){
            if(i < config_lock){
                i++
            }
            else{
                if(typeof(config[key])==="boolean"){
                    scoreboard.setScore(key, config[key]?1:0);
                }
                else{
                    scoreboard.setScore(key, config[key]);
                }
            }
        }
    }

    /**
     * 设置某项的值, 计分板和内存同步更改
     * @param {string} key 
     * @param {int} value 
     */
    static set(key, value){
        // 设置计分板
        var scoreboard = world.scoreboard.getObjective(this.name);
        scoreboard.setScore(key, value);
        // 设置内存
        if(typeof(config[key]) === "boolean"){
            config[key] = value===1?true:false;
        }
        else{
            config[key] = value;
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
