import JSZip from "jszip";
import { writeErrorLog } from "../common/Log";
import { SkinPackConvertor } from "./SkinPackConvertor";
import { PackFile } from "./model/PackFile";

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
    this.result.modelAmount = new Array(this.fileList.length);
    await this.handleAllPacks();
    return this.result.export();
  }


  /**
   * 逐个处理所有输入的模型包
   */
  async handleAllPacks() {
    // 对每一个模型包，执行操作（fileList 是模型包的压缩文件）
    for (let i = 0; i < this.fileList.length; i++) {
      try {
        let packZip = await JSZip.loadAsync(this.fileList[i]);
        let packConvertor = new SkinPackConvertor(packZip, i + 1, this.result);
        await packConvertor.handlePack();
      } catch(e) {
        writeErrorLog(`Error reading ${this.fileList[i].name}: ${e.message}\n${e.stack}`);
      }
    }
  }
}
