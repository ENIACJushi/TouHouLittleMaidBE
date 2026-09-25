import { Player, PlayerPermissionLevel } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { lang } from "../libs/ScarletToolKit";
import { ConfigForm } from "./Config";
import {
  applyCombinedPackConfig,
  parseCombinedPackConfig,
  stringifyCombinedPackConfig,
} from "./CombinedPackConfig";

/**
 * 管理菜单
 * 与设置、皮肤包配置平级入口
 */
export class ManageForm {
  /**
   * 打开表单前检查：仅 OP 玩家可进入
   */
  static ensureOp(player: Player): boolean {
    if (player.playerPermissionLevel === PlayerPermissionLevel.Operator) {
      return true;
    }
    player.sendMessage(lang('message.tlm.menu.op_only'));
    return false;
  }

  /**
   * 管理主菜单
   */
  static mainForm(player: Player) {
    if (!ManageForm.ensureOp(player)) {
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
   * 设置附加皮肤包 / 坐垫包：粘贴转换网站生成的 JSON
   */
  static skinPackForm(player: Player) {
    if (!ManageForm.ensureOp(player)) {
      return;
    }
    const current = stringifyCombinedPackConfig();
    let form = new ModalFormData()
      .title(lang('message.tlm.config.skin_pack.name'))
      .textField(lang('message.tlm.config.skin_pack.description'), '{"skin":[{"count":20}],"chair":[{"count":10,"heights":[3,15]}]}', {
        defaultValue: current
      })
      .submitButton('提交');

    // @ts-ignore
    form.show(player).then((response) => {
      if (!response.canceled && response?.formValues?.[0] !== undefined) {
        const combined = parseCombinedPackConfig(response.formValues[0] as string);
        if (combined === undefined) {
          ConfigForm.invalidWarning(player, () => { ManageForm.skinPackForm(player); });
          return;
        }
        applyCombinedPackConfig(combined);
      }
      this.mainForm(player);
    });
  }
}
