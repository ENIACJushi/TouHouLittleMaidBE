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
 *
 * 「皮肤包」表单仅保留解析/落盘，供无自动注册行为包的旧资源包手动粘贴；
 * 新转换产物应启用附加 BP，由通道 topic `skin` 自动注册。
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
   * 兼容旧皮肤包：粘贴转换数据并整表替换。
   * 新产物请走附加行为包自动注册，无需使用本表单。
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
