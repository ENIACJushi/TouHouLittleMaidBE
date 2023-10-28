import { Player, world, system, Enchantment, ItemEnchantsComponent } from "@minecraft/server"
import * as Tool from"./src/libs/scarletToolKit";
import * as mcui from "@minecraft/server-ui"

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
            // Tool.logger('􀐏'.charCodeAt(1).toString(16));

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