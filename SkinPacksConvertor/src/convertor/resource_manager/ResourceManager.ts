import JSZip from 'jszip';

const TAG = 'ResourceManager';

/**
 * 模型包资源管理器
 * 注意：不同压缩包之间的 domain 不通用，这个管理器仅在一个压缩包下使用
 *
 * 支持两类布局：
 * - TLM：`assets/<domain>/...`
 * - YSM：模型包根目录（含 `ysm.json`），以模型 ID 作为 domain
 */
export class ResourceManager {
  /** 子模型包 [domain（文件夹名）-信息] 映射 */
  private readonly subPacks: Map<string, SubPackResource> = new Map();

  /**
   * 构造资源管理器
   * @param input 输入模型包的压缩包，带有 `assets` 目录
   */
  constructor(input: JSZip) {
    // 列出 assets 目录下的一层子目录（domain），如 assets/aaa
    const domains = new Set<string>();
    for (const path of Object.keys(input.files)) {
      const parts = path.split('/');
      // 仅取 assets 下第一层目录名
      if (parts[0] === 'assets' && parts[1]) {
        domains.add(parts[1]);
      }
    }
    // 初始化子模型包资源索引
    for (const domain of domains) {
      console.log(TAG, `Add subpack, name=${domain}`);
      this.subPacks.set(domain, {
        zipFolder: input.folder(`assets/${domain}`),
        kind: 'tlm',
      });
    }
  }

  /**
   * 注册一个扁平 domain（用于 YSM：整个模型包根目录即资源根）。
   * 若 domain 已存在则覆盖。
   */
  addFlatDomain(domain: string, zipFolder: JSZip, kind: SubPackKind = 'ysm') {
    console.log(TAG, `Add flat subpack, name=${domain}, kind=${kind}`);
    this.subPacks.set(domain, { zipFolder, kind });
  }

  /**
   * 仅包含指定扁平 domain 的资源管理器（供 AnimationManager 按包切换使用）
   */
  static fromFlatDomain(domain: string, zipFolder: JSZip, kind: SubPackKind = 'ysm'): ResourceManager {
    const rm = new ResourceManager(new JSZip());
    rm.addFlatDomain(domain, zipFolder, kind);
    return rm;
  }

  /**
   * 使用路径索引获取资源
   * @param key xxx:PATH 格式的索引键，PATH 必须是一串路径
   * @param defaultDomain 当 key 只包含 `:` 之后的索引时，使用此字符串作为 `:` 之前的 domain
   */
  getResource(key: string, defaultDomain?: string) {
    let info = key.split(':');
    if (info.length === 2) {
      // 使用 key 获取资源
      let pack = this.subPacks.get(info[0]);
      if (pack) {
        return pack.zipFolder.file(info[1]);
      }
    } else if (defaultDomain) {
      // key 缺少 domain，使用 defaultDomain 作为 domain
      let pack = this.subPacks.get(defaultDomain);
      if (pack) {
        return pack.zipFolder.file(key);
      }
    }
    // 缺少信息，无法获取
    return undefined;
  }

  /**
   * 获取全部子模型包信息
   */
  public getSubPacks() {
    return this.subPacks;
  }
}

/** 子包类型：TLM 资源域或 YSM 模型包根 */
export type SubPackKind = 'tlm' | 'ysm';

/**
 * 子模型包资源
 */
export interface SubPackResource {
  /** 该子模型包的 zip 文件夹 */
  zipFolder: JSZip;
  /** 子包来源类型，缺省按 TLM 处理 */
  kind?: SubPackKind;
}
