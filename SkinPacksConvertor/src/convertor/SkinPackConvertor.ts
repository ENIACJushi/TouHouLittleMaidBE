import JSZip from 'jszip';
import { PackFile } from './model/PackFile';
import { TemplatesBE } from "./model/Templates";
import { MaidModelJava } from "./model/MaidModelJava";

const BASE_INDEX = 1000;

/**
 * 单个模型包转换器
 */
export class SkinPackConvertor {
  packName = 'tlm_model_pack';
  packNameSafe = 'tlm_model_pack'; // 模型包安全名称，用于渲染定义
  input: JSZip; // 单个 java 模型包的 zip 文件
  packId: number;
  /* 输出文件 */
  res: PackFile;
  /* 此模型包的模型文件夹 */
  pack_models: JSZip;
  /* 此模型包的渲染控制器 */
  pack_controller: TemplatesBE.RenderControllerPack;

    /**
   * 处理单个模型包
   * @param input 单个 java 模型包的 zip 文件
   * @param packId
   * @param res
   */
  constructor(input: JSZip, packId: number, res: PackFile) {
    this.input = input;
    this.packId = packId;
    this.res = res;
    this.pack_models = this.res.models.folder(this.packName);
    this.pack_controller = JSON.parse(JSON.stringify(TemplatesBE.RENDER_CONTROLLER_PACK));
  }

  /**
   * 执行处理
   */
  async handlePack() {
    this.getPackName(); // 获取模型包名称
    await this.moveIcon(); // 移动图标
    // 移动女仆贴图
    await this.moveTextures();
    // 修改格式并移动模型
    await this.convertModels();
    // todo 处理动画

    // todo 处理语音包

    // 解析模型包信息
    await this.convertMaidModelCfg();
  }

  /**
   * 确定模型包名称
   */
  getPackName() {
    // 确定模型包名称
    for (let file in this.input.files) {
      let folder_list = file.split('/');
      if (folder_list.length === 3 && folder_list[2] === '') {
        this.packName = folder_list[1];
        break;
      }
    }
    // 确定模型包安全名称，用于渲染定义
    let firstChar = this.packName.substring(0, 1)
    this.packNameSafe = (firstChar >= '0' && firstChar <= '9') ? 'a' + this.packName: this.packName;
    console.log(`Process pack: ${this.packName}`);
  }

  /**
   * 移动模型包图标和女仆图标（可能没有）
   */
  async moveIcon() {
    // 移动模型包图标
    try {
      let packIcon = this.input.files["pack.png"].async('blob');
      this.res.textures_icon.file(`pack_pack_${this.packId + BASE_INDEX}.png`, packIcon);
    } catch(e) {
      console.error(`handlePack >> Move icon ERROR`, e);
    }

    // 移动女仆图标（可能没有）
    if (this.input.files[`assets/${this.packName}/textures/maid_icon.png`]) {
      let content = await this.input.files[`assets/${this.packName}/textures/maid_icon.png`].async('blob');
      this.res.textures_icon.file(`pack_maid_${this.packId + BASE_INDEX}.png`, content);
    }
  }

  ///// 贴图操作/////
  async moveTextures() {
    let pack_textures = this.res.textures.folder(this.packName);
    let tasks = [];
    this.input.folder(`assets/${this.packName}/textures/`).forEach((path, file) => {
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
    this.input.folder(`assets/${this.packName}/models/`).forEach((path, file) => {
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
    "name": "root",
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
    // 添加根骨骼 root
    let hasRoot = false;
    for (let bone of bones) {
      if (bone["name"] === "root") {
        hasRoot = true;
        continue;
      }
      // 对于没有父骨骼的骨骼，将父骨骼设为"root"
      if (bone["parent"] === undefined) {
        bone["parent"] = "root";
      }
    }
    // 如果没有root骨骼，则创建root骨骼
    if (!hasRoot) {
      bones.unshift(this.rootBone);
    }
    return true;
  }

  ///// 解析 maid_model.json /////
  async convertMaidModelCfg(): Promise<void> {
    let content = await this.input.files[`assets/${this.packName}/maid_model.json`].async("string");

    let inputJson = JSON.parse(content);

    // 解析作者字符串 author
    let authorStr = `maid_pack.${this.packId + BASE_INDEX}.authors=`;
    switch (typeof(inputJson["author"])) {
      case "undefined": authorStr += ' '; break; // 无作者信息
      case "string": authorStr += inputJson["author"]; break; // 单个作者
      default: // 多个作者
        for (let authorName of inputJson["author"]) {
          authorStr += authorName + " ";
        }
        break;
    }
    authorStr += '\n';
    this.res.langList["en_US"] += authorStr;
    // 确定模型数量
    this.res.modelAmount[this.packId - 1] = inputJson["model_list"].length;
    // 注册贴图和模型
    for (let model_info of inputJson["model_list"]) {
      let model_name = model_info["model_id"].split(':')[1];
      // 在实体定义添加贴图
      this.res.entity_description["textures"][`${this.packNameSafe}_${model_name}`] = `textures/${this.packName}/entity/${model_name}`;
      // 在渲染控制器添加贴图
      this.pack_controller["arrays"]["textures"]["Array.skins"].push(`Texture.${this.packNameSafe}_${model_name}`);
      // 在实体定义添加模型
      if (!model_info["model"]) {
        // 未指定使用的模型，则使用默认的
        this.res.entity_description["geometry"][`${this.packNameSafe}_${model_name}`]
          = `geometry.${this.packNameSafe}.${model_name}`;
      } else {
        // 指定了使用的模型
        let model = model_info["model"].split('/');
        model = model[model.length-1];
        model = model.replace(".json", "");
        this.res.entity_description["geometry"][`${this.packNameSafe}_${model_name}`]
          = `geometry.${this.packNameSafe}.${model}`;
      }
      // 在渲染控制器添加模型
      this.pack_controller["arrays"]["geometries"]["Array.geos"].push(`Geometry.${this.packNameSafe}_${model_name}`);
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
    // 修改语言文件
    await this.convertMaidLang(inputJson);
  }

  /**
   * 解析 maid_model.json 的翻译信息
   */
  async convertMaidLang(inputJson: MaidModelJava): Promise<void> {
    let getText = function (language_text: string, key: any): string {
      // 获取key值对应的内容
      let index = language_text.search(key);
      if (index === -1) return undefined;
      let temp = language_text.substring(index);
      return temp.substring(temp.search('=') + 1, temp.search('\n'));
    }
    for (let lang_name in this.res.langList) {
      // 寻找输入包的语言文件
      let lang_file = this.input.files[`assets/${this.packName}/lang/${lang_name.toLowerCase()}.lang`];
      if (lang_file === undefined) {
        continue;
      }
      let content = await lang_file.async("string");

      // 修改或添加名称
      let target = "";
      if (inputJson["pack_name"].substring(0,1) === '{') {
        // 名称在语言文件
        target = content.replace(
          inputJson["pack_name"].substring(1, inputJson["pack_name"].length - 1)
          , `maid_pack.${this.packId + BASE_INDEX}.name`);
      } else {
        // 名称直接定义
        target = content += `\nmaid_pack.${this.packId + BASE_INDEX}.name=${inputJson["pack_name"]}\n`;
      }

      // 修改或添加 模型包描述
      if (inputJson["description"] === undefined) {
        // 默认键值
        target = target.replace(`maid_pack.${this.packName}.desc`,
          `maid_pack.${this.packId + BASE_INDEX}.desc`);
      } else {
        // 指定键值/字符
        let descStr = "";
        for (let key of inputJson["description"]) {
          if (key.substring(0, 1) === "{") {
            // 指定语言文件，正则匹配
            descStr += getText(content, key.substring(1, key.length - 1)) +' ';
          } else {
            // 直接指定
            descStr += key + " ";
          }
        }
        target += `\nmaid_pack.${this.packId + BASE_INDEX}.desc=${descStr}\n`;
      }

      // 修改或添加 模型名称及描述
      let c = 0;
      for (let model_info of inputJson["model_list"]) {
        let model_name = model_info["model_id"].split(':')[1];
        // 女仆各自的描述和名称可能会共用，需要检查是否已经被替换
        // 名称
        let keyAfter = `model.${this.packId + BASE_INDEX}.${c}.name`;
        let infoName = model_info["name"];
        if (infoName === undefined) {
          // 默认键值
          target = target.replace(`model.${this.packName}.${model_name}.name`, keyAfter);
        } else {
          // 指定键值
          if (infoName.substring(0, 1) === "{") {
            let keyBefore = infoName.substring(1, infoName.length - 1);
            if (target.search(`model.${this.packName}.${model_name}.name`) === -1) {
              // 键已经被使用，另加
              let value = getText(content, keyBefore);
              target += `\n${keyAfter}=${value}\n`;
            } else {
              // 键未被使用，直接修改
              target = target.replace(keyBefore, keyAfter);
            }
          } else {
            // 指定字符
            target += `\n${keyAfter}=${infoName}\n`;
          }
        }

        // 描述
        keyAfter = `model.${this.packId + BASE_INDEX}.${c}.desc`;
        if (model_info["description"] === undefined) {
          // 默认键值
          target = target.replace(`model.${this.packName}.${model_name}.desc`, keyAfter);
        } else{
          let descText = "";
          for (let infoDesc of model_info["description"]) {
            // 指定键值
            if (infoDesc.substring(0, 1) === "{") {
              // 无论键是否已经被使用，都需要拼接
              let keyBefore = infoDesc.substring(1,infoDesc.length - 1);
              descText += getText(content, keyBefore);
            } else {
              // 指定字符
              descText += infoDesc;
            }
          }
          target += `\n${keyAfter}=${descText}\n`;
        }
        c++;
      }
      // 在公共语言文件追加
      this.res.langList[lang_name] += "\n" + target + "\n";
    }
  }
}
