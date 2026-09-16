import * as mcui from "@minecraft/server-ui";
import { system, Entity, Player } from "@minecraft/server";
import { Backpack } from "../facets/Backpack";
import { Util } from "../facets/util";
import { Health } from "../facets/Health";
import { Home } from "../facets/Home";
import { Kill } from "../facets/Kill";
import { Level } from "../facets/Level";
import { Mute } from "../facets/Mute";
import { Pick } from "../facets/Pick";
import { Ride } from "../facets/Ride";
import { Skin } from "../facets/Skin";
import { Work } from "../facets/Work";
import { MaidSkin } from "../skin/MaidSkin";
import { config } from "../../controller/Config";

/** 表单标题/名称：字符串或 RawMessage 形态 */
type FormLabel = string | { translate: string } | { rawtext: ({ translate: string } | { text: string })[] };

/**
 * 打开主菜单
 */
export function MainMenu(player: Player, maid: Entity): void {
  if (config.ui_enable.value) {
    let form = new MaidMenuUI(player, maid);
    form.main();
  }
  else {
    let form = new MaidMenuSimple(player, maid);
    form.main();
  }
}

/**
 * 打开皮肤菜单
 */
export function SkinMenu(player: Player, maid: Entity, selectSkin: boolean = true): void {
  if (config.ui_enable.value) {
    let form = new MaidMenuUI(player, maid);
    form.skinPackSelection(selectSkin);
  }
  else {
    let form = new MaidMenuSimple(player, maid);
    form.skinPackSelection(selectSkin);
  }
}

// 使用普通 server_form 的表单
class MaidMenuSimple {
  player: Player;
  maid: Entity;
  maid_name: FormLabel;

  constructor(player: Player, maid: Entity) {
    this.player = player;
    this.maid = maid;

    // 名称为空时，使用默认名
    this.maid_name = Util.getNameTag(maid);
    if (this.maid_name === "") {
      this.maid_name = { translate: "entity.touhou_little_maid:maid.name" };
    }
  }

  main(): void {
    let health = Health.getComponent(this.maid);
    let work_type = Work.get(this.maid);
    let home_mode = Home.getMode(this.maid);
    let mode_pick = Pick.get(this.maid);
    let mode_mute = Mute.get(this.maid);
    let backpack_invisible = Backpack.getInvisible(this.maid);
    let skin_pack_index = Skin.getPack(this.maid);
    let skin_index = Skin.getIndex(this.maid);
    let skin_display;

    skin_display = MaidSkin.getSkinDisplayName(skin_pack_index, skin_index);
    const form = new mcui.ActionFormData()
      // 标题  女仆名，为空则使用默认名称
      .title(this.maid_name)
      // 信息
      .body(
        ` | §6Lv.${Level.get(this.maid)}§r` +
        ` | ${String.fromCodePoint(0xE605)} ${health.currentValue.toFixed(0)}/${health.defaultValue}` +
        ` | ${String.fromCodePoint(0xE609)} ${Kill.get(this.maid)} |`
      )
      // 切换工作模式 | 当前模式
      .button({ rawtext: [{ translate: "gui.touhou_little_maid:task.switch.name" }, { text: " | " },
        { translate: Work.getLang(work_type) }] }, Work.getIMG(work_type))
      // Home 模式
      .button({ translate: Home.getLang(home_mode) }, Home.getImg(home_mode))
      // 显示/隐藏背包
      .button({ rawtext: [{ translate: backpack_invisible
        ? "gui.touhou_little_maid:button.backpack.true.name"
        : "gui.touhou_little_maid:button.backpack.false.name" }] }, Backpack.getButtonImg(backpack_invisible))
      // 拾物模式
      .button({ rawtext: [{ translate: mode_pick
        ? "gui.touhou_little_maid:button.pickup.true.name"
        : "gui.touhou_little_maid:button.pickup.false.name" }] }, Pick.getImg(mode_pick))
      // 静音模式（文案与图标均应对齐 mode_mute；旧 JS 误把图标绑到 mode_pick）
      .button({ rawtext: [{ translate: mode_mute
        ? "gui.touhou_little_maid:button.mute.true.name"
        : "gui.touhou_little_maid:button.mute.false.name" }] }, Mute.getImg(mode_mute))
      // 选择模型
      .button({ rawtext: [{ translate: "gui.touhou_little_maid:button.skin.name" }, { text: " | " }, skin_display] }, MaidSkin.getPackIcon(skin_pack_index));

    // @ts-ignore
    form.show(this.player).then((response) => {
      switch (response.selection) {
        case 0:
          this.workSelection();
          break;
        case 1:
          Home.switchMode(this.maid);
          system.runTimeout(() => { this.main(); }, 1);
          break;
        case 2:
          Backpack.setInvisible(this.maid, !backpack_invisible);
          // 这里不返回主菜单，直接退出
          break;
        case 3:
          Pick.set(this.maid, !mode_pick);
          system.runTimeout(() => { this.main(); }, 1);
          break;
        case 4:
          Mute.switchMode(this.maid);
          system.runTimeout(() => { this.main(); }, 1);
          break;
        case 5:
          this.skinPackSelection();
          break;
        default:
          break;
      }
    });
  }

  workSelection(): void {
    const form = new mcui.ActionFormData()
      .title(this.maid_name) // 女仆名，为空则使用默认标题
      .body(`工作模式`);

    for (let i = 0; i < Work.AMOUNT; i++) {
      form.button(Work.getLang(i), Work.getIMG(i));
    }

    // @ts-ignore
    form.show(this.player).then((response) => {
      if (response.selection !== undefined) {
        Work.set(this.maid, response.selection);
        system.runTimeout(() => { this.main(); }, 2);
      }
    });
  }

  /**
   * 皮肤包选择弹窗
   * @param selectSkin 点击后是否继续打开皮肤选择弹窗
   */
  skinPackSelection(selectSkin: boolean = true): void {
    const form = new mcui.ActionFormData()
      .title(this.maid_name) // 女仆名，为空则使用默认标题
      .body({ rawtext: [{ translate: "gui.touhou_little_maid:button.skin.name" }] }); // 切换模型文案
    let skinInfos = MaidSkin.getAllPackInfos();
    for (let info of skinInfos) {
      form.button(info.name, info.icon);
    }
    // 展示弹窗
    // @ts-ignore
    form.show(this.player).then((response) => {
      if (response.selection !== undefined) {
        let selectedInfo = skinInfos[response.selection];
        if (selectSkin) {
          this.skinSelection(selectedInfo.id);
        } else {
          Skin.setPack(this.maid, selectedInfo.id);
        }
      }
    });
  }

  /**
   * 皮肤选择弹窗
   * @param packId 皮肤包 id
   */
  skinSelection(packId: number): void {
    // 描述：作者；Geckolib 包额外提示精简子包仅加载一个模型
    const bodyRawtext: ({ translate: string } | { text: string })[] = [
      { "translate": "gui.touhou_little_maid.author.name" },
      MaidSkin.getAuthors(packId),
    ];
    if (packId === 1) {
      bodyRawtext.push({ "text": "\n" });
      bodyRawtext.push({ "translate": "gui.touhou_little_maid:skin.gecko.simple_tip" });
    }
    const form = new mcui.ActionFormData()
      .title(MaidSkin.getPackDisplayName(packId)) // 皮肤包名称
      .body({ "rawtext": bodyRawtext });

    const amount = MaidSkin.getSkinAmount(packId);
    for (let i = 0; i < amount; i++) {
      form.button(MaidSkin.getSkinDisplayName(packId, i));
    }

    // @ts-ignore
    form.show(this.player).then((response) => {
      if (response.selection !== undefined) {
        Skin.setPack(this.maid, packId);
        Skin.setIndex(this.maid, response.selection);
      }
    });
  }
}

// 使用特殊 UI 的表单
class MaidMenuUI {
  player: Player;
  maid: Entity;
  maid_name: string;

  constructor(player: Player, maid: Entity) {
    this.player = player;
    this.maid = maid;
    this.maid_name = Util.getNameTag(maid);
  }

  main(): void {
    ///// 收集基础信息 /////
    let maid_name = this.maid_name === ""
      ? { rawtext: [{ text: `/M ${Level.getStr(this.maid)} ` },
        { translate: "entity.touhou_little_maid:maid.name" }] }
      : "/M " + `${Level.getStr(this.maid)} ` + this.maid_name;
    let health = Health.getComponent(this.maid);
    let work_type = Work.get(this.maid);
    let home_mode = Home.getMode(this.maid);
    let pick_mode = Pick.get(this.maid);
    let mute_mode = Mute.get(this.maid);
    let backpack_invisible = Backpack.getInvisible(this.maid);
    let skin_pack_index = Skin.getPack(this.maid);
    let skin_index = Skin.getIndex(this.maid);
    let skin_display;

    ///// 生成字符串 /////
    /// 皮肤包字符
    skin_display = MaidSkin.getSkinDisplayName(skin_pack_index, skin_index);

    ///// 构建表单 /////
    const form = new mcui.ActionFormData()
      // 女仆名，为空则使用默认标题
      .title(maid_name)
      .body(this.maid.id)
      // 女仆信息
      .button(
        `${String.fromCodePoint(0xE605)} ${health.currentValue.toFixed(0)}/${health.defaultValue}\n` +
        `${String.fromCodePoint(0xE609)} ${Kill.get(this.maid)} `
      )
      // Home 模式
      .button({ translate: Home.getLang(home_mode) }, Home.getImg(home_mode)) // home 模式
      // 拾物模式
      .button({ translate: Pick.getLang(pick_mode) }, Pick.getImg(pick_mode)) // pick 模式
      // 骑乘模式（未实现）
      .button({ translate: Ride.getLang(false) }, Ride.getImg(false)) // ride 模式
      // 显示/隐藏背包
      .button(Backpack.getButtonLang(backpack_invisible), Backpack.getButtonImg(backpack_invisible)) // 隐藏背包
      // 静音模式（文案与图标均应对齐 mute_mode；旧 JS 误传 pick_mode）
      .button({ translate: Mute.getLang(mute_mode) }, Mute.getImg(mute_mode)) // mute 模式
      // 选择模型
      .button({ rawtext: [{ translate: "gui.touhou_little_maid:button.skin.name" }, { text: " | " }, skin_display] }, "textures/gui/maid_skin.png"); // 选择模型
    // 工作模式
    for (let i = 0; i < Work.AMOUNT; i++) {
      if (i === work_type) form.button({ rawtext: [{ text: "§a" }, { translate: Work.getLang(i) }] }, Work.getIMG(i));
      else form.button({ translate: Work.getLang(i) }, Work.getIMG(i));
    }

    // @ts-ignore
    form.show(this.player).then((response) => {
      if (response.selection !== undefined) {
        switch (response.selection) {
          case 0: break; // 无功能
          case 1: Home.switchMode(this.maid); system.runTimeout(() => { this.main(); }, 1); break; // Home 模式
          case 2: Pick.set(this.maid, !pick_mode); system.runTimeout(() => { this.main(); }, 1); break; // 拾物模式
          case 3: Ride.switchMode(this.maid); system.runTimeout(() => { this.main(); }, 1); break; // 骑乘模式
          case 4: Backpack.setInvisible(this.maid, !backpack_invisible); system.runTimeout(() => { this.main(); }, 1); break; // 隐藏背包
          case 5: Mute.set(this.maid, !mute_mode); system.runTimeout(() => { this.main(); }, 1); break; // 静音模式
          case 6: this.skinPackSelection(); break; // 模型选择
          default:// 工作模式选择
            Work.set(this.maid, response.selection - 7);
            system.runTimeout(() => { this.main(); }, 2);
            break;
        }
      }
    });
  }

  // 相对普通 UI 多了一个字符拼接的过程
  skinPackSelection(selectSkin: boolean = true): void {
    let maid_name: FormLabel = this.maid_name === ""
      ? { rawtext: [{ translate: "entity.touhou_little_maid:maid.name" }] }
      : this.maid_name;

    const form = new mcui.ActionFormData()
      .title(maid_name) // 女仆名，为空则使用默认标题
      .body({ rawtext: [{ translate: "gui.touhou_little_maid:button.skin.name" }] }); // 切换模型文案
    let skinInfos = MaidSkin.getAllPackInfos();
    for (let info of skinInfos) {
      form.button(info.name, info.icon);
    }

    // @ts-ignore
    form.show(this.player).then((response) => {
      if (response.selection !== undefined) {
        let selectedInfo = skinInfos[response.selection];
        if (selectSkin) {
          this.skinSelection(selectedInfo.id);
        } else {
          Skin.setPack(this.maid, selectedInfo.id);
        }
      }
    });
  }

  /**
   * 皮肤选择弹窗 与普通 UI 完全一致
   * @param packId 皮肤包 id
   */
  skinSelection(packId: number): void {
    // 描述：作者；Geckolib 包额外提示精简子包仅加载一个模型
    const bodyRawtext: ({ translate: string } | { text: string })[] = [
      { "translate": "gui.touhou_little_maid.author.name" },
      MaidSkin.getAuthors(packId),
    ];
    if (packId === 1) {
      bodyRawtext.push({ "text": "\n" });
      bodyRawtext.push({ "translate": "gui.touhou_little_maid:skin.gecko.simple_tip" });
    }
    const form = new mcui.ActionFormData()
      .title(MaidSkin.getPackDisplayName(packId)) // 皮肤包名称
      .body({ "rawtext": bodyRawtext });

    const amount = MaidSkin.getSkinAmount(packId);
    for (let i = 0; i < amount; i++) {
      form.button(MaidSkin.getSkinDisplayName(packId, i));
    }

    // @ts-ignore
    form.show(this.player).then((response) => {
      if (response.selection !== undefined) {
        Skin.setPack(this.maid, packId);
        Skin.setIndex(this.maid, response.selection);
      }
    });
  }
}
