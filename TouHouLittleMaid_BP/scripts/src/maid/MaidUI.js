import * as mcui from '@minecraft/server-ui';
import { system, world, Entity, Player } from "@minecraft/server"
import { EntityMaid } from './EntityMaid';
import { logger } from "../libs/scarletToolKit"
import { MaidSkin } from './MaidSkin';
import { config } from '../controller/Config';
import { MaidBackpack } from './MaidBackpack';

/**
 * 打开主菜单
 * @param {Player} player 
 * @param {Entity} maid 
 */
export function MainMenu(player, maid){
    if(config["ui_enable"] === 1){
        let form = new MaidMenuUI(player, maid);
        form.main();
    }
    else{
        let form = new MaidMenuSimple(player, maid);
        form.main();
    }
}

/**
 * 打开皮肤菜单
 * @param {Player} player 
 * @param {Entity} maid 
 */
export function SkinMenu(player, maid, selectSkin=true){
    if(config["ui_enable"] === 1){
        let form = new MaidMenuUI(player, maid);
        form.skinpackSelection(selectSkin);
    }
    else{
        let form = new MaidMenuSimple(player, maid);
        form.skinpackSelection(selectSkin);
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
        let mode_pick = EntityMaid.Pick.get(this.maid);
        let backpack_invisible = EntityMaid.Backpack.getInvisible(this.maid);
        let skin_pack_index    = EntityMaid.Skin.getPack(this.maid);
        let skin_index         = EntityMaid.Skin.getIndex(this.maid);
        let skin_display;
        
        // 轮询测试
        // EntityMaid.setSkinIndex(this.maid, skin_index+1);
        // return;

        skin_display = MaidSkin.getSkinDisplayName(skin_pack_index, skin_index)
        const form = new mcui.ActionFormData()
            // 标题  女仆名，为空则使用默认名称
            .title(this.maid_name) 
            // 信息
            .body( 
                ` | §6Lv.${EntityMaid.Level.get(this.maid)}§r` + 
                ` | ${String.fromCodePoint(0xE605)} ${health.currentValue.toFixed(0)}/${health.defaultValue}` + 
                ` | ${String.fromCodePoint(0xE609)} ${EntityMaid.Kill.get(this.maid)} |`
            )  
            // 切换工作模式 | 当前模式
            .button({rawtext:[{translate: "gui.touhou_little_maid:task.switch.name"}, {text: " | "},
                {translate: EntityMaid.Work.getLang(work_type)}]}, EntityMaid.Work.getIMG(work_type))
            // Home 模式
            .button({ translate: EntityMaid.Home.getLang(home_mode)}, EntityMaid.Home.getImg(home_mode))
            // 显示/隐藏背包
            .button({rawtext:[{translate: backpack_invisible
                ? "gui.touhou_little_maid:button.backpack.true.name"
                : "gui.touhou_little_maid:button.backpack.false.name"}]}, MaidBackpack.getButtonImg(backpack_invisible))
            // 拾物模式
            .button({rawtext:[{translate: mode_pick
                ? "gui.touhou_little_maid:button.pickup.true.name"
                : "gui.touhou_little_maid:button.pickup.false.name"}]}, EntityMaid.Pick.getImg(mode_pick))
            // 选择模型
            .button({rawtext:[{translate: "gui.touhou_little_maid:button.skin.name"},{text: " | "}, skin_display]}, MaidSkin.getPackIcon(skin_pack_index))

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
                    EntityMaid.Pick.set(this.maid, !mode_pick);
                    system.runTimeout(()=>{this.main()},1);
                    break;
                case 4:
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
    skinpackSelection(selectSkin=true){
        const form = new mcui.ActionFormData()
        .title(this.maid_name) // 女仆名，为空则使用默认标题
        .body({rawtext:[{translate: "gui.touhou_little_maid:button.skin.name"}]});
        let skinList = MaidSkin.SkinList;
        let i = 0;
        for(; i < MaidSkin.DEFAULTAMOUNT ; i++){
            form.button(MaidSkin.getPackDisplayName(i), MaidSkin.getPackIcon(i));
        }
        for(; i < MaidSkin.length(); i++){
            form.button(MaidSkin.getPackDisplayName(i+100), MaidSkin.getPackIcon(i+100));
        }
        
        form.show(this.player).then((response) => {
            if(response.selection !== undefined){
                let skin_pack = response.selection<MaidSkin.DEFAULTAMOUNT?response.selection:response.selection+100;
                if(selectSkin){
                    this.skinindexSelection(skin_pack);
                }
                else{
                    EntityMaid.Skin.setPack(this.maid, skin_pack);
                }
            }
        });
    }
    skinindexSelection(pack_index){
        const form = new mcui.ActionFormData()
        .title(MaidSkin.getPackDisplayName(pack_index)) // 女仆名，为空则使用默认标题
        .body({"rawtext":[{"translate":"gui.touhou_little_maid.author.name"}, MaidSkin.getAuthors(pack_index)]});

        for(let i = 0; i < MaidSkin.getSkinAmount(pack_index); i++){
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
        let maid_name = this.maid_name===""
            ?{rawtext:[{text: `/M ${EntityMaid.Level.getStr(this.maid)} `}, 
                { translate: "entity.touhou_little_maid:maid.name"}]}
            :"/M " + `${EntityMaid.Level.getStr(this.maid)} ` + this.maid_name;
        let health = EntityMaid.Health.getComponent(this.maid)
        let work_type = EntityMaid.Work.get(this.maid);
        let home_mode = EntityMaid.Home.getMode(this.maid);
        let pick_mode = EntityMaid.Pick.get(this.maid);
        let backpack_invisible = EntityMaid.Backpack.getInvisible(this.maid);
        let skin_pack_index = EntityMaid.Skin.getPack(this.maid);
        let skin_index = EntityMaid.Skin.getIndex(this.maid);
        let skin_display;
        
        ///// 生成字符串 /////
        /// 皮肤包字符
        skin_display = MaidSkin.getSkinDisplayName(skin_pack_index, skin_index);

        ///// 构建表单 /////
        const form = new mcui.ActionFormData()
            // 女仆名，为空则使用默认标题
            .title(maid_name)
            .body(this.maid.id)
            // 女仆信息
            .button(
                `${String.fromCodePoint(0xE605)} ${health.currentValue.toFixed(0)}/${health.defaultValue}\n` + 
                `${String.fromCodePoint(0xE609)} ${EntityMaid.Kill.get(this.maid)} `
            )
            // Home 模式
            .button({ translate: EntityMaid.Home.getLang(home_mode)}, EntityMaid.Home.getImg(home_mode)) //home 模式
            // 拾物模式
            .button({ translate: EntityMaid.Pick.getLang(pick_mode)}, EntityMaid.Pick.getImg(pick_mode)) //pick 模式
            // 骑乘模式（未实现）
            .button({ translate: EntityMaid.Ride.getLang(false)}, EntityMaid.Ride.getImg(false)) //ride 模式
            // 显示/隐藏背包
            .button(MaidBackpack.getButtonLang(backpack_invisible), MaidBackpack.getButtonImg(backpack_invisible)) // 隐藏背包
            // 选择模型
            .button({rawtext:[{translate: "gui.touhou_little_maid:button.skin.name"}, {text: " | "}, skin_display]}, "textures/gui/maid_skin.png") // 选择模型
        // 工作模式
        for(let i = 0; i < EntityMaid.Work.AMOUNT; i++){
            if(i === work_type) form.button({rawtext:[{text: "§a"}, {translate: EntityMaid.Work.getLang(i)}]}, EntityMaid.Work.getIMG(i));
            else form.button({translate: EntityMaid.Work.getLang(i)}, EntityMaid.Work.getIMG(i));
        }

        form.show(this.player).then((response) => {
            if(response.selection !== undefined){
                switch(response.selection){
                    case 0: break; // 无功能
                    case 1: EntityMaid.Home.switchMode(this.maid); system.runTimeout(()=>{this.main()},1); break; // Home 模式
                    case 2: EntityMaid.Pick.set(this.maid, !pick_mode); system.runTimeout(()=>{this.main()},1); break; // 拾物模式
                    case 3: EntityMaid.Ride.switchMode(this.maid); system.runTimeout(()=>{this.main()},1); break; // 骑乘模式
                    case 4: EntityMaid.Backpack.setInvisible(this.maid, !backpack_invisible); system.runTimeout(()=>{this.main()},1); break; // 隐藏背包
                    case 5: this.skinpackSelection(); break; // 模型选择
                    default:// 工作模式选择
                        EntityMaid.Work.set(this.maid, response.selection - 6);
                        system.runTimeout(()=>{this.main()},2);
                        break;
                }
            }
        });
    }
    // 相对普通UI多了一个字符拼接的过程
    skinpackSelection(selectSkin=true){
        let maid_name = this.maid_name===""?{rawtext:[{ translate: "entity.touhou_little_maid:maid.name"}]}:this.maid_name;

        const form = new mcui.ActionFormData()
        .title(maid_name) // 女仆名，为空则使用默认标题
        .body({rawtext:[{translate: "gui.touhou_little_maid:button.skin.name"}]});
        let skinList = MaidSkin.SkinList;
        let i = 0;
        for(; i < MaidSkin.DEFAULTAMOUNT ; i++){
            form.button(MaidSkin.getPackDisplayName(i), MaidSkin.getPackIcon(i));
        }
        for(; i < MaidSkin.length(); i++){
            form.button(MaidSkin.getPackDisplayName(i+100), MaidSkin.getPackIcon(i+100));
        }
        
        form.show(this.player).then((response) => {
            if(response.selection !== undefined){
                let skin_pack = response.selection<MaidSkin.DEFAULTAMOUNT?response.selection:response.selection+100;
                if(selectSkin){
                    this.skinindexSelection(skin_pack);
                }
                else{
                    EntityMaid.Skin.setPack(this.maid, skin_pack);
                }
            }
        });
    }
    // 与普通UI完全一致
    skinindexSelection(pack_index){
        const form = new mcui.ActionFormData()
        .title(MaidSkin.getPackDisplayName(pack_index)) // 女仆名，为空则使用默认标题
        .body({"rawtext":[{"translate":"gui.touhou_little_maid.author.name"}, MaidSkin.getAuthors(pack_index)]});

        for(let i = 0; i < MaidSkin.getSkinAmount(pack_index); i++){
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