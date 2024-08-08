import { ItemStack, Player } from "@minecraft/server";
import { config } from "../controller/Config";
import { getPlayerMainHand, lore2Str, str2Lore } from "../libs/ScarletToolKit";
import * as mcui from '@minecraft/server-ui';

export class MemorizableGensokyo{
    /**
     * 
     * @param {Player} pl 
     */
    static sendForm(pl){
        const form = new mcui.ActionFormData()
            .title('/TLM_B A')
            .body('12')
            .button("Chapter1")
            .button("Chapter2")
            .button({"rawtext":[{"translate":"tlm.00","with":["\n"]}]})
            .button({"rawtext":[{"translate":"tlm.01","with":["\n"]}]})
            .button({"rawtext":[{"translate":"tlm.02","with":["\n"]}]})
            .button({"rawtext":[{"translate":"tlm.03","with":["\n"]}]})
            .button({"rawtext":[{"translate":"tlm.04","with":["\n"]}]})
            .button({"rawtext":[{"translate":"tlm.05","with":["\n"]}]})
            .button({"rawtext":[{"translate":"tlm.06","with":["\n"]}]})
            .button({"rawtext":[{"translate":"tlm.07","with":["\n"]}]})
        form.show(pl).then((response)=>{

        });

        // const form2 = new mcui.ModalFormData()
        //     .title('/TLM_B A')
        //     .dropdown("a", ["a", "b"])
        //     .submitButton("确 认")
            
        // form2.show(pl).then((response)=>{

        // });
            
    }
}