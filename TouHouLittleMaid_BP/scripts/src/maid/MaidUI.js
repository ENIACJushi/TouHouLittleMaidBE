import * as mcui from '@minecraft/server-ui';
import { system, world, Entity, Player } from "@minecraft/server"
import { WorkType } from './MaidWorkType';
import { EntityMaid } from './EntityMaid';
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
        const form = new mcui.ActionFormData()
            .title(this.maid_name) // 女仆名，为空则使用默认标题
            .body(`${health.currentValue}/${health.defaultValue}`)
            .button({rawtext:[
                {translate: "gui.touhou_little_maid:task.switch.name"},
                {text: " | "},
                {translate: WorkType.getLang(work_type)}]},
                WorkType.getIMG(work_type)) // 切换工作模式 | 当前模式
            .button({ translate: EntityMaid.Home.getLang(home_mode)}, EntityMaid.Home.getImg(home_mode)) //home 模式
            
        form.show(this.player).then((response) => {
            switch(response.selection){
                case 0:
                    this.workSelection();
                    break;
                case 1:
                    EntityMaid.Home.switchMode(this.maid);
                    system.runTimeout(()=>{this.main()},1);
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
            if(response.selection!=null){
                WorkType.set(this.maid, response.selection);
                system.runTimeout(()=>{this.main()},1);
            }
        });
    }
}

