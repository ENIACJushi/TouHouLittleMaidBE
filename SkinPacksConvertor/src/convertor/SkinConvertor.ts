import JSZip from "jszip";
import { writeErrorLog } from "../common/Log";
import { SkinPackConvertor } from "./SkinPackConvertor";
import { PackFile } from "./model/PackFile";
import { ResourceManager } from "./resource_manager/ResourceManager";
import {AnimationManager} from "./resource_manager/AnimationManager";
import {MaidAnimationConvertor} from "./animation/MaidAnimationConvertor";

/**
 * 转换器
 */
export class SkinConvertor {
  fileList = []; // java 模型包列表
  uuid = ''; // uuid
  result: PackFile;
  animationManager = new AnimationManager(); // 全局动画管理器

  /**
   * 输入
   * @param fileList java 模型包的 zip 文件列表
   */
  constructor(fileList: any[]) {
    this.fileList = fileList;
  }

  /**
   * 开始转换
   */
  async startConvert(uuid: string): Promise<undefined | PackFile> {
    /// 信息完整性判断 ///
    if (!this.fileList || this.fileList.length <= 0) {
      alert('请上传Java版模型包');
      return undefined;
    }
    if (!uuid) {
      alert("请输入uuid");
      return undefined;
    }
    this.uuid = uuid;

    /// 执行转换 ///
    this.result = new PackFile(uuid);
    // 处理所有模型包
    await this.handleAllPacks();
    // 将动画定义挂到实体定义上
    await this.exportAnimation();
    // 导出
    return this.result.export();
  }

  async exportAnimation() {
    let convertor = new MaidAnimationConvertor(
      this.animationManager.getAnimationInfos(),
      this.animationManager.getModelScaleInfos(),
      this.animationManager.getModelIsGeckoInfos(),
    );
    let definition = await convertor.exportDefinition();
    let description = this.result.maid_entity['minecraft:client_entity'].description;
    description.scripts = definition.scripts;
    description.animations = definition.animations;
    // 导出动画内容
    let animationFile = {
      "format_version": "1.8.0",
      "animations": definition.animationList,
    };
    this.result.resultFile.folder('animations').file('tlm_pack_maid.animation.json', JSON.stringify(animationFile));
  }

  /**
   * 逐个处理所有输入的模型包
   */
  async handleAllPacks() {
    let count = 0;
    // 对每一个模型包，执行操作（fileList 是模型包的压缩文件）
    for (let i = 0; i < this.fileList.length; i++) {
      try {
        // 解析模型包
        let packZip = await JSZip.loadAsync(this.fileList[i]);
        // 初始化包资源管理器
        let resource = new ResourceManager(packZip);
        // 设置动画管理器的包资源管理器
        this.animationManager.setResourceManager(resource, i);
        // 若模型包是第一个，则作为基岩版资源包的图标
        try {
          let packIcon = packZip.file('pack.png').async('blob');
          this.result.resultFile.file(`pack_icon.png`, packIcon);
        } catch(e) {
          console.error(`handlePack >> Move icon ERROR`, e);
        }
        // 解析子模型包
        for (let [domain, info] of resource.getSubPacks()) {
          if (!info.zipFolder.file('maid_model.json')) {
            console.log(`Skip pack (缺少 maid_model.json): ${domain}`);
            continue;
          }
          count++;
          let packConvertor = new SkinPackConvertor({
            packId: count,
            domain: domain,
            input: info.zipFolder,
            resourceManager: resource,
            animationManager: this.animationManager,
            res: this.result,
          });
          await packConvertor.handlePack();
        }
      } catch(e) {
        writeErrorLog(`Error reading ${this.fileList[i].name}: ${e.message}\n${e.stack}`);
      }
    }
  }
}
