import JSZip from 'jszip';

const TAG = 'YsmPackLocator';

/**
 * 在压缩包中定位 YSM 模型包根目录。
 *
 * 支持两种常见打包方式：
 * 1. zip 根目录直接放 `ysm.json`（模型 ID 取自 zip 文件名）
 * 2. zip 内含一层或多层文件夹，各自带有 `ysm.json`（模型 ID 取文件夹名）
 *
 * 加密 `.ysm` 二进制包无法解析，调用方应在扩展名层面跳过。
 */
export class YsmPackLocator {
  /**
   * 扫描 zip，返回所有含 `ysm.json` 的模型包根。
   * @param packZip 已加载的模型压缩包
   * @param zipFileName 原始文件名（用于根目录 ysm.json 时推导模型 ID）
   */
  static locate(packZip: JSZip, zipFileName?: string): YsmPackRoot[] {
    const roots: YsmPackRoot[] = [];
    const seenDirs = new Set<string>();

    for (const path of Object.keys(packZip.files)) {
      const normalized = path.replace(/\\/g, '/');
      if (!normalized.endsWith('ysm.json') || packZip.files[path].dir) {
        continue;
      }
      // 仅接受名为 ysm.json 的文件（排除 xxxysm.json）
      const parts = normalized.split('/');
      if (parts[parts.length - 1] !== 'ysm.json') {
        continue;
      }

      const dirParts = parts.slice(0, -1);
      const dirKey = dirParts.join('/');
      if (seenDirs.has(dirKey)) {
        continue;
      }
      seenDirs.add(dirKey);

      const modelId = this.resolveModelId(dirParts, zipFileName);
      const zipFolder = dirKey === '' ? packZip : packZip.folder(dirKey);
      if (!zipFolder) {
        console.warn(TAG, `无法打开模型包目录: ${dirKey || '(root)'}`);
        continue;
      }

      console.log(TAG, `发现 YSM 包: modelId=${modelId}, dir=${dirKey || '(root)'}`);
      roots.push({
        modelId,
        relativeDir: dirKey,
        zipFolder,
        manifestPath: normalized,
      });
    }

    // 较浅路径优先，便于稳定处理
    roots.sort((a, b) => {
      const depthA = a.relativeDir ? a.relativeDir.split('/').length : 0;
      const depthB = b.relativeDir ? b.relativeDir.split('/').length : 0;
      if (depthA !== depthB) {
        return depthA - depthB;
      }
      return a.modelId.localeCompare(b.modelId);
    });

    return roots;
  }

  /**
   * 判断压缩包是否为 YSM 模型包（存在至少一个 ysm.json）。
   */
  static isYsmPack(packZip: JSZip): boolean {
    return this.locate(packZip).length > 0;
  }

  /**
   * 由目录名或 zip 文件名推导模型 ID。
   */
  private static resolveModelId(dirParts: string[], zipFileName?: string): string {
    if (dirParts.length > 0) {
      return dirParts[dirParts.length - 1];
    }
    if (zipFileName) {
      const base = zipFileName.replace(/\\/g, '/').split('/').pop() ?? zipFileName;
      return base.replace(/\.(zip|ysm)$/i, '') || 'ysm_pack';
    }
    return 'ysm_pack';
  }
}

/**
 * 单个 YSM 模型包在 zip 中的根位置。
 */
export interface YsmPackRoot {
  /** 模型 ID（文件夹名或 zip 名） */
  modelId: string;
  /** 相对 zip 根的目录，根目录时为空串 */
  relativeDir: string;
  /** 指向该模型包根的 JSZip 文件夹 */
  zipFolder: JSZip;
  /** ysm.json 在 zip 内的完整路径 */
  manifestPath: string;
}
