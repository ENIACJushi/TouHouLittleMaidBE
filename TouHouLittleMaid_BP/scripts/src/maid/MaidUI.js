import * as mcui from '@minecraft/server-ui';
import { system, world, Entity, Player } from "@minecraft/server"
import { EntityMaid } from './EntityMaid';
import { logger } from "../libs/scarletToolKit"
import { MaidSkin } from './MaidSkin';
import { config } from '../controller/Config';
import { MaidBackpack } from './MaidBackpack';

/**
 * @param {Player} player 
 * @param {Entity} maid 
 */
export function MainMenu(player, maid){
    if(config.UI === true){
        let form = new MaidMenuUI(player, maid);
        form.main();
    }
    else{
        let form = new MaidMenuSimple(player, maid);
        form.main();
    }
}

// 使用普通server_form的表单
class MaidMenuSimple {
    /**
     * @param {Player} player 
     * @param {Entity} maid 
     */
    constructor(player, maid){
        this.player = player;
        this.maid = maid;
        this.maid_name = maid.nameTag===""?{ translate: "entity.touhou_little_maid:maid.name"}:maid.nameTag;

    }
    main(){
        let health    = EntityMaid.Health.getComponent(this.maid);
        let work_type = EntityMaid.Work.get(this.maid);
        let home_mode = EntityMaid.Home.getMode(this.maid);
        let backpack_invisible = EntityMaid.Backpack.getInvisible(this.maid);
        let skin_pack_index    = EntityMaid.Skin.getPack(this.maid);
        let skin_index         = EntityMaid.Skin.getIndex(this.maid);
        let skin_display;
        
        // 轮询测试
        // EntityMaid.setSkinIndex(this.maid, skin_index+1);
        // return;

        skin_display = MaidSkin.getSkinDisplayName(skin_pack_index, skin_index)
        const form = new mcui.ActionFormData()
            .title(this.maid_name) // 女仆名，为空则使用默认标题
            .body(`${String.fromCodePoint(0xE605)} ${health.currentValue.toFixed(0)}/${health.defaultValue}`)
            .button({rawtext:[
                {translate: "gui.touhou_little_maid:task.switch.name"},
                {text: " | "},
                {translate: EntityMaid.Work.getLang(work_type)}]},
                EntityMaid.Work.getIMG(work_type)) // 切换工作模式 | 当前模式
            .button({ translate: EntityMaid.Home.getLang(home_mode)}, EntityMaid.Home.getImg(home_mode)) //home 模式
            .button(backpack_invisible?"显示背包":"隐藏背包", MaidBackpack.getButtonImg(backpack_invisible))
            .button({rawtext:[{text: "选择模型"},{text: " | "},skin_display]}, MaidSkin.getPackIcon(skin_pack_index))

        form.show(this.player).then((response) => {
            switch(response.selection){
                case 0:
                    this.workSelection();
                    break;
                case 1:
                    EntityMaid.Home.switchMode(this.maid);
                    system.runTimeout(()=>{this.main()},1);
                    break;
                case 2:
                    EntityMaid.Backpack.setInvisible(this.maid, !backpack_invisible);
                    // 这里不返回主菜单，直接退出
                    break;
                case 3:
                    this.skinpackSelection();
                    break;
                default:
                    break;
            }
        });
    }
    workSelection(){
        const form = new mcui.ActionFormData()
        .title(this.maid_name) // 女仆名，为空则使用默认标题
        .body(`工作模式`);

        for(let i=0; i<EntityMaid.Work.AMOUNT; i++){
            form.button(EntityMaid.Work.getLang(i), EntityMaid.Work.getIMG(i));
        }
        
        form.show(this.player).then((response) => {
            if(response.selection !== undefined){
                EntityMaid.Work.set(this.maid, response.selection);
                system.runTimeout(()=>{this.main()},2);
            }
        });
    }
    skinpackSelection(){
        const form = new mcui.ActionFormData()
        .title(this.maid_name) // 女仆名，为空则使用默认标题
        .body(`模型选择`);
        let skinList = MaidSkin.SkinList;
        for(let i=0; i < MaidSkin.length(); i++){
            form.button(MaidSkin.getPackDisplayName(i), MaidSkin.getPackIcon(i));
        }
        
        form.show(this.player).then((response) => {
            if(response.selection !== undefined){
                this.skinindexSelection(response.selection);
            }
        });
    }
    skinindexSelection(pack_index){
        const form = new mcui.ActionFormData()
        .title(MaidSkin.getPackDisplayName(pack_index)) // 女仆名，为空则使用默认标题
        .body({"rawtext":[{"translate":"gui.touhou_little_maid.author.name"}, MaidSkin.getAuthors(pack_index)]});

        for(let i = 0; i < MaidSkin.SkinList[pack_index]; i++){
            form.button(MaidSkin.getSkinDisplayName(pack_index, i));
        }
        
        form.show(this.player).then((response) => {
            if(response.selection !== undefined){
                EntityMaid.Skin.setPack(this.maid, pack_index);
                EntityMaid.Skin.setIndex(this.maid, response.selection);
            }
        });
    }
}

// 使用特殊UI的表单
class MaidMenuUI {
    /**
     * @param {Player} player 
     * @param {Entity} maid 
     */
    constructor(player, maid){
        this.player = player;
        this.maid = maid;
        this.maid_name = maid.nameTag;
    }
    main(){
        ///// 收集基础信息 /////
        let maid_name = this.maid_name===""?{rawtext:[{ translate: "entity.touhou_little_maid:maid.name"}, {text: ""}]}:this.maid_name + "";
        let health = EntityMaid.Health.getComponent(this.maid)
        let work_type = EntityMaid.Work.get(this.maid);
        let home_mode = EntityMaid.Home.getMode(this.maid);
        let backpack_invisible = EntityMaid.Backpack.getInvisible(this.maid);
        let skin_pack_index = EntityMaid.Skin.getPack(this.maid);
        let skin_index = EntityMaid.Skin.getIndex(this.maid);
        let skin_display;
        
        ///// 生成字符串 /////
        /// 皮肤包字符
        skin_display = MaidSkin.getSkinDisplayName(skin_pack_index, skin_index);
        /// 女仆信息字符(rawtext array)
        let info_str = [];
        // 健康值
        let health_int = health.currentValue.toFixed(0);
        info_str.push({text: `${EntityMaid.Health.toStr(health_int)}  ${health_int}\n`});
        info_str.push({text: "40/40"})
        // 护甲值

        // 模型名

        ///// 构建表单 /////
        const form = new mcui.ActionFormData()
            .title(maid_name) // 女仆名，为空则使用默认标题
            .body(this.maid.id)
            .button({rawtext:info_str}) // 信息单元
            .button({ translate: EntityMaid.Home.getLang(home_mode)}, EntityMaid.Home.getImg(home_mode)) //home 模式
            .button({ translate: EntityMaid.Pick.getLang(false)}, EntityMaid.Pick.getImg(false)) //pick 模式
            .button({ translate: EntityMaid.Ride.getLang(false)}, EntityMaid.Ride.getImg(false)) //ride 模式
            .button(MaidBackpack.getButtonLang(backpack_invisible), MaidBackpack.getButtonImg(backpack_invisible)) // 隐藏背包
            .button({rawtext:[{translate: "gui.touhou_little_maid:button.skin.name"}, {text: " | "}, skin_display]}, "textures/gui/maid_skin.png") // 选择模型
        // 工作模式
        for(let i = 0; i < EntityMaid.Work.AMOUNT; i++){
            if(i === work_type) form.button({rawtext:[{text: "§a"}, {translate: EntityMaid.Work.getLang(i)}]}, EntityMaid.Work.getIMG(i));
            else form.button({translate: EntityMaid.Work.getLang(i)}, EntityMaid.Work.getIMG(i));
        }

        form.show(this.player).then((response) => {
            if(response.selection !== undefined){
                switch(response.selection){
                    case 0: break; // 血量显示，没有按钮
                    case 1: EntityMaid.Home.switchMode(this.maid); system.runTimeout(()=>{this.main()},1); break; // 跟随模式
                    case 2: EntityMaid.Pick.switchMode(this.maid); system.runTimeout(()=>{this.main()},1); break; // 拾物模式
                    case 3: EntityMaid.Ride.switchMode(this.maid); system.runTimeout(()=>{this.main()},1); break; // 骑乘模式
                    case 4: EntityMaid.Backpack.setInvisible(this.maid, !backpack_invisible); system.runTimeout(()=>{this.main()},1); break; // 隐藏背包
                    case 5: this.skinpackSelection(); break; // 模型选择
                    default:// 工作模式选择
                        EntityMaid.Work.set(this.maid, response.selection - 6);
                        system.runTimeout(()=>{this.main()},1);
                        break;
                }
            }
        });
    }
    skinpackSelection(){
        let maid_name = this.maid_name===""?{rawtext:[{ translate: "entity.touhou_little_maid:maid.name"}]}:this.maid_name;

        const form = new mcui.ActionFormData()
        .title(maid_name) // 女仆名，为空则使用默认标题
        .body(`模型选择`);
        let skinList = MaidSkin.SkinList;
        for(let i = 0; i < MaidSkin.length(); i++){
            form.button(MaidSkin.getPackDisplayName(i));
        }
        
        form.show(this.player).then((response) => {
            if(response.selection !== undefined){
                this.skinindexSelection(response.selection);
            }
        });
    }
    skinindexSelection(pack_id){
        const form = new mcui.ActionFormData()
        .title(MaidSkin.getPackDisplayName(pack_id)) // 女仆名，为空则使用默认标题
        .body(MaidSkin.getAuthors(pack_id));

        for(let i = 0; i < MaidSkin.SkinList[pack_id]; i++){
            form.button(MaidSkin.getSkinDisplayName(pack_id, i));
        }
        
        form.show(this.player).then((response) => {
            if(response.selection !== undefined){
                EntityMaid.Skin.setPack(this.maid, pack_id);
                EntityMaid.Skin.setIndex(this.maid, response.selection);
            }
        });
    }
}