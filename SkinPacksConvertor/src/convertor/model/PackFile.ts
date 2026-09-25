import JSZip from 'jszip';
import { TemplatesBE } from "./Templates";
import {LangFile} from "./LangFile";
import {
  ADDON_PACK_VERSION,
  AddonPackIds,
  SCRIPT_MIN_ENGINE_VERSION,
  TLM_MAIN_PACK_VERSION,
  TLM_MAIN_RP_UUID,
  buildAddonPackIds,
} from "../register_bp/AddonPackIds";
import { buildRegisterBehaviorPack } from "../register_bp/buildRegisterBehaviorPack";
import { PROFILE } from "../config";

/** 导出 zip 内资源包 / 行为包目录名 */
export const ADDON_RP_FOLDER = 'TLM_MaidSkinPack_RP';
export const ADDON_BP_FOLDER = 'TLM_MaidSkinPack_BP';

/**
 * 基岩版模型包输出文件
 */
export class PackFile {
  uuid: string = '';
  /**
   * 派生的附加包标识（资源包 uuid + 行为包 / 通道 uuid）
   */
  packIds: AddonPackIds;
  /**
   * 女仆皮肤包注册配置 JSON（数组），用于组装 command.txt
   */
  packConfigStr = '[]';
  /**
   * 与网站展示一致的管理面板粘贴数据：{"skin":[...],"chair":[...]}
   */
  commandConfigStr = '{"skin":[],"chair":[]}';
  /**
   * 模型信息 entity/maid.entity.json
   */
  maid_entity: TemplatesBE.EntityDefinition = TemplatesBE.buildEntityDef();
  /**
   * 精简子包实体（附加包产物 subpacks/simple/entity/maid.entity.json）
   */
  maid_entity_simple: TemplatesBE.EntityDefinition | null = null;
  /**
   * 实体 description
   */
  entity_description = this.maid_entity["minecraft:client_entity"]["description"];
  /**
   * 渲染方案 render_controllers/maid.json
   */
  render_controller = JSON.parse(JSON.stringify(TemplatesBE.RENDER_CONTROLLER_LIST));
  /**
   * 各模型包定义的模型数量，用于生成配置 JSON
   */
  modelAmount: number[] = [];
  /**
   * 各女仆包 domain 名（与 modelAmount 下标对齐），供内置构建同步 BP 注释
   */
  maidPackDomains: string[] = [];

  ///// 坐垫输出 /////
  /**
   * 坐垫模型信息 entity/chair.entity.json
   */
  chair_entity: TemplatesBE.ChairEntityDefinition = TemplatesBE.buildChairEntityDef();
  /**
   * 坐垫实体 description
   */
  chair_description = this.chair_entity["minecraft:client_entity"]["description"];
  /**
   * 坐垫渲染方案 render_controllers/chair.json
   */
  chair_controller = JSON.parse(JSON.stringify(TemplatesBE.CHAIR_RENDER_CONTROLLER_LIST));
  /**
   * 各坐垫模型包定义的模型数量，用于生成坐垫配置 JSON
   */
  chairModelAmount: number[] = [];
  /**
   * 各坐垫包 domain 名（与 chairModelAmount 下标对齐），供内置构建同步 BP 注释
   */
  chairPackDomains: string[] = [];
  /**
   * 各坐垫包内模型的 mounted_height 像素值（与 chairModelAmount 下标对齐）
   */
  chairModelHeights: number[][] = [];
  /**
   * 坐垫包注册配置 JSON
   */
  chairPackConfigStr = '[]';

  /**
   * 翻译数据
   */
  lang: LangFile = new LangFile();

  ///// 输出文件 /////
  /**
   * 资源包 zip（根目录即为 RP 内容）
   */
  resultFile = new JSZip();
  /**
   * 自动注册行为包 zip；仅网页附加包转换时生成
   */
  behaviorPackFile: JSZip | null = null;
  /**
   * 女仆模型文件夹 models/entity/xxx/
   */
  models = this.resultFile.folder("models").folder("entity");
  /**
   * 坐垫模型文件夹 models/entity/chair/xxx/
   * 与女仆模型分目录，避免迁移时坐垫几何体被拷进 built_in_skins（反之亦然）
   */
  chair_models = this.models.folder("chair");
  /**
   * 贴图文件夹
   */
  textures = this.resultFile.folder("textures");
  /**
   * 模型包图标文件夹
   */
  textures_icon = this.textures.folder("thlm");

  constructor(uuid: string) {
    this.uuid = uuid;
    this.packIds = buildAddonPackIds(uuid);
  }

  /**
   * 导出文件（资源包 + 可选注册行为包）
   */
  async export(): Promise<PackFile> {
    // 生成与网站展示一致的单个 command.txt（皮肤包 + 坐垫包）
    this.packConfigStr = TemplatesBE.buildSkinPackConfigStr(this.modelAmount);
    this.chairPackConfigStr = TemplatesBE.buildChairPackConfigStr(this.chairModelAmount, this.chairModelHeights);
    this.commandConfigStr = TemplatesBE.buildCommandConfigStr(
      this.modelAmount,
      this.chairModelAmount,
      this.chairModelHeights,
    );

    // 创建 manifest.json
    await this.createManifest();
    // 写入语言文件
    let lang_folder = this.resultFile.folder("texts");
    let lang_list = [];
    this.lang.stringify().forEach((str, langType) => {
      lang_list.push(langType);
      lang_folder.file(`${langType}.lang`, str);
    });
    lang_folder.file("languages.json", JSON.stringify(lang_list));

    // 写入实体定义文件
    this.resultFile.folder("entity")
      .file("maid.entity.json", JSON.stringify(this.maid_entity, null, '\t'));
    // 写入渲染控制器
    this.resultFile.folder("render_controllers")
      .file("maid.json", JSON.stringify(this.render_controller, null, '\t'));

    // 附加包：写出与主包类似的精简/完整子资源包
    if (this.maid_entity_simple) {
      this.resultFile
        .folder("subpacks")
        .folder("simple")
        .folder("entity")
        .file("maid.entity.json", JSON.stringify(this.maid_entity_simple, null, '\t'));
      // full 档空占位（较高 memory_tier，默认选用 → 用根目录完整实体）
      this.resultFile.folder("subpacks").folder("full").file(".gitkeep", "");
    }

    // 若存在坐垫模型，则写入坐垫相关文件
    if (this.chairModelAmount.length > 0) {
      // 写入坐垫实体定义文件
      this.resultFile.folder("entity")
        .file("chair.entity.json", JSON.stringify(this.chair_entity, null, '\t'));
      // 写入坐垫渲染控制器
      this.resultFile.folder("render_controllers")
        .file("chair.json", JSON.stringify(this.chair_controller, null, '\t'));
    }

    this.resultFile.file("command.txt", this.commandConfigStr);

    // 网页附加包：生成自动注册行为包
    if (PROFILE.BASE_PACK_INDEX >= 1000) {
      this.behaviorPackFile = buildRegisterBehaviorPack(
        this.packIds,
        this.commandConfigStr,
      );
    } else {
      this.behaviorPackFile = null;
    }
    return this;
  }

  /**
   * 将 RP + BP 打成可导入的 addon zip（目录：TLM_MaidSkinPack_RP / _BP）。
   * 无行为包时退化为仅资源包内容（兼容内置转换）。
   */
  async buildDownloadZip(): Promise<JSZip> {
    if (!this.behaviorPackFile) {
      return this.resultFile;
    }
    const addon = new JSZip();
    await this.copyZipIntoFolder(addon, ADDON_RP_FOLDER, this.resultFile);
    await this.copyZipIntoFolder(addon, ADDON_BP_FOLDER, this.behaviorPackFile);
    return addon;
  }

  /**
   * 把 src 的文件树拷入 dest 的 folderName/ 下。
   */
  private async copyZipIntoFolder(
    dest: JSZip,
    folderName: string,
    src: JSZip,
  ): Promise<void> {
    const folder = dest.folder(folderName);
    if (!folder) {
      return;
    }
    const entries = Object.keys(src.files);
    for (const path of entries) {
      const entry = src.files[path];
      if (entry.dir) {
        folder.folder(path);
        continue;
      }
      folder.file(path, await entry.async('uint8array'));
    }
  }

  /**
   * 生成资源包 manifest.json（含与 BP / 主 RP 的依赖）。
   *  subpack 的 name 仅支持字面量，不能用 lang 键
   */
  async createManifest() {
    const manifestObj = JSON.parse(JSON.stringify(TemplatesBE.MANIFEST));
    manifestObj.header.uuid = this.packIds.rpHeaderUuid;
    manifestObj.header.version = ADDON_PACK_VERSION;
    manifestObj.header.min_engine_version = SCRIPT_MIN_ENGINE_VERSION;
    manifestObj.modules[0].uuid = this.packIds.rpModuleUuid;
    manifestObj.modules[0].version = ADDON_PACK_VERSION;

    const dependencies: Array<Record<string, unknown>> = [
      // 主资源包（模型实体定义依赖）
      {
        uuid: TLM_MAIN_RP_UUID,
        version: TLM_MAIN_PACK_VERSION,
      },
    ];
    // 网页附加包：与自动注册行为包互依赖
    if (PROFILE.BASE_PACK_INDEX >= 1000) {
      dependencies.push({
        uuid: this.packIds.bpHeaderUuid,
        version: ADDON_PACK_VERSION,
      });
    }
    manifestObj.dependencies = dependencies;

    if (this.maid_entity_simple) {
      manifestObj.subpacks = [
        {
          folder_name: "simple",
          name: "Simple",
          memory_tier: 0,
        },
        {
          folder_name: "full",
          name: "Full models",
          memory_tier: 1,
        },
      ];
    } else {
      manifestObj.subpacks = [];
    }
    this.resultFile.file("manifest.json", JSON.stringify(manifestObj, null, '\t'));
  }


  /**
   * 创建公共语言字符 lang/xxx，处理完成后会为非空的项目创建文件，并注册于 languages.json
   */
  static createLang(): Record<string, string> {
    let res: Record<string, string> = {};
    for (let langName of TemplatesBE.LANG_LIST) {
      res[langName] = '';
    }
    return res;
  }
}
