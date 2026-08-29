import JSZip from 'jszip';
import {PackFile} from './model/PackFile';
import {TemplatesBE} from "./model/Templates";
import {ChairModelJava, TLMChairModelInfo} from "./model/ChairModelJava";
import {LangFile, LangFileType, LangType} from "./model/LangFile";
import {normalizeTextureSize} from "./model/ModelNormalize";
import {ResourceManager} from "./resource_manager/ResourceManager";
import {AnimationManager} from "./resource_manager/AnimationManager";
import {PROFILE} from "./config";

const TAG = 'ChairPackConvertor';

/**
 * 坐垫子模型包转换器
 *
 * 与女仆子模型包转换器（SkinPackConvertor）相对独立，可分别独立执行。
 * 读取 `maid_chair.json`，只复制被 model_list 实际引用到的模型与贴图，
 * 输出坐垫渲染控制器、坐垫客户端实体定义（geometry/textures）、语言文件与坐垫包数量配置。
 *
 * 坐垫动画通过独立的坐垫 AnimationManager 绑定，避免与女仆动画混在同一次导出中。
 */
export class ChairPackConvertor {
  /** 转换后的基岩版坐垫模型包 id（独立序号空间） */
  packId: number;
  /** 坐垫子模型包名称 */
  packName = 'tlm_chair_pack';
  /** 该坐垫子模型包所属的模型包的资源管理器 */
  resourceManager: ResourceManager;
  /** 坐垫动画管理器（与女仆动画管理器相互独立） */
  chairAnimationManager: AnimationManager;
  /** 坐垫模型包安全名称，用于渲染定义 */
  packNameSafe = 'tlm_chair_pack';
  /** 该坐垫子模型包的 zip 文件夹，如 `assets/xxx` */
  input: JSZip;
  /** java 语言文件 */
  langJava = new LangFile();
  /** 输出信息 */
  res: PackFile;
  /** 此坐垫模型包的模型文件夹 */
  pack_models: JSZip;
  /** 此坐垫模型包的输出文件夹（坐垫几何体） */
  chair_models: JSZip;
  /** 此坐垫模型包的渲染控制器 */
  pack_controller: TemplatesBE.ChairRenderControllerPack;

  constructor(params: ChairPackConvertorInitParams) {
    this.packId = params.packId;
    this.packName = params.domain;
    this.input = params.input;
    this.resourceManager = params.resourceManager;
    this.chairAnimationManager = params.chairAnimationManager;
    this.res = params.res;

    // 坐垫几何体与女仆几何体分目录存放，避免与女仆模型覆盖冲突
    this.chair_models = this.res.resultFile.folder("models").folder("entity").folder(this.packName);
    this.pack_controller = JSON.parse(JSON.stringify(TemplatesBE.CHAIR_RENDER_CONTROLLER_PACK));
  }

  /**
   * 执行处理
   */
  async handlePack() {
    console.log(`Process chair pack: ${this.packName}`);
    const cfgFile = this.input.file('maid_chair.json');
    if (!cfgFile) {
      console.log(`Skip chair pack (缺少 maid_chair.json): ${this.packName}`);
      return;
    }
    // 确定坐垫模型包安全名称
    this.getPackName();
    // 解析全部语言文件
    await this.parseAllLang();
    // 解析坐垫模型包信息 maid_chair.json
    await this.convertChairModelCfg();
  }

  /**
   * 确定坐垫模型包名称，用于渲染定义
   */
  getPackName() {
    let firstChar = this.packName.substring(0, 1)
    this.packNameSafe = (firstChar >= '0' && firstChar <= '9') ? 'a' + this.packName : this.packName;
  }

  ///// 解析 maid_chair.json /////
  /**
   * maid_chair.json 解析入口
   */
  async convertChairModelCfg(): Promise<void> {
    // 读取 maid_chair.json 文件
    const content = await this.input.file('maid_chair.json').async('string');
    const inputJson = JSON.parse(content) as ChairModelJava;

    // 解析图标 icon
    await this.parseIcon(inputJson.icon);
    // 解析作者字符串 author，使用通用 I18n 文本/数组解析方案
    this.parseI18n(`chair_pack.${this.packId + PROFILE.CHAIR_BASE_PACK_INDEX}.authors`, inputJson.author);
    // 解析包名 pack_name，使用通用 I18n 文本解析方案
    this.parseI18nText(`chair_pack.${this.packId + PROFILE.CHAIR_BASE_PACK_INDEX}.name`, inputJson.pack_name);
    // 解析包描述 description，使用通用 I18n 文本数组解析方案
    this.parseI18nTextArray(`chair_pack.${this.packId + PROFILE.CHAIR_BASE_PACK_INDEX}.desc`, inputJson.description);

    // 解析模型列表 model_list
    this.res.chairModelAmount[this.packId - 1] = inputJson.model_list.length; // 确定坐垫模型数量
    this.res.chairPackDomains[this.packId - 1] = this.packName; // 记录 domain，供内置构建同步 BP
    for (let i = 0; i < inputJson.model_list.length; i++) {
      await this.parseChairModelInfo(inputJson.model_list[i], i);
    }

    // 在坐垫包渲染控制器定义 variant 对应的皮肤和模型
    this.pack_controller["geometry"] = this.pack_controller["geometry"]
      .replace("<index>", `${this.packId + PROFILE.CHAIR_BASE_PACK_INDEX}`);
    this.pack_controller["textures"][0] = this.pack_controller["textures"][0]
      .replace("<index>", `${this.packId + PROFILE.CHAIR_BASE_PACK_INDEX}`);
    // 将坐垫包渲染控制器添加到总坐垫渲染控制器
    this.res.chair_controller["render_controllers"][`controller.render.touhou_little_maid.chair_pack_${this.packNameSafe}`] =
      this.pack_controller;
    // 将坐垫包渲染控制器添加到坐垫实体定义
    this.res.chair_description["render_controllers"]
      .push(`controller.render.touhou_little_maid.chair_pack_${this.packNameSafe}`);
  }

  /** 解析 model_list 中的坐垫模型信息 */
  private async parseChairModelInfo(modelInfo: TLMChairModelInfo, seq: number) {
    // 解析坐垫模型 model_id，得到 namespace 和 path
    const idInfo = this.parseModelId(modelInfo);
    // 解析坐垫模型名称 name
    this.parseModelName(modelInfo, idInfo, seq);
    // 解析坐垫模型描述 desc
    this.parseModelDesc(modelInfo, idInfo, seq);
    // 解析贴图并移动（只复制被使用到的贴图）
    await this.parseModelTextures(modelInfo, idInfo, seq);
    // 解析模型并移动（只复制被使用到的模型）
    await this.parseModelModel(modelInfo, idInfo, seq);
    // 解析坐垫模型缩放 scale
    this.parseModelScale(modelInfo, seq);
    // 处理动画 animation（走坐垫独立的动画管理器）
    await this.parseModelAnimation(modelInfo, idInfo, seq);

    // todo 处理坐垫额外贴图 extra_textures
  }

  /** 解析坐垫模型 - model_id，得到 namespace 和 path */
  private parseModelId(modelInfo: TLMChairModelInfo): ModelIdInfo {
    const modelIdInfo = modelInfo.model_id.split(':');
    return {
      namespace: modelIdInfo[0],
      path: modelIdInfo[1],
    };
  }

  /** 解析坐垫模型 - 名称 name */
  private parseModelName(modelInfo: TLMChairModelInfo, idInfo: ModelIdInfo, seq: number) {
    // 基岩版文本键，带 `tlm.chair.` 前缀避免与女仆模型键重复
    const nameKey = `tlm.chair.model.${this.packId + PROFILE.CHAIR_BASE_PACK_INDEX}.${seq}.name`;
    const infoName = modelInfo.name;
    if (infoName === undefined) {
      // 缺省时，使用 `{model.<namespace>.<path>.name}`
      this.res.lang.setLang(nameKey, this.langJava.getLang(`model.${idInfo.namespace}.${idInfo.path}.name`));
    } else {
      // 解析指定的文本标识
      this.parseI18nText(nameKey, infoName);
    }
  }

  /** 解析坐垫模型 - 描述 description */
  private parseModelDesc(modelInfo: TLMChairModelInfo, idInfo: ModelIdInfo, seq: number) {
    // 基岩版文本键，带 `tlm.chair.` 前缀避免与女仆模型键重复
    const descKey = `tlm.chair.model.${this.packId + PROFILE.CHAIR_BASE_PACK_INDEX}.${seq}.desc`;
    if (modelInfo.description === undefined) {
      this.res.lang.setLang(descKey, this.langJava.getLang(`model.${idInfo.namespace}.${idInfo.path}.desc`));
    } else {
      this.parseI18nTextArray(descKey, modelInfo.description);
    }
  }

  /**
   * 解析坐垫模型 - 贴图，并复制被使用到的贴图文件。
   * `texture` 属性非空时使用指定的贴图；否则根据 model_id 推导为 `<namespace>:textures/entity/<path>.png`。
   * 无论源贴图文件名如何，输出统一命名为 `<path>.png`，与实体定义/渲染控制器引用的 `idInfo.path` 保持一致。
   */
  private async parseModelTextures(modelInfo: TLMChairModelInfo, idInfo: ModelIdInfo, seq: number) {
    // 确定贴图资源位置
    let textureKey: string;
    if (modelInfo.texture) {
      textureKey = modelInfo.texture;
    } else {
      textureKey = `${idInfo.namespace}:textures/entity/${idInfo.path}.png`;
    }
    // 在坐垫实体定义添加贴图
    this.res.chair_description["textures"][`${this.packNameSafe}_${idInfo.path}`] =
      `textures/${this.packName}/chair/${idInfo.path}`;
    // 在坐垫渲染控制器添加贴图
    this.pack_controller["arrays"]["textures"]["Array.skins"]
      .push(`Texture.${this.packNameSafe}_${idInfo.path}`);

    // 复制被使用到的贴图文件到坐垫输出贴图目录（输出名统一为 idInfo.path，源文件由 texture 指定）
    await this.copyChairTexture(textureKey, `${idInfo.path}.png`);
  }

  /**
   * 复制指定贴图资源到坐垫输出贴图目录 `textures/<packName>/chair/`
   * @param resourceKey 贴图资源位置，如 `touhou_little_maid:textures/entity/torii.png`（含 domain）
   * @param outFileName 输出文件名（不含前缀路径），如 `torii_2.png`
   */
  private async copyChairTexture(resourceKey: string, outFileName: string) {
    const textureFile = this.resourceManager.getResource(resourceKey);
    if (!textureFile) {
      console.warn(TAG, `parseModelTextures >> File not exist: ${resourceKey}`);
      return;
    }
    const blob = await textureFile.async('blob');
    this.res.textures.folder(this.packName).folder('chair').file(outFileName, blob);
  }

  /**
   * 解析坐垫模型 - 模型 model，并转换/复制被使用到的模型文件。
   * 模型路径缺失时根据 model_id 推导为 `<namespace>:models/entity/<path>.json`。
   */
  private async parseModelModel(modelInfo: TLMChairModelInfo, idInfo: ModelIdInfo, seq: number) {
    let modelKey: string;
    if (modelInfo.model) {
      modelKey = modelInfo.model;
    } else {
      modelKey = `${idInfo.namespace}:models/entity/${idInfo.path}.json`;
    }

    // 在坐垫实体定义添加模型
    this.res.chair_description["geometry"][`${this.packNameSafe}_${idInfo.path}`] =
      `geometry.${this.packNameSafe}.${idInfo.path}`;
    // 在坐垫渲染控制器添加模型
    this.pack_controller["arrays"]["geometries"]["Array.geos"].push(`Geometry.${this.packNameSafe}_${idInfo.path}`);

    // 读取被使用到的模型文件并转换
    const modelFile = this.resourceManager.getResource(modelKey);
    if (!modelFile) {
      console.warn(TAG, `parseModelModel >> File not exist: ${modelKey}`);
      return;
    }
    const rawStr = await modelFile.async('string');
    this.convertModelGeometry(rawStr, idInfo.path);
  }

  /**
   * 转换单个坐垫模型几何体（与女仆模型转换规则一致）：
   *  - 1.10.0 替换 `geometry.model` 为 `geometry.<safe>.<name>`
   *  - 1.12.0+ 改写 `minecraft:geometry[].description.identifier`
   *  - 补齐 Root 骨骼与父级
   */
  private convertModelGeometry(rawStr: string, modelName: string) {
    // 替换非法字符 NaN
    const modelText = rawStr.replace(/NaN/g, '0');
    let modelJson: any;
    try {
      modelJson = JSON.parse(modelText);
    } catch (e) {
      console.warn(TAG, `convertModelGeometry >> Parse json failed: ${modelName}`, e);
      return;
    }

    let beModelStr: string;
    if (modelJson["format_version"] === "1.10.0") {
      // 1.10.0 替换 geometry.model 为坐垫模型名称
      beModelStr = modelText.replace("geometry.model", `geometry.${this.packNameSafe}.${modelName}`);
    } else {
      // 1.12.0+
      for (let model of modelJson["minecraft:geometry"]) {
        model["description"]["identifier"] = `geometry.${this.packNameSafe}.${modelName}`;
      }
      beModelStr = JSON.stringify(modelJson, null, '\t');
    }

    // 骨骼处理
    const beModel = JSON.parse(beModelStr);
    if (beModel["format_version"] === "1.10.0") {
      for (let key in beModel) {
        if (key !== "format_version") {
          this.processBones(beModel[key]["bones"]);
        }
      }
    } else {
      for (let geo of beModel["minecraft:geometry"]) {
        this.processBones(geo["bones"]);
      }
    }

    // texturewidth/textureheight 若为字符串则转为数字
    normalizeTextureSize(beModel);

    // 创建文件（放到坐垫模型输出目录）
    this.chair_models.file(`${modelName}.json`, JSON.stringify(beModel));
  }

  rootBone = {
    "name": "Root",
    "pivot": [0, 0, 0]
  }
  /** 处理骨骼 */
  processBones(bones: { name: string; pivot: number[]; }[]) {
    if (bones === undefined) {
      console.error(TAG, 'processBones >> Failed, bones is undefined,');
      return false;
    }
    // 如果没有 Root 骨骼，则创建 Root 骨骼
    if (!bones.some(bone => bone['name'] === 'Root')) {
      bones.unshift(this.rootBone);
      for (let bone of bones) {
        if (bone['name'] !== 'Root' && bone['parent'] === undefined) {
          bone['parent'] = 'Root';
        }
      }
    }
    return true;
  }

  ///// 坐垫模型缩放与动画 /////
  /** 解析坐垫模型 - 模型缩放 render_entity_scale */
  private parseModelScale(modelInfo: TLMChairModelInfo, seq: number) {
    const rawScale = modelInfo.render_entity_scale ?? 1;
    const scale = Math.max(0.2, Math.min(2, rawScale));
    this.chairAnimationManager.bindModelScale(this.packId, seq, scale);
    this.chairAnimationManager.bindModelIsGecko(this.packId, seq, !!modelInfo.is_gecko);
  }

  /** 解析坐垫模型 - 动画 animation */
  private async parseModelAnimation(modelInfo: TLMChairModelInfo, idInfo: ModelIdInfo, seq: number) {
    // 未指定动画信息，或是不支持的 js 动画（is_gecko === false），则直接退出
    if (!modelInfo.animation || !modelInfo.is_gecko) {
      return;
    }
    // 开始解析，读取使用到的文件，并绑定到坐垫动画管理器
    for (let file of modelInfo.animation) {
      await this.chairAnimationManager.bindModelAnimation(this.packId, seq, file, idInfo.namespace);
    }
  }

  ///// 语言文件解析 /////
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

  /** 解析坐垫模型包图标 */
  private async parseIcon(resourceKey?: string) {
    let key = resourceKey ?? `${this.packName}:textures/chair_icon.png`;
    let icon = this.resourceManager.getResource(key);
    if (icon) {
      let blob = await icon.async('blob');
      this.res.textures_icon.file(`chair_pack_pack_${this.packId + PROFILE.CHAIR_BASE_PACK_INDEX}.png`, blob);
    } else {
      console.log(TAG, `parseIcon, icon not found: ${key}`);
    }
  }

  ///// 翻译文本解析（与女仆包解析规则一致）/////
  /** 通用 I18n 文本处理 */
  private parseI18nText(key: string, text?: string) {
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
    if (!textList) {
      this.res.lang.setLang(key, '');
      return;
    }
    // 语言类型 - 值数组，解析完成后使用 %1 join
    let result = new Map<LangType, string[]>();
    result.set(LangType.en_US, []); // 保底设置 en_US 语言

    for (let text of textList) {
      if (text.startsWith('{') && text.endsWith('}')) {
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
        result.forEach((arr) => {
          arr.push(text);
        });
      }
    }

    let resultStr = new Map<LangType, string>();
    result.forEach((value, langType) => {
      resultStr.set(langType, value.join('%1'));
    });
    this.res.lang.setLang(key, resultStr);
  }

  /** 通用 I18n 文本/数组处理 */
  private parseI18n(key: string, text?: string | string[]) {
    if (!text) {
      this.res.lang.setLang(key, '');
      return;
    }
    if (typeof text === 'string') {
      this.parseI18nText(key, text);
    } else if (Array.isArray(text)) {
      this.parseI18nTextArray(key, text);
    } else {
      this.res.lang.setLang(key, '');
    }
  }
}

interface ModelIdInfo {
  namespace: string;
  path: string;
}

export interface ChairPackConvertorInitParams {
  packId: number; // 转换后的基岩版坐垫模型包 id
  domain: string; // 坐垫子模型包名称，即 `assets/xxx` 的 `xxx`
  input: JSZip; // 该坐垫子模型包的 zip 文件夹，如 `assets/xxx`
  resourceManager: ResourceManager; // 该坐垫子模型包所属的模型包的资源管理器
  chairAnimationManager: AnimationManager; // 坐垫动画管理器（与女仆动画管理器相互独立）
  res: PackFile; // 输出结果
}
