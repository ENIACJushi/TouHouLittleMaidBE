import JSZip from 'jszip';
import { TemplatesBE } from "./Templates";
import {LangFile} from "./LangFile";

/**
 * 基岩版模型包输出文件
 */
export class PackFile {
  uuid: string = '';
  /**
   * 模型包注册配置 JSON，粘贴到游戏设置面板
   */
  packConfigStr = '[]';
  /**
   * 模型信息 entity/maid.entity.json
   */
  maid_entity: TemplatesBE.EntityDefinition = TemplatesBE.buildEntityDef();
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
   * 坐垫包注册配置 JSON
   */
  chairPackConfigStr = '[]';

  /**
   * 翻译数据
   */
  lang: LangFile = new LangFile();

  ///// 输出文件 /////
  /**
   * 转换结果 zip
   */
  resultFile = new JSZip();
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
  }

  /**
   * 导出文件
   */
  async export(): Promise<PackFile> {
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
    // 生成皮肤包配置 JSON
    this.packConfigStr = TemplatesBE.buildSkinPackConfigStr(this.modelAmount);
    this.resultFile.file("skin_pack.json", this.packConfigStr);

    // 若存在坐垫模型，则写入坐垫相关文件
    if (this.chairModelAmount.length > 0) {
      // 写入坐垫实体定义文件
      this.resultFile.folder("entity")
        .file("chair.entity.json", JSON.stringify(this.chair_entity, null, '\t'));
      // 写入坐垫渲染控制器
      this.resultFile.folder("render_controllers")
        .file("chair.json", JSON.stringify(this.chair_controller, null, '\t'));
      // 生成坐垫包配置 JSON
      this.chairPackConfigStr = TemplatesBE.buildChairPackConfigStr(this.chairModelAmount);
      this.resultFile.file("chair_pack.json", this.chairPackConfigStr);
    }
    return this;
  }

  /**
   * 生成 manifest.json
   */
  async createManifest() {
    let manifest = JSON.stringify(TemplatesBE.MANIFEST, null, '\t');
    manifest = manifest.replace("<uuid>", this.uuid);
    this.resultFile.file("manifest.json", manifest);
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
