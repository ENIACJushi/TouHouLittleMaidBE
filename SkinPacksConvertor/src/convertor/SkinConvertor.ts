import JSZip from "jszip";
import { writeErrorLog } from "../common/Log";
import { SkinPackConvertor } from "./SkinPackConvertor";
import { PackFile } from "./model/PackFile";
import { ResourceManager } from "./resource_manager/ResourceManager";
import { AnimationManager } from "./resource_manager/AnimationManager";
import { MaidAnimationConvertor } from "./animation/MaidAnimationConvertor";
import { convertYsmPackRoot, YsmPackLocator } from "./ysm";
import { clearDynamicMolangRegistrations } from "./molang/v/VariableResolvers";

/**
 * 转换器总入口
 *
 * 支持以 zip 同时引入：
 * - TLM：`assets/<domain>/maid_model.json`
 * - YSM：根目录（或子文件夹）含 `ysm.json`（实现集中在 `./ysm/`）
 */
export class SkinConvertor {
  fileList = []; // java / ysm 模型包列表
  uuid = ''; // uuid
  result: PackFile;
  animationManager = new AnimationManager(); // 全局动画管理器

  /**
   * 输入
   * @param fileList 模型包的 zip 文件列表（TLM 或 YSM）
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
    // 清空上一次转换残留的 keep / 配饰默认值，避免网页连续转换串包
    clearDynamicMolangRegistrations();
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
   * 逐个处理所有输入的模型包：YSM 优先，否则按 TLM 扫描。
   */
  async handleAllPacks() {
    let count = 0;
    for (let i = 0; i < this.fileList.length; i++) {
      try {
        const fileEntry = this.fileList[i];
        const fileName: string = fileEntry?.name ?? `pack_${i}.zip`;

        // 加密 .ysm 无法解析
        if (/\.ysm$/i.test(fileName)) {
          writeErrorLog(`跳过加密 YSM 包（无法解析）: ${fileName}`);
          continue;
        }

        const packZip = await JSZip.loadAsync(fileEntry);

        // 优先识别 YSM（根或子目录含 ysm.json）→ 细节在 convertor/ysm
        const ysmRoots = YsmPackLocator.locate(packZip, fileName);
        if (ysmRoots.length > 0) {
          for (const root of ysmRoots) {
            count++;
            await convertYsmPackRoot({
              packId: count,
              zipIndex: i,
              root,
              animationManager: this.animationManager,
              result: this.result,
            });
          }
          continue;
        }

        // TLM：assets/<domain>/maid_model.json
        const resource = new ResourceManager(packZip);
        this.animationManager.setResourceManager(resource, i);
        try {
          const packIcon = packZip.file('pack.png');
          if (packIcon) {
            this.result.resultFile.file(`pack_icon.png`, packIcon.async('blob'));
          }
        } catch (e) {
          console.error(`handlePack >> Move icon ERROR`, e);
        }
        for (const [domain, info] of resource.getSubPacks()) {
          if (!info.zipFolder.file('maid_model.json')) {
            console.log(`Skip pack (缺少 maid_model.json): ${domain}`);
            continue;
          }
          count++;
          const packConvertor = new SkinPackConvertor({
            packId: count,
            domain: domain,
            input: info.zipFolder,
            resourceManager: resource,
            animationManager: this.animationManager,
            res: this.result,
          });
          await packConvertor.handlePack();
        }
      } catch (e) {
        writeErrorLog(`Error reading ${this.fileList[i].name}: ${e.message}\n${e.stack}`);
      }
    }
  }
}
