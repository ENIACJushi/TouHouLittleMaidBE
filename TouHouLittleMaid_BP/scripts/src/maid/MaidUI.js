import * as mcui from '@minecraft/server-ui';
import { system, world, Entity, Player } from "@minecraft/server"
import { WorkType } from './MaidWorkType';
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
        let health = this.maid.getComponent("health");
        let work_type = WorkType.get(this.maid);
        let home_mode = EntityMaid.Home.getMode(this.maid);
        let backpack_invisible = EntityMaid.getBackPackInvisible(this.maid);
        let skin_pack_index = EntityMaid.getSkinPack(this.maid);
        let skin_index = EntityMaid.getSkinIndex(this.maid);
        let skin_pack = MaidSkin.getPack(skin_pack_index)
        let skin_display;
        
        // 轮询测试
        // EntityMaid.setSkinIndex(this.maid, skin_index+1);
        // return;

        if(skin_pack === undefined){
            skin_display = {text: "无效"}
        }
        else{
            skin_display = MaidSkin.getSkinDisplayName(skin_pack["name"], skin_index)
        }
        const form = new mcui.ActionFormData()
            .title(this.maid_name) // 女仆名，为空则使用默认标题
            .body(`${health.currentValue.toFixed(0)}/${health.defaultValue}`)
            .button({rawtext:[
                {translate: "gui.touhou_little_maid:task.switch.name"},
                {text: " | "},
                {translate: WorkType.getLang(work_type)}]},
                WorkType.getIMG(work_type)) // 切换工作模式 | 当前模式
            .button({ translate: EntityMaid.Home.getLang(home_mode)}, EntityMaid.Home.getImg(home_mode)) //home 模式
            .button(backpack_invisible?"显示背包":"隐藏背包")
            .button({rawtext:[
                {text: "选择模型"},
                {text: " | "},
                skin_display]})

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
                    EntityMaid.setBackPackInvisible(this.maid, !backpack_invisible);
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

        for(let i=0; i<WorkType.AMOUNT; i++){
            form.button(WorkType.getLang(i), WorkType.getIMG(i));
        }
        
        form.show(this.player).then((response) => {
            if(response.selection !== undefined){
                WorkType.set(this.maid, response.selection);
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
            form.button(MaidSkin.getPackDisplayName(skinList[i]["name"]));
        }
        
        form.show(this.player).then((response) => {
            if(response.selection !== undefined){
                this.skinindexSelection(skinList[response.selection]);
            }
        });
    }
    skinindexSelection(pack){
        const form = new mcui.ActionFormData()
        .title(MaidSkin.getPackDisplayName(pack["name"])) // 女仆名，为空则使用默认标题
        .body(MaidSkin.getAuthors(pack["name"]));

        for(let i = 0; i < pack["length"]; i++){
            form.button(MaidSkin.getSkinDisplayName(pack["name"], i));
        }
        
        form.show(this.player).then((response) => {
            if(response.selection !== undefined){
                EntityMaid.setSkinPack(this.maid, pack["index"]);
                EntityMaid.setSkinIndex(this.maid, response.selection);
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
        let health = EntityMaid.Health.get(this.maid)
        let work_type = WorkType.get(this.maid);
        let home_mode = EntityMaid.Home.getMode(this.maid);
        let backpack_invisible = EntityMaid.getBackPackInvisible(this.maid);
        let skin_pack_index = EntityMaid.getSkinPack(this.maid);
        let skin_index = EntityMaid.getSkinIndex(this.maid);
        let skin_pack = MaidSkin.getPack(skin_pack_index)
        let skin_display;
        
        ///// 生成字符串 /////
        /// 皮肤包字符
        if(skin_pack === undefined){
            skin_display = {text: "无效"}
        }
        else{
            skin_display = MaidSkin.getSkinDisplayName(skin_pack["name"], skin_index)
        }
        /// 女仆信息字符(rawtext array)
        let info_str = [];
        // 健康值
        let health_int = health.currentValue.toFixed(0);
        info_str.push({text: `${EntityMaid.Health.toStr(health_int)}  ${health_int}\n`});
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
        for(let i = 0; i < WorkType.AMOUNT; i++){
            if(i === work_type) form.button({rawtext:[{text: "§a"}, {translate: WorkType.getLang(i)}]}, WorkType.getIMG(i));
            else form.button({translate: WorkType.getLang(i)}, WorkType.getIMG(i));
        }

        form.show(this.player).then((response) => {
            if(response.selection !== undefined){
                switch(response.selection){
                    case 0: break; // 血量显示，没有按钮
                    case 1: EntityMaid.Home.switchMode(this.maid); system.runTimeout(()=>{this.main()},1); break; // 跟随模式
                    case 2: EntityMaid.Pick.switchMode(this.maid); system.runTimeout(()=>{this.main()},1); break; // 拾物模式
                    case 3: EntityMaid.Ride.switchMode(this.maid); system.runTimeout(()=>{this.main()},1); break; // 骑乘模式
                    case 4: EntityMaid.setBackPackInvisible(this.maid, !backpack_invisible); system.runTimeout(()=>{this.main()},1); break; // 隐藏背包
                    case 5: this.skinpackSelection(); break; // 模型选择
                    default:// 工作模式选择
                        WorkType.set(this.maid, response.selection - 6);
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
            form.button(MaidSkin.getPackDisplayName(skinList[i]["name"]));
        }
        
        form.show(this.player).then((response) => {
            if(response.selection !== undefined){
                this.skinindexSelection(skinList[response.selection]);
            }
        });
    }
    skinindexSelection(pack){
        const form = new mcui.ActionFormData()
        .title(MaidSkin.getPackDisplayName(pack["name"])) // 女仆名，为空则使用默认标题
        .body(MaidSkin.getAuthors(pack["name"]));

        for(let i = 0; i < pack["length"]; i++){
            form.button(MaidSkin.getSkinDisplayName(pack["name"], i));
        }
        
        form.show(this.player).then((response) => {
            if(response.selection !== undefined){
                EntityMaid.setSkinPack(this.maid, pack["index"]);
                EntityMaid.setSkinIndex(this.maid, response.selection);
            }
        });
    }
}