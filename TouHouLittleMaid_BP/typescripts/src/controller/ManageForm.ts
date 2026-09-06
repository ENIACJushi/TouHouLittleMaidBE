import { Player, PlayerPermissionLevel } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { lang } from "../libs/ScarletToolKit";
import { MaidSkin } from "../maid/skin/MaidSkin";
import { ChairSkin } from "../chair/skin/ChairSkin";
import { SkinPackConfig } from "../maid/skin/MaidSkinTypes";
import { ConfigForm } from "./Config";

/**
 * 网站导出 / 管理面板粘贴的模型包配置
 * - 旧格式：[{"count":20}] —— 仅女仆
 * - 新格式：{"skin":[...],"chair":[...]} —— 女仆 + 坐垫
 */
type CombinedPackConfig = {
  skin?: SkinPackConfig[];
  chair?: SkinPackConfig[];
};

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
   * 将当前女仆 / 坐垫附加包拼成网站同款 JSON，供表单回显
   */
  static stringifyCombinedPackConfig(): string {
    return JSON.stringify({
      skin: MaidSkin.extraPacks,
      chair: ChairSkin.extraPacks,
    });
  }

  /**
   * 解析网站导出的模型包配置（兼容旧数组格式）
   * @returns 解析失败时返回 undefined
   */
  static parseCombinedPackConfig(text: string): CombinedPackConfig | undefined {
    const trimmed = text.trim();
    if (trimmed === '') {
      return { skin: [], chair: [] };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return undefined;
    }

    // 旧格式：仅女仆 [{"count":n}, ...]
    if (Array.isArray(parsed)) {
      const skin = MaidSkin.parsePackConfig(JSON.stringify(parsed));
      if (skin === undefined) {
        return undefined;
      }
      return { skin, chair: undefined };
    }

    if (parsed === null || typeof parsed !== 'object') {
      return undefined;
    }

    const obj = parsed as Record<string, unknown>;
    let skin: SkinPackConfig[] | undefined;
    let chair: SkinPackConfig[] | undefined;

    if (obj.skin !== undefined) {
      skin = MaidSkin.parsePackConfig(JSON.stringify(obj.skin));
      if (skin === undefined) {
        return undefined;
      }
    }
    if (obj.chair !== undefined) {
      chair = ChairSkin.parsePackConfig(JSON.stringify(obj.chair));
      if (chair === undefined) {
        return undefined;
      }
    }

    // 至少要有一侧字段，避免误粘无关 JSON
    if (skin === undefined && chair === undefined) {
      return undefined;
    }
    return { skin, chair };
  }

  /**
   * 设置附加皮肤包 / 坐垫包：粘贴转换网站生成的 JSON
   */
  static skinPackForm(player: Player) {
    if (!ManageForm.ensureOp(player)) {
      return;
    }
    const current = ManageForm.stringifyCombinedPackConfig();
    let form = new ModalFormData()
      .title(lang('message.tlm.config.skin_pack.name'))
      .textField(lang('message.tlm.config.skin_pack.description'), '{"skin":[{"count":20}],"chair":[{"count":10,"heights":[3,15]}]}', {
        defaultValue: current
      })
      .submitButton('提交');

    // @ts-ignore
    form.show(player).then((response) => {
      if (!response.canceled && response?.formValues?.[0] !== undefined) {
        const combined = ManageForm.parseCombinedPackConfig(response.formValues[0] as string);
        if (combined === undefined) {
          ConfigForm.invalidWarning(player, () => { ManageForm.skinPackForm(player); });
          return;
        }
        if (combined.skin !== undefined) {
          MaidSkin.setSkin(combined.skin);
        }
        if (combined.chair !== undefined) {
          ChairSkin.setSkin(combined.chair);
        }
      }
      this.mainForm(player);
    });
  }
}
