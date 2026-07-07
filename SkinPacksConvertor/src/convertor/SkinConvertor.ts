import JSZip from "jszip";
import { writeErrorLog } from "../common/Log";
import { SkinPackConvertor } from "./SkinPackConvertor";
import { PackFile } from "./model/PackFile";
import { ResourceManager } from "./resource_manager/ResourceManager";

/**
 * 转换器
 */
export class SkinConvertor {
  fileList = []; // java 模型包列表
  uuid = ''; // uuid
  result: PackFile;

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
    await this.handleAllPacks();
    return this.result.export();
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
        let resource = new ResourceManager(packZip);
        // 若模型包是第一个，则作为基岩版资源包的图标
        try {
          let packIcon = packZip.file('pack.png').async('blob');
          this.result.resultFile.file(`pack_icon.png`, packIcon);
        } catch(e) {
          console.error(`handlePack >> Move icon ERROR`, e);
        }

        // 解析子模型包
        for (let [domain, info] of resource.getSubPacks()) {
          count++;
          let packConvertor = new SkinPackConvertor(count, domain, info.zipFolder, resource, this.result);
          await packConvertor.handlePack();
        }
      } catch(e) {
        writeErrorLog(`Error reading ${this.fileList[i].name}: ${e.message}\n${e.stack}`);
      }
    }
  }
}
