import * as mcui from '@minecraft/server-ui';
import { system, world, Entity, Player } from "@minecraft/server"
import { WorkType } from './MaidWorkType';
import { EntityMaid } from './EntityMaid';
import { skin_packs } from '../../data/skin_packs';
import {logger} from "../libs/scarletToolKit"

export class MaidMenu {
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
        let skin_pack = EntityMaid.getSkinPack(this.maid);
        let skin_index = EntityMaid.getSkinIndex(this.maid);

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
            .button(`选择模型 ${skin_pack},${skin_index}`)

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

        for(let i=0; i<skin_packs.length; i++){
            form.button(skin_packs[i].name);
        }
        
        form.show(this.player).then((response) => {
            if(response.selection !== null){
                this.skinindexSelection(response.selection);
            }
        });
    }
    skinindexSelection(pack){
        const form = new mcui.ActionFormData()
        .title(this.maid_name) // 女仆名，为空则使用默认标题
        .body(`模型选择`);

        for(let i=0; i<skin_packs[pack].amount; i++){
            form.button(`${i}`);
        }
        
        form.show(this.player).then((response) => {
            if(response.selection !== null){
                EntityMaid.setSkinPack(this.maid, pack);
                EntityMaid.setSkinIndex(this.maid, response.selection);
            }
        });
    }
}

