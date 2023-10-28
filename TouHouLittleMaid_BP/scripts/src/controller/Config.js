/**
 * 配置管理器
 * 管理计分板配置项
 */

export class Config{
    UI = true;
    constructor(){
        this.UI = true;
    }

}

export const config = new Config();