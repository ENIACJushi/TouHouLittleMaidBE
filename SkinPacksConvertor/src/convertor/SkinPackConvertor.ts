import JSZip from 'jszip';
import {PackFile} from './model/PackFile';
import {TemplatesBE} from "./model/Templates";
import {MaidModelJava, TLMMaidModelInfo} from "./model/MaidModelJava";
import {expandMaidModelList} from "./model/MaidModelDecorate";
import {LangFile, LangFileType, LangType} from "./model/LangFile";
import {normalizeTextureSize} from "./model/ModelNormalize";
import {ResourceManager} from "./resource_manager/ResourceManager";
import {AnimationManager} from "./resource_manager/AnimationManager";
import {PROFILE} from "./config";

const TAG = 'SkinPackConvertor';

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
  /** 全局动画管理器 */
  animationManager: AnimationManager;
  /** 模型包安全名称，用于渲染定义 */
  packNameSafe = 'tlm_model_pack';
  /** 该子模型包的 zip 文件夹，如 `assets/xxx` */
  input: JSZip;
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
   */
  constructor(params: SkinPackConvertorInitParams) {
    this.packId = params.packId;
    this.packName = params.domain;
    this.input = params.input;
    this.resourceManager = params.resourceManager;
    this.animationManager = params.animationManager;
    this.res = params.res;

    this.pack_models = this.res.models.folder(this.packName);
    this.pack_controller = JSON.parse(JSON.stringify(TemplatesBE.RENDER_CONTROLLER_PACK));
  }

  /**
   * 执行处理
   */
  async handlePack() {
    console.log(`Process pack: ${this.packName}`);
    // 椅子包、语音包等没有 maid_model.json，不是女仆皮肤子包，直接跳过
    if (!this.input.file('maid_model.json')) {
      console.log(`Skip pack (缺少 maid_model.json): ${this.packName}`);
      return;
    }
    // 确定模型包安全名称
    this.getPackName();
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
      this.res.textures_icon.file(`pack_pack_${this.packId + PROFILE.BASE_PACK_INDEX}.png`, blob);
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

  ///// 贴图操作 /////
  /**
   * 只复制被 model_list 实际引用到的贴图文件（作为全局约束：仅复制被使用到的模型与贴图）。
   * @param resourceKey 贴图资源位置，如 `textures/entity/cirno.png`（domain 缺省时使用包名）
   * @param outPath 输出到 `textures/<packName>/...` 的相对路径
   */
  async copyTexture(resourceKey: string, outPath: string) {
    const textureFile = this.resourceManager.getResource(resourceKey, this.packName);
    if (!textureFile) {
      console.warn(TAG, `copyTexture >> File not exist: ${resourceKey}`);
      return;
    }
    const content = await textureFile.async("blob");
    this.res.textures.folder(this.packName).file(outPath, content);
  }

  ///// 模型操作 /////
  /**
   * 只转换并复制被 model_list 实际引用到的模型文件（作为全局约束：仅复制被使用到的模型与贴图）。
   * @param resourceKey 模型资源位置，如 `models/entity/cirno.json`（domain 缺省时使用包名）
   * @param outName 输出模型文件名（不含 .json）
   */
  async convertModel(resourceKey: string, outName: string): Promise<boolean> {
    // 获取被使用到的模型文件
    const modelFile = this.resourceManager.getResource(resourceKey, this.packName);
    if (!modelFile) {
      console.warn(TAG, `convertModel >> File not exist: ${resourceKey}`);
      return false;
    }
    const content = await modelFile.async("string");
    // 替换非法字符 NaN
    let modelText = content.replace(/NaN/g, '0');
    let modelJson = JSON.parse(modelText);

    // 补充模型标识符信息
    let beModelStr: string;
    if (modelJson["format_version"] === "1.10.0") {
      // 1.10.0 替换 geometry.model 为模型名称
      beModelStr = modelText.replace("geometry.model", `geometry.${this.packNameSafe}.${outName}`);
    } else {
      // 1.12.0+
      for (let model of modelJson["minecraft:geometry"]) {
        model["description"]["identifier"] = `geometry.${this.packNameSafe}.${outName}`;
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

    // texturewidth/textureheight 若为字符串则转为数字
    normalizeTextureSize(beModel);

    // 创建文件（仅复制被使用到的模型）
    this.pack_models.file(`${outName}.json`, JSON.stringify(beModel));
    return true;
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
    this.parseI18n(`maid_pack.${this.packId + PROFILE.BASE_PACK_INDEX}.authors`, inputJson.author);
    // 解析包名 pack_name，使用通用 I18n 文本解析方案
    this.parseI18nText(`maid_pack.${this.packId + PROFILE.BASE_PACK_INDEX}.name`, inputJson.pack_name);
    // 解析包描述 description，使用通用 I18n 文本数组解析方案
    this.parseI18nTextArray(`maid_pack.${this.packId + PROFILE.BASE_PACK_INDEX}.desc`, inputJson.description);

    // 解析模型列表 model_list（先 decorate 并展开 extra_textures，对齐 Java CustomModelPack）
    const modelList = expandMaidModelList(inputJson.model_list);
    this.res.modelAmount[this.packId - 1] = modelList.length; // 确定模型数量（含多贴图派生）
    this.res.maidPackDomains[this.packId - 1] = this.packName; // 记录 domain，供内置构建同步 BP
    for (let i = 0; i < modelList.length; i++) {
      await this.parseMMModelInfo(modelList[i], i);
    }

    // 在包渲染控制器定义 variant 对应的皮肤和模型
    this.pack_controller["geometry"] = this.pack_controller["geometry"]
      .replace("<index>", `${this.packId + PROFILE.BASE_PACK_INDEX}`);
    this.pack_controller["textures"][0] = this.pack_controller["textures"][0]
      .replace("<index>", `${this.packId + PROFILE.BASE_PACK_INDEX}`);
    // 将包渲染控制器添加到总渲染控制器
    this.res.render_controller["render_controllers"][`controller.render.touhou_little_maid.pack_${this.packNameSafe}`] =
      this.pack_controller;
    // 将包渲染控制器添加到总实体定义
    this.res.entity_description["render_controllers"]
      .push(`controller.render.touhou_little_maid.pack_${this.packNameSafe}`);
  }

  /** 解析 model_list 中的模型信息 */
  private async parseMMModelInfo(modelInfo: TLMMaidModelInfo, seq: number) {
    // 解析模型 model_id
    let idInfo = this.parseModelId(modelInfo); // model_name = idInfo[1]
    // 解析模型名称 name
    this.parseModelName(modelInfo, idInfo, seq);
    // 解析模型描述 desc
    this.parseModelDesc(modelInfo, idInfo, seq);
    // 解析并复制被使用到的模型贴图
    await this.parseModelTextures(modelInfo, idInfo, seq);
    // 解析并复制被使用到的模型建模 model
    await this.parseModelModel(modelInfo, idInfo, seq);
    // 解析模型缩放 scale
    this.parseModelScale(modelInfo, idInfo, seq);
    // 处理动画 animation
    await this.parseModelAnimation(modelInfo, idInfo, seq);

    // todo 处理语音包
  }
  /** 解析模型 - model_id，得到 namespace 和 path */
  private parseModelId(modelInfo: TLMMaidModelInfo): ModelIdInfo  {
    let modelIdInfo = modelInfo.model_id.split(':');
    return {
      namespace: modelIdInfo[0],
      path: modelIdInfo[1],
    };
  }
  /** 解析模型 - 名称 name */
  private parseModelName(modelInfo: TLMMaidModelInfo, idInfo: ModelIdInfo, seq: number) {
    const nameKey = `tlm.maid.model.${this.packId + PROFILE.BASE_PACK_INDEX}.${seq}.name`; // 基岩版文本键，对齐坐垫 tlm.chair.model
    const infoName = modelInfo.name;
    if (infoName === undefined) {
      // 缺省时，使用 `{model.<namespace>.<path>.name}`，其中 `<namespace>` 和 `<path>` 来自 `model_id`
      this.res.lang.setLang(nameKey, this.langJava.getLang(`model.${idInfo.namespace}.${idInfo.path}.name`));
    } else {
      // 解析指定的文本标识
      this.parseI18nText(nameKey, infoName);
    }
  }
  /** 解析模型 - 描述 description */
  private parseModelDesc(modelInfo: TLMMaidModelInfo, idInfo: ModelIdInfo, seq: number) {
    const descKey = `tlm.maid.model.${this.packId + PROFILE.BASE_PACK_INDEX}.${seq}.desc`; // 基岩版文本键，对齐坐垫 tlm.chair.model
    if (modelInfo.description === undefined) {
      this.res.lang.setLang(descKey, this.langJava.getLang(`model.${idInfo.namespace}.${idInfo.path}.desc`));
    } else {
      this.parseI18nTextArray(descKey, modelInfo.description);
    }
  }
  /**
   * 解析模型 - 贴图。
   * extra_textures 已在 expandMaidModelList 中拆成独立条目，此处每个条目只处理自身 texture。
   */
  private async parseModelTextures(modelInfo: TLMMaidModelInfo, idInfo: ModelIdInfo, seq: number) {
    void seq;
    // 确定贴图资源位置：显式指定或按 model_id 推导（decorate 后通常已有 texture）
    let textureKey = modelInfo.texture ?? `textures/entity/${idInfo.path}.png`;
    // 在实体定义添加贴图
    this.res.entity_description["textures"][`${this.packNameSafe}_${idInfo.path}`] =
      `textures/${this.packName}/entity/${idInfo.path}`;
    // 在渲染控制器添加贴图
    this.pack_controller["arrays"]["textures"]["Array.skins"]
      .push(`Texture.${this.packNameSafe}_${idInfo.path}`);
    // 复制被使用到的贴图文件（多贴图派生条目的 path 含 md5 后缀，互不覆盖）
    await this.copyTexture(textureKey, `entity/${idInfo.path}.png`);
  }
  /** 已转换过的模型输出名，避免同模型多贴图重复写文件 */
  private convertedModelOutNames = new Set<string>();

  /** 解析模型 - 模型 model（只复制被使用到的模型文件，并转换格式） */
  private async parseModelModel(modelInfo: TLMMaidModelInfo, idInfo: ModelIdInfo, seq: number) {
    void seq;
    // 解析被使用到的模型文件信息
    let modelResourceKey: string;
    let modelOutName: string;
    if (!modelInfo.model) {
      // 未指定使用的模型，则使用默认的 `<namespace>:models/entity/<path>.json`
      // decorate 后通常已有 model；缺省时仍按 model_id.path 推导（多贴图派生条目勿走此分支）
      modelResourceKey = `models/entity/${idInfo.path}.json`;
      modelOutName = idInfo.path;
      this.res.entity_description["geometry"][`${this.packNameSafe}_${idInfo.path}`] =
        `geometry.${this.packNameSafe}.${idInfo.path}`;
    } else {
      // 指定了使用的模型（如 geckolib:models/entity/winefox.json）；多贴图条目共用同一 geometry
      modelResourceKey = modelInfo.model;
      let modelPath = modelInfo.model.split('/');
      let model = modelPath[modelPath.length - 1];
      model = model.replace(".json", "");
      modelOutName = model;
      this.res.entity_description["geometry"][`${this.packNameSafe}_${idInfo.path}`]
        = `geometry.${this.packNameSafe}.${model}`;
    }
    // 在渲染控制器添加模型（每个贴图变体各占一格，geometry 标识符可相同）
    this.pack_controller["arrays"]["geometries"]["Array.geos"].push(`Geometry.${this.packNameSafe}_${idInfo.path}`);
    // 转换并复制被使用到的模型文件（同模型多贴图只转换一次）
    if (!this.convertedModelOutNames.has(modelOutName)) {
      const ok = await this.convertModel(modelResourceKey, modelOutName);
      if (ok) {
        this.convertedModelOutNames.add(modelOutName);
      }
    }
  }
  /** 解析模型 - 模型缩放 */
  private parseModelScale(modelInfo: TLMMaidModelInfo, _idInfo: ModelIdInfo, seq: number) {
    void _idInfo;
    const rawScale = modelInfo.render_entity_scale ?? 1;
    const scale = Math.max(0.2, Math.min(2, rawScale));
    this.animationManager.bindModelScale(this.packId, seq, scale);
    this.animationManager.bindModelIsGecko(this.packId, seq, !!modelInfo.is_gecko);
  }
  /** 解析模型 - 动画 animation */
  private async parseModelAnimation(modelInfo: TLMMaidModelInfo, idInfo: ModelIdInfo, seq: number) {
    // 未指定动画信息，或是不支持的 js 动画（is_gecko === false），则直接退出
    if (!modelInfo.animation || !modelInfo.is_gecko) {
      return;
    }
    // 开始解析，读取使用到的文件
    for (let file of modelInfo.animation) {
      // 绑定动画
      await this.animationManager.bindModelAnimation(this.packId, seq, file, idInfo.namespace);
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

interface ModelIdInfo {
  namespace: string;
  path: string;
}

export interface SkinPackConvertorInitParams {
  packId: number; // 转换后的基岩版模型包 id
  domain: string; // 子模型包名称，即 `assets/xxx` 的 `xxx`
  input: JSZip; // 该子模型包的 zip 文件夹，如 `assets/xxx`
  resourceManager: ResourceManager; // 该子模型包所属的模型包的资源管理器
  animationManager: AnimationManager; // 全局动画管理器，在解析当前模型包前，会先切换资源管理器
  res: PackFile; // 输出结果
}