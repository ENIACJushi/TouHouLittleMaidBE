import { Player, world, system, Enchantment, ItemEnchantsComponent } from "@minecraft/server"
import * as Tool from"./src/libs/scarletToolKit";
import * as mcui from "@minecraft/server-ui"
import { StrMaid } from "./src/maid/StrMaid";

export default class experiment {
    static main(){
        // Entity Events
        // world.afterEvents.projectileHit.subscribe(event =>{
        //     try{
        //         Tool.showEntityComponents(event.getEntityHit().entity);
        //     }
        //     catch{}
        // })
        
        // 获取方块属性
        world.afterEvents.itemUseOn.subscribe(event=>{
            Tool.testBlockInfo(event.source.dimension, event.block.location);
        });
        // 显示玩家属性
        world.afterEvents.playerBreakBlock.subscribe(event =>{
            try{
                showForm(event.player);
                Tool.showEntityComponents(event.player);
            }
            catch{}
        });
        // 测试字符
        world.afterEvents.chatSend.subscribe(event=>{
            let player = event.sender;
            // 显示字符ASCII码
            // Tool.logger('􀐏'.charCodeAt(0).toString(16));
            // Tool.logger('一'.charCodeAt(0).toString(16));
            // Tool.logger(String.fromCodePoint(0x00008da3));
            // Tool.logger('\u{20BB7}');
            let info = ""
            info = StrMaid.Owner.setID(info, "-987842477023");
            info = StrMaid.Health.set(info, 9961, 65535)
            info = StrMaid.Skin.set(info, 0, 10);
            info = StrMaid.Work.set(info, 6);
            info = StrMaid.backpackInvisibility.set(info, true);

            Tool.logger(info);
            Tool.logger(`OwnerID:${StrMaid.Owner.getId(info)}`);
            let health = StrMaid.Health.get(info);
            Tool.logger(`Health:${health.current},${health.max}`);
            let skin = StrMaid.Skin.get(info);
            Tool.logger(`Skin:${skin.pack},${skin.index}`);
            Tool.logger(`Work:${StrMaid.Work.get(info)}`);
            Tool.logger(`backpackInvisibility:${StrMaid.backpackInvisibility.get(info)}`);

            return;
            let msg = event.message;
            if(msg.length === 2){
                
                if(true){
                    // 打印指定前缀
                    let base = parseInt(msg, 16)*16*16;
                    for(let i=0; i<16; i++){
                        let output = "";
                        for(let i2=0; i2<16; i2++){
                            output += String.fromCodePoint(base + i*16 + i2);//
                        }
                        Tool.logger(output);
                    }
                }
                else{
                    // 打印所有
                    let base=0;
                    let interv = system.runInterval(()=>{
                    if(base>=16*16) system.clearRun(interv);
                    let output = "";
                    Tool.logger(base);
                    for(let i=0; i<256; i++){
                        output += String.fromCodePoint(base*16*16 + i);//base + i*16 + i2
                    }
                    console.warn(output);
                    base++
                },5);
                }
            }
        });
        system.afterEvents.scriptEventReceive.subscribe(event => {
            system.run(()=>{
                switch(event.id){
                    case "exp:e1":{ // 测试射线寻找方块的耗时
                        let player = event.sourceEntity;
                        let vec0 = player.getViewDirection();
                        let dimension = player.dimension;
                        let location = player.location
                        
                        
                        if(false){// 单点
                            const count = 100;// 实验次数
                            let time = new Date().getTime();// 毫秒
                            
                            for(let i = 0; i < count; i++){
                                dimension.getBlockFromRay(location, vec0);
                                // dimension.getBlock(location);
                            }

                            time = (new Date().getTime()) - time;
                            Tool.logger(`实验次数：${count} | 总耗时：${time} (ms) | 平均耗时：${time/count} (ms)`)
                        }

                        if(true){
                            const length = 100;
                            let x = [0,0,0]
                            let y = [5,5,5]
                            let time = new Date().getTime();// 毫秒
                            // 网格
                            for(let i = 0; i < length; i++){
                                for(let i2 = 0; i2 < length; i2++){
                                    let a = x[0]-y[0]
                                    let b = x[1]-y[1]
                                    let c =x[2]-y[2]
                                    let d = a*a+b*b+c*c
                                    // dimension.getBlock({
                                    //     x: 1,
                                    //     y: i,
                                    //     z: i2
                                    // }); 
                                }
                            }
                            time = (new Date().getTime()) - time;
                            Tool.logger(`实验次数：${length*length} | 总耗时：${time} (ms) | 平均耗时：${time/(length*length)} (ms)`)
                        }
                    }; break;
                    default:
                        break;
                }
                
            })
        }, {namespaces: ["exp"]});
    }
}
/**
 * 
 * @param {Player} player 
 */
function showForm(player){
    const form = new mcui.ActionFormData()
        .title("标题")
        .body("-3427383902188")
        .button("ao")
        
    form.show(player).then((response) => {
    });
    return;
    {
        const form = new mcui.ActionFormData()
        .title("/V 标题")
        .body("正文")
        .button("正文2")
        .button("价格")
        .button("余票")
        .button("textures/items/bow_standby.png")
        .button("textures/items/hakurei_gohei")
        .button("textures/items/iron_hoe")
        .button("textures/items/phantom_membrane")
        
        form.show(player).then((response) => {
        });
    }
}