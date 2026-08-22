import { GameMode, Player } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { lang } from "../libs/ScarletToolKit";
import { MaidSkin } from "../maid/skin/MaidSkin";
import { ConfigForm } from "./Config";

/**
 * 管理菜单
 * 与设置、皮肤包配置平级入口
 */
export class ManageForm {
  /**
   * 打开表单前检查：仅创造模式玩家可进入
   */
  static ensureCreative(player: Player): boolean {
    if (player.getGameMode() === GameMode.Creative) {
      return true;
    }
    player.sendMessage(lang('message.tlm.menu.creative_only'));
    return false;
  }

  /**
   * 管理主菜单
   */
  static mainForm(player: Player) {
    if (!ManageForm.ensureCreative(player)) {
      return;
    }
    let form = new ActionFormData()
      .title(lang('message.tlm.menu.title'))
      .button(lang('message.tlm.menu.config.name'))
      .button(lang('message.tlm.config.skin_pack.name'));

    // @ts-ignore
    form.show(player).then((response) => {
      if (response.canceled || response.selection === undefined) {
        return;
      }
      if (response.selection === 0) {
        ConfigForm.mainForm(player, () => { ManageForm.mainForm(player); });
        return;
      }
      if (response.selection === 1) {
        this.skinPackForm(player);
      }
    });
  }

  /**
   * 设置附加皮肤包：粘贴转换网站生成的 JSON
   */
  static skinPackForm(player: Player) {
    if (!ManageForm.ensureCreative(player)) {
      return;
    }
    const current = MaidSkin.stringifyPackConfig();
    let form = new ModalFormData()
      .title(lang('message.tlm.config.skin_pack.name'))
      .textField(lang('message.tlm.config.skin_pack.description'), '[{"count":20},{"count":10}]', {
        defaultValue: current
      })
      .submitButton('提交');

    // @ts-ignore
    form.show(player).then((response) => {
      if (!response.canceled && response?.formValues?.[0] !== undefined) {
        let packs = MaidSkin.parsePackConfig(response.formValues[0] as string);
        if (packs === undefined) {
          ConfigForm.invalidWarning(player, () => { ManageForm.skinPackForm(player); });
          return;
        }
        MaidSkin.setSkin(packs);
      }
      this.mainForm(player);
    });
  }
}
