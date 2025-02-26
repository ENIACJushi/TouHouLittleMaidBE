import { Player } from "@minecraft/server";
import * as mcui from '@minecraft/server-ui';
export class DogeBookData {
    constructor() { }
    /**
     * 新增一个章节
     * @param {string} title 章节标题 显示在目录
     * @param {string} icon  章节图标 显示在目录
     */
    addChapter(title, icon) {
    }
    addPage(chapter) {
    }
    /**
     * 向玩家展示书
     * @param {Player} player
     * @param { (response: mcui.ActionFormData, player: Player) => void} callback 接收两个参数： response 和 player
     */
    show(player, callback) {
        const form = new mcui.ActionFormData();
        form.show(player).then(response => { callback(response, player); });
    }
}
//# sourceMappingURL=DogeBookLib.js.map