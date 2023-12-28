/**
 * 配置管理器
 * 管理计分板配置项
 */

export class Config{
    UI = false;
    /**
     * 初始化计分板
     * 若不存在，则使用默认配置创建，若存在，则读取
     */
    static initScoreboard(){
        var scoreboard = world.scoreboard.getObjective("thlmconfig");
        if( scoreboard == null){
            world.getDimension("overworld").runCommand("scoreboard objectives add thlmconfig dummy THLMConfig");
            
        }
        else{

        }
    }
}

export const config = new Config();