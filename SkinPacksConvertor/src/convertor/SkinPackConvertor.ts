import JSZip from 'jszip';
import {PackFile} from './model/PackFile';
import {TemplatesBE} from "./model/Templates";
import {MaidModelJava, TLMMaidModelInfo} from "./model/MaidModelJava";
import {LangFile, LangFileType, LangType} from "./model/LangFile";
import {ResourceManager} from "./resource_manager/ResourceManager";

const TAG = 'SkinPackConvertor';
const BASE_INDEX = 1000;

/**
 * 子模型包转换器
 */
export class SkinPackConvertor {
  /** 转换后的基岩版模型包 id */
  packId: number;
  /** 子模型包名称 */
  packName = 'tlm_model_pack';
  /** 该子模型包所属的模型包的资源管理器 */
  resourceManager: ResourceManager;
  /** 模型包安全名称，用于渲染定义 */
  packNameSafe = 'tlm_model_pack';
  /** 该子模型包的 zip 文件夹，如 `assets/xxx` */
  input: JSZip; // todo 排查所有引用，改为字模型包文件夹开始
  /** java 语言文件 */
  langJava = new LangFile();
  /** 输出信息 */
  res: PackFile;
  /** 此模型包的模型文件夹 */
  pack_models: JSZip;
  /** 此模型包的渲染控制器 */
  pack_controller: TemplatesBE.RenderControllerPack;

  /**
   * 处理单个子模型包
   * @param packId 转换后的基岩版模型包 id
   * @param domain 子模型包名称，即 `assets/xxx` 的 `xxx`
   * @param input 该子模型包的 zip 文件夹，如 `assets/xxx`
   * @param resourceManager 该子模型包所属的模型包的资源管理器
   * @param res 输出结果
   */
  constructor(packId: number, domain: string, input: JSZip, resourceManager: ResourceManager, res: PackFile) {
    this.packId = packId;
    this.packName = domain;
    this.input = input;
    this.resourceManager = resourceManager
    this.res = res;

    this.pack_models = this.res.models.folder(this.packName);
    this.pack_controller = JSON.parse(JSON.stringify(TemplatesBE.RENDER_CONTROLLER_PACK));
  }

  /**
   * 执行处理
   */
  async handlePack() {
    console.log(`Process pack: ${this.packName}`);
    // 确定模型包安全名称
    this.getPackName();
    // 移动女仆贴图
    await this.moveTextures();
    // 修改格式并移动模型
    await this.convertModels();
    // 解析全部语言文件
    await this.parseAllLang();
    // 解析模型包信息 maid_model.json
    await this.convertMaidModelCfg();
  }

  /**
   * 确定模型包名称，用于渲染定义
   */
  getPackName() {
    let firstChar = this.packName.substring(0, 1)
    this.packNameSafe = (firstChar >= '0' && firstChar <= '9') ? 'a' + this.packName: this.packName;
  }

  /**
   * 解析模型包图标
   */
  async parseIcon(resourceKey?: string) {
    let key = resourceKey ?? `${this.packName}:textures/maid_icon.png`;
    let icon = this.resourceManager.getResource(key);
    console.log(TAG, `parseIcon, key=${key}, icon=${icon}`);
    if (icon) {
      let blob = await icon.async('blob');
      blob = await this.cropIconFirstFrame(blob);
      this.res.textures_icon.file(`pack_pack_${this.packId + BASE_INDEX}.png`, blob);
    }
  }

  /**
   * 若图标高大于宽，则视为纵向多帧图标，取顶部第一帧（正方形）裁剪
   */
  private async cropIconFirstFrame(blob: Blob): Promise<Blob> {
    const bitmap = await createImageBitmap(blob);
    const { width, height } = bitmap;
    if (height <= width) {
      bitmap.close();
      return blob;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = width;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      throw new Error('无法创建 canvas 上下文以裁剪图标');
    }
    ctx.drawImage(bitmap, 0, 0, width, width, 0, 0, width, width);
    bitmap.close();

    return new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error('图标裁剪后转换为 PNG 失败'));
        }
      }, 'image/png');
    });
  }

  ///// 贴图操作/////
  async moveTextures() {
    let pack_textures = this.res.textures.folder(this.packName);
    let tasks = [];
    this.input.folder(`textures/`).forEach((path, file) => {
      if (path !== "maid_icon.png") {
        tasks.push(async () => {
          let content = await file.async("blob");
          pack_textures.file(path, content);
        });
      }
    });
    for (let task of tasks) {
      await task();
    }
  }

  ///// 模型操作 /////
  /**
   * 转换并移动全部模型
   */
  async convertModels() {
    let tasks = [];
    this.input.folder(`models/`).forEach((path, file) => {
      tasks.push(this.convertModel(path, file));
    });
    for (let task of tasks) {
      await task;
    }
  }

  /**
   * 转换单个模型
   */
  async convertModel(path: string, file: JSZip.JSZipObject): Promise<boolean> {
    // 确定模型名称
    let modelName = this.getModelName(path);
    if (!modelName) {
      return false;
    }
    const content = await file.async("string");
    // 替换非法字符 NaN
    let modelText = content.replace(/NaN/g, '0');
    let modelJson = JSON.parse(modelText);

    // 补充模型标识符信息
    let beModelStr: string;
    if (modelJson["format_version"] === "1.10.0") {
      // 1.10.0 替换 geometry.model 为模型名称
      beModelStr = modelText.replace("geometry.model", `geometry.${this.packNameSafe}.${modelName}`);
    } else {
      // 1.12.0+
      for (let model of modelJson["minecraft:geometry"]) {
        model["description"]["identifier"] = `geometry.${this.packNameSafe}.${modelName}`;
      }
      beModelStr = JSON.stringify(modelJson, null, '\t');
    }

    // 骨骼处理
    let beModel = JSON.parse(beModelStr);
    if (beModel["format_version"] === "1.10.0") {
      for (let key in beModel) {
        if (key !== "format_version") {
          this.processBones(beModel[key]["bones"])
        }
      }
    } else {
      // 新格式
      for (let geo of beModel["minecraft:geometry"]) {
        this.processBones(geo["bones"]);
      }
    }

    // 创建文件
    this.pack_models.file(path, JSON.stringify(beModel));
    return true;
  }

  /**
   * 获取模型名称
   */
  getModelName(path: string) {
    let pathParts = path.split('/');
    // 必须是 json 文件
    let res = pathParts[pathParts.length - 1];
    if (res.substring(res.length - 5, res.length) !== ".json") {
      return undefined;
    }
    res = res.substring(0, res.length - 5);
    if (res === '') {
      return undefined; // 该文件为目录
    }
    return res;
  }

  rootBone = {
    "name": "Root",
    "pivot": [0, 0, 0]
  }
  /**
   * 处理骨骼
   */
  processBones(bones: { name: string; pivot: number[]; }[]) {
    if (bones === undefined) {
      console.error('processBones >> Failed, bones is undefined,');
      return false;
    }
    // 如果没有 Root 骨骼，则创建 Root 骨骼
    if (!bones.some(bone => bone['name'] === 'Root')) {
      bones.unshift(this.rootBone);
      // 对于没有父骨骼的非 Root 骨骼，将其父骨骼设为 Root（如果已经有 Root 骨骼，就不需要再设了）
      for (let bone of bones) {
        if (bone['name'] !== 'Root' && bone['parent'] === undefined) {
          bone['parent'] = 'Root';
        }
      }
    }
    return true;
  }

  ///// 解析 maid_model.json /////
  /**
   * maid_model.json 解析入口
   */
  async convertMaidModelCfg(): Promise<void> {
    // 读取 maid_model.json 文件
    let content = await this.input.file('maid_model.json').async('string');
    let inputJson: MaidModelJava = JSON.parse(content) as MaidModelJava;

    // 解析图标 icon
    await this.parseIcon(inputJson.icon);
    // 解析作者字符串 author，使用通用 I18n 文本/数组解析方案
    this.parseI18n(`maid_pack.${this.packId + BASE_INDEX}.authors`, inputJson.author);
    // 解析包名 pack_name，使用通用 I18n 文本解析方案
    this.parseI18nText(`maid_pack.${this.packId + BASE_INDEX}.name`, inputJson.pack_name);
    // 解析包描述 description，使用通用 I18n 文本数组解析方案
    this.parseI18nTextArray(`maid_pack.${this.packId + BASE_INDEX}.desc`, inputJson.description);

    // 解析模型列表 model_list
    this.res.modelAmount[this.packId - 1] = inputJson.model_list.length; // 确定模型数量
    for (let i = 0; i < inputJson.model_list.length; i++) {
      this.parseMMModelInfo(inputJson.model_list[i], i);
    }

    // 在包渲染控制器定义 variant 对应的皮肤和模型
    this.pack_controller["geometry"] = this.pack_controller["geometry"]
      .replace("<index>", `${this.packId + BASE_INDEX}`);
    this.pack_controller["textures"][0] = this.pack_controller["textures"][0]
      .replace("<index>", `${this.packId + BASE_INDEX}`);
    // 将包渲染控制器添加到总渲染控制器
    this.res.render_controller["render_controllers"][`controller.render.touhou_little_maid.pack_${this.packNameSafe}`] =
      this.pack_controller;
    // 将包渲染控制器添加到总实体定义
    this.res.entity_description["render_controllers"]
      .push(`controller.render.touhou_little_maid.pack_${this.packNameSafe}`);
  }

  /** 解析 model_list 中的模型信息 */
  private parseMMModelInfo(modelInfo: TLMMaidModelInfo, seq: number) {
    let model_name = modelInfo.model_id.split(':')[1];
    // 女仆各自的描述和名称可能会共用，需要检查是否已经被替换
    // name 名称
    const nameKey = `model.${this.packId + BASE_INDEX}.${seq}.name`;
    const infoName = modelInfo.name;
    if (infoName === undefined) {
      // 默认键名
      this.res.lang.setLang(nameKey, this.langJava.getLang(`model.${this.packName}.${model_name}.name`));
    } else {
      this.parseI18nText(nameKey, infoName);
    }

    // description 描述
    const descKey = `model.${this.packId + BASE_INDEX}.${seq}.desc`;
    if (modelInfo.description === undefined) {
      // 默认键名
      this.res.lang.setLang(descKey, this.langJava.getLang(`model.${this.packName}.${model_name}.desc`));
    } else{
      this.parseI18nTextArray(descKey, modelInfo.description);
    }

    // 在实体定义添加贴图
    this.res.entity_description["textures"][`${this.packNameSafe}_${model_name}`] =
      `textures/${this.packName}/entity/${model_name}`;
    // 在渲染控制器添加贴图
    this.pack_controller["arrays"]["textures"]["Array.skins"]
      .push(`Texture.${this.packNameSafe}_${model_name}`);

    // 在实体定义添加模型
    if (!modelInfo.model) {
      // 未指定使用的模型，则使用默认的
      this.res.entity_description["geometry"][`${this.packNameSafe}_${model_name}`] =
        `geometry.${this.packNameSafe}.${model_name}`;
    } else {
      // 指定了使用的模型（如 geckolib:models/entity/winefox.json）
      let modelPath = modelInfo.model.split('/');
      let model = modelPath[modelPath.length - 1];
      model = model.replace(".json", "");
      this.res.entity_description["geometry"][`${this.packNameSafe}_${model_name}`]
        = `geometry.${this.packNameSafe}.${model}`;
    }
    // 在渲染控制器添加模型
    this.pack_controller["arrays"]["geometries"]["Array.geos"].push(`Geometry.${this.packNameSafe}_${model_name}`);

    // 处理动画
    this.parseAnimation(modelInfo, seq);

    // todo 处理语音包
  }

  /**
   * 处理动画
   */
  private parseAnimation(modelInfo: TLMMaidModelInfo, seq: number) {
    // 读取使用到的文件
    if (!modelInfo.animation) {
      return;
    }
    for (let file of modelInfo.animation) {
      // 读取 file，如 touhou_little_maid:animation/maid.animation.json

    }

  }

  ///// 翻译文本解析 /////
  /** 解析全部语言文件 */
  private async parseAllLang() {
    for (let langType in LangType) {
      // 寻找输入包的语言文件
      let lang_file = this.input.file(`lang/${langType.toLowerCase()}.lang`);
      if (!lang_file) {
        lang_file = this.input.file(`lang/${langType.toLowerCase()}.json`);
        if (!lang_file) {
          continue;
        }
        let content = await lang_file.async("string");
        this.langJava.parse(langType as LangType, content, LangFileType.JSON_FILE);
        continue;
      }
      let content = await lang_file.async("string");
      this.langJava.parse(langType as LangType, content, LangFileType.LANG_FILE);
    }
  }

  /**
   * 通用 I18n 文本处理
   * @param key 转化后的基岩版 lang key
   * @param text `{I18n key}`，或固定字符串
   */
  private parseI18nText(key: string, text?: string) {
    // 判空
    if (!text) {
      this.res.lang.setLang(key, '');
      return;
    }
    if (text.startsWith('{') && text.endsWith('}')) {
      // 文本使用语言文件
      let langKey = text.substring(1, text.length - 1);
      this.res.lang.setLang(key, this.langJava.getLang(langKey));
    } else {
      // 文本直接定义
      this.res.lang.setLang(key, text);
    }
  }

  /** 通用 I18n 文本数组处理 换行使用 `%1` 表示 */
  private parseI18nTextArray(key: string, textList?: string[]) {
    // 判空
    if (!textList) {
      this.res.lang.setLang(key, '');
      return;
    }
    // 语言类型 - 值数组，解析完成后使用 %1 join
    let result = new Map<LangType, string[]>();
    result.set(LangType.en_US, []); // 保底设置 en_US 语言

    // 逐行解析并拼接
    for (let text of textList) {
      if (text.startsWith('{') && text.endsWith('}')) {
        // 文本使用语言文件，分别从各语言文件获取并接在各自的数组后面
        let langKey = text.substring(1, text.length - 1);
        let langRecord = this.langJava.getLang(langKey);
        langRecord.forEach((value, langType) => {
          let langArr = result.get(langType);
          if (!langArr) {
            langArr = [];
            result.set(langType, langArr);
          }
          langArr.push(value);
        });
      } else {
        // 文本直接定义
        result.forEach((arr) => {
          arr.push(text);
        });
      }
    }

    // 拼接并设置
    let resultStr = new Map<LangType, string>();
    result.forEach((value, langType) => {
      resultStr.set(langType, value.join('%1'));
    });
    this.res.lang.setLang(key, resultStr);
  }

  /** 通用 I18n 文本/数组处理 */
  private parseI18n(key: string, text?: string | string[]) {
    // 判空
    if (!text) {
      this.res.lang.setLang(key, '');
      return;
    }
    if (typeof text === 'string') {
      // 单键解析
      this.parseI18nText(key, text);
    } else if (Array.isArray(text)) {
      // 数组型
      this.parseI18nTextArray(key, text);
    } else {
      // 兜底
      this.res.lang.setLang(key, '');
    }
  }
}
