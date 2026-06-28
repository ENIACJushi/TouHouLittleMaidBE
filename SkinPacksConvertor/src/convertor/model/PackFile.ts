import JSZip from 'jszip';
import { TemplatesBE } from "./Templates";
import {LangFile} from "./LangFile";

/**
 * 基岩版模型包输出文件
 */
export class PackFile {
  uuid: string = '';
  /**
   * 模型包注册命令
   */
  commandStr = TemplatesBE.COMMAND_IMPORT;
  /**
   * 模型信息 entity/maid.entity.json
   */
  maid_entity = JSON.parse(JSON.stringify(TemplatesBE.ENTITY_DEF));
  /**
   * 实体 description
   */
  entity_description = this.maid_entity["minecraft:client_entity"]["description"];
  /**
   * 渲染方案 render_controllers/maid.json
   */
  render_controller = JSON.parse(JSON.stringify(TemplatesBE.RENDER_CONTROLLER_LIST));
  /**
   * 各模型包定义的模型数量，用于生成指令字符串
   */
  modelAmount = [];
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

    // 将信息写入文件
    this.resultFile.folder("entity")
      .file("maid.entity.json", JSON.stringify(this.maid_entity, null, '\t'));
    this.resultFile.folder("render_controllers")
      .file("maid.json", JSON.stringify(this.render_controller, null, '\t'));
    // 生成指令
    this.commandStr = `${TemplatesBE.COMMAND_IMPORT}${this.modelAmount.join(',')}`;
    this.resultFile.file("command.txt", this.commandStr);
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
