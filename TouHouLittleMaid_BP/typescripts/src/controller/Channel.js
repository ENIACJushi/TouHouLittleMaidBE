import { system, world } from "@minecraft/server";
import * as Tool from "../libs/ScarletToolKit"
/**
 * 管理scriptevent传递消息的接口，有一个接收者，即主行为包，可以有多个发送者，发送者初始化时需要注册发送者ID
 * 每条信息的最大长度为2048
 * 格式：/scriptevent namespace:发送者ID,信息组ID "总条数:当前条:内容"
 *   发送者ID用于避免多个发送者的信息组ID重复，是三个字符，可包含 a~z A~Z 0~9 !@#$%^&*()_+-=[]{}|\ （特殊字符待验证）
 *      预留了"config"作为function型配置行为包的sender ID
 *   信息组ID是若干个字符，随机生成
 *   因为要用逗号分隔，发送者ID和信息组ID的生成规则是一致的，不能用逗号，只能用指定字符。
 *   总条数和当前条均为单个字符对应的四位十六进制数
 *   内容是由原信息分割而来的
 * 如：/scriptevent thlm:#a3^ 5:0:string_message
 */

/**
 * 
 * @param {string} namespace 命名空间
 * @param {string} id ID
 * @param {string} message 信息
 */
function sendScripMessage(namespace, id, message){
    world.getDimension("overworld").runCommand(`scriptevent ${namespace}:${id} ${message}`)
}

// 负责接收的通道（唯一）
export class ChannelMain{
    constructor(){
        // senderID:status  status可为  undefined从未注册  0正在尝试注册  false取消所有注册  true已注册
        this.senderList = {
            "config": true
        }
        // 创建注册处理
        system.afterEvents.scriptEventReceive.subscribe(event => {
            if(event.id === "thlmc:register"){// register
                // 从未注册，开始尝试
                if(this.senderList[event.message] === undefined){
                    this.senderList[event.message] = 0;
                    system.runTimeout(()=>{
                        // 尝试成功
                        if(this.senderList[event.message] === 0){
                            this.senderList[event.message] = true;
                        }
                        // 尝试失败
                        else{
                            delete this.senderList[event.message];
                        }
                    }, 1);
                }
                // 已有注册正在尝试，取消所有对这个名称的尝试
                else if(this.senderList[event.message] === 0){
                    this.senderList[event.message] = false;
                    sendScripMessage("thlmc", "register_cancel", event.message);
                }
                else if(this.senderList[event.message] === false){
                    sendScripMessage("thlmc", "register_cancel", event.message);
                }
            }
        }, {namespaces: ["thlmc"]});// touhou little maid channel (register)
    }
    
    /**
     * 接收信息
     * @param {string} namespace 需要接收的scriptevent的命名空间
     * @param {Function} callback 回调，接收一个参数，即完整信息
     */
    static subscribe(namespace, callback){
        
    }
}

// 负责发送的通道（多）
export class ChannelSender{
    constructor(){
        this.senderID = this.generateID();
        this.activated = undefined;
        
        ///// 尝试注册 /////
        let event = undefined;
        // 向主行为包发送信息
        sendScripMessage("thlmc", "register", this.senderID);
        let tryID = system.runInterval(()=>{
            if(this.activated === true){
                // 注册成功，关闭检测
                system.clearRun(tryID);
            }
            else if(this.activated === false){
                // 注册失败，重新尝试
                this.senderID = this.generateID();
                this.activated = undefined;
            }
        }, 2);
        // 接收来自主行为包的回复
        system.afterEvents.scriptEventReceive.subscribe(event => {
            if(event.id === "thlmc:register_cancel"){// register
                if(event.message === this.senderID){
                    this.activated === false;
                }
            }
        }, {namespaces: ["thlmc"]});// touhou little maid channel (register)
    }

    /**
     * @param {string} namespace scriptevent的命名空间
     * @param {string} msg 完整的消息
    */
    send(namespace, msg){
        
    }

    /**
     * 生成一个Sender ID
     */
    generateID(){

    }
}

