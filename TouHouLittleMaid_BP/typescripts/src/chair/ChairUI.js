import * as mcui from '@minecraft/server-ui';
import { Player, Entity } from "@minecraft/server";
import { EntityChair } from './EntityChair';
import { ChairSkin } from './skin/ChairSkin';

/**
 * 打开坐垫模型更换表单
 * @param {Player} player 玩家
 * @param {Entity} chair 坐垫实体
 */
export function SkinMenu(player, chair) {
  let form = new ChairMenu(player, chair);
  form.skinPackSelection();
}

/**
 * 坐垫皮肤更换表单（使用普通 server_form）
 */
class ChairMenu {
  /**
   * @param {Player} player
   * @param {Entity} chair
   */
  constructor(player, chair) {
    this.player = player;
    this.chair = chair;
  }

  /**
   * 坐垫包选择弹窗
   */
  skinPackSelection() {
    const form = new mcui.ActionFormData()
      .title({ translate: "gui.touhou_little_maid:button.skin.name" }) // 切换模型文案
      .body({ rawtext: [{ translate: "gui.touhou_little_maid:button.skin.name" }] });

    let skinInfos = ChairSkin.getAllPackInfos();
    for (let info of skinInfos) {
      form.button(info.name, info.icon);
    }

    form.show(this.player).then((response) => {
      if (response.selection !== undefined) {
        let selectedInfo = skinInfos[response.selection];
        this.skinSelection(selectedInfo.id);
      }
    });
  }

  /**
   * 坐垫皮肤选择弹窗
   * @param packId 坐垫包 id
   */
  skinSelection(packId) {
    const form = new mcui.ActionFormData()
      .title(ChairSkin.getPackDisplayName(packId)) // 坐垫包名称
      .body({ "rawtext": [
        { "translate": "gui.touhou_little_maid.author.name" },
        ChairSkin.getAuthors(packId),
      ] }); // 描述文案（目前只有作者）

    const amount = ChairSkin.getSkinAmount(packId);
    for (let i = 0; i < amount; i++) {
      form.button(ChairSkin.getSkinDisplayName(packId, i));
    }

    form.show(this.player).then((response) => {
      if (response.selection !== undefined) {
        EntityChair.Skin.setPack(this.chair, packId);
        EntityChair.Skin.setIndex(this.chair, response.selection);
      }
    });
  }
}
