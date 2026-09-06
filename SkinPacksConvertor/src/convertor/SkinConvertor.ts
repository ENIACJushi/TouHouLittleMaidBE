import JSZip from "jszip";
import { writeErrorLog } from "../common/Log";
import { SkinPackConvertor } from "./SkinPackConvertor";
import { PackFile } from "./model/PackFile";
import { ResourceManager } from "./resource_manager/ResourceManager";
import { AnimationManager } from "./resource_manager/AnimationManager";
import { MaidAnimationConvertor } from "./animation/MaidAnimationConvertor";
import { ChairAnimationConvertor } from "./animation/ChairAnimationConvertor";
import { ChairPackConvertor } from "./ChairPackConvertor";
import { convertYsmPackRoot, YsmPackLocator } from "./ysm";
import { clearDynamicMolangRegistrations } from "./molang/v/VariableResolvers";
import { PROFILE } from "./config";
import { sortDomainsByPackOrder } from "../built_in/packOrder";
import { buildLiteMaidEntityFromFull } from "./buildLiteMaidEntity";

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
  animationManager = new AnimationManager(); // 全局动画管理器（女仆）
  chairAnimationManager = new AnimationManager(); // 坐垫动画管理器（与女仆独立）

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
    // 将女仆动画定义挂到实体定义上
    await this.exportAnimation();
    // 将坐垫动画定义挂到坐垫实体定义上
    await this.exportChairAnimation();
    // 导出
    return this.result.export();
  }

  async exportAnimation() {
    const animInfos = this.animationManager.getAnimationInfos();
    const scaleInfos = this.animationManager.getModelScaleInfos();
    const geckoInfos = this.animationManager.getModelIsGeckoInfos();

    // 完整底板（根目录实体）
    const fullConvertor = new MaidAnimationConvertor(animInfos, scaleInfos, geckoInfos);
    const fullDefinition = await fullConvertor.exportDefinition();
    const description = this.result.maid_entity['minecraft:client_entity'].description;
    description.scripts = fullDefinition.scripts;
    description.animations = fullDefinition.animations;
    const animationFile = {
      "format_version": "1.8.0",
      "animations": fullDefinition.animationList,
    };
    this.result.resultFile.folder('animations').file(
      'tlm_pack_maid.animation.json',
      JSON.stringify(animationFile),
    );

    // 附加包（pack≥1001）：再导出精简底板实体，写入产物 subpacks/simple
    // 内置包转换（BASE_PACK_INDEX=0）由 built_in 流程单独处理，此处跳过
    if (PROFILE.BASE_PACK_INDEX >= 1000) {
      PROFILE.loadWebAddonProfile('lite');
      try {
        const liteConvertor = new MaidAnimationConvertor(animInfos, scaleInfos, geckoInfos);
        const liteDefinition = await liteConvertor.exportDefinition();
        this.result.maid_entity_simple = buildLiteMaidEntityFromFull(
          this.result.maid_entity,
          liteDefinition,
        );
      } finally {
        PROFILE.loadWebAddonProfile('full');
      }
    }
  }

  /**
   * 将坐垫动画定义挂到坐垫实体定义上
   */
  async exportChairAnimation() {
    let convertor = new ChairAnimationConvertor(
      this.chairAnimationManager.getAnimationInfos(),
      this.chairAnimationManager.getModelScaleInfos(),
      this.chairAnimationManager.getModelIsGeckoInfos(),
    );
    let definition = await convertor.exportDefinition();
    let description = this.result.chair_entity['minecraft:client_entity'].description;
    description.scripts = definition.scripts;
    description.animations = definition.animations;
    // 导出动画内容（有坐垫动画时才写出）
    if (Object.keys(definition.animationList).length > 0) {
      let animationFile = {
        "format_version": "1.8.0",
        "animations": definition.animationList,
      };
      this.result.resultFile.folder('animations').file('tlm_pack_chair.animation.json', JSON.stringify(animationFile));
    }
  }

  /**
   * 逐个处理所有输入的模型包：YSM 优先，否则按 TLM 扫描。
   */
  async handleAllPacks() {
    let count = 0;
    let chairCount = 0;
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
        // 按档案中的 PACK_DOMAIN_ORDER 排序：有配置的优先，其余保持相对顺序排在后面
        const subPacks = resource.getSubPacks();
        const orderedDomains = sortDomainsByPackOrder(subPacks.keys(), PROFILE.PACK_DOMAIN_ORDER);
        for (const domain of orderedDomains) {
          const info = subPacks.get(domain);
          if (!info) {
            continue;
          }
          // 女仆皮肤包：maid_model.json
          if (info.zipFolder.file('maid_model.json')) {
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
          // 坐垫模型包：maid_chair.json，与女仆包相对独立
          if (info.zipFolder.file('maid_chair.json')) {
            chairCount++;
            this.chairAnimationManager.setResourceManager(resource, chairCount);
            const chairPackConvertor = new ChairPackConvertor({
              packId: chairCount,
              domain: domain,
              input: info.zipFolder,
              resourceManager: resource,
              chairAnimationManager: this.chairAnimationManager,
              res: this.result,
            });
            await chairPackConvertor.handlePack();
          }
        }
      } catch (e) {
        writeErrorLog(`Error reading ${this.fileList[i].name}: ${e.message}\n${e.stack}`);
      }
    }
  }
}
