import * as mcui from '@minecraft/server-ui';
import { system, world, Entity, Player } from "@minecraft/server"
import { WorkType } from './MaidWorkType';
import { EntityMaid } from './EntityMaid';
import {logger} from "../libs/scarletToolKit"
import { MaidSkin } from './MaidSkin';

export class MaidMenu {
    /**
     * @param {Player} player 
     * @param {Entity} maid 
     */
    constructor(player, maid){
        this.player = player;
        this.maid = maid;
        this.maid_name = maid.nameTag===""?{ translate: "entity.touhou_little_maid:maid.name"}:maid.nameTag + "";

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
            .body("-3513283248127")
            //.body(`${health.currentValue.toFixed(0)}/${health.defaultValue}`)
            .button({rawtext:[
                {translate: "gui.touhou_little_maid:task.switch.name"},
                {text: " | "},
                {translate: WorkType.getLang(work_type)}]},
                WorkType.getIMG(work_type)) // 切换工作模式 | 当前模式
            .button({ translate: EntityMaid.Home.getLang(home_mode)}, EntityMaid.Home.getImg(home_mode)) //home 模式
            .button({ translate: EntityMaid.Pick.getLang(false)}, EntityMaid.Pick.getImg(false)) //pick 模式
            .button({ translate: EntityMaid.Ride.getLang(false)}, EntityMaid.Ride.getImg(false)) //ride 模式
            .button(backpack_invisible?"显示背包":"隐藏背包")
            .button({rawtext:[
                {text: "选择模型"},
                {text: " | "},
                skin_display]})
            //workSelection
            for(let i=0; i<WorkType.AMOUNT; i++){
            form.button(WorkType.getLang(i), WorkType.getIMG(i));
            }

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
                    WorkType.set(this.maid, response.selection - 6);
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
            if(response.selection !== null){
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
            if(response.selection !== null){
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
            if(response.selection !== null){
                EntityMaid.setSkinPack(this.maid, pack["index"]);
                EntityMaid.setSkinIndex(this.maid, response.selection);
            }
        });
    }
}

