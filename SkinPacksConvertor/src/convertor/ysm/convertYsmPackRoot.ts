import {PackFile} from '../model/PackFile';
import {ResourceManager} from '../resource_manager/ResourceManager';
import {AnimationManager} from '../resource_manager/AnimationManager';
import {YsmPackRoot} from './YsmPackLocator';
import {YsmPackConvertor} from './YsmPackConvertor';
import {toSafeIdentifier} from './YsmIdentifier';
import {copyYsmPackIcon} from './copyYsmPackIcon';

export interface ConvertYsmPackRootParams {
  packId: number;
  /** 在输入 zip 列表中的下标，供 AnimationManager 绑定资源 */
  zipIndex: number;
  root: YsmPackRoot;
  animationManager: AnimationManager;
  result: PackFile;
}

/**
 * 将单个 YSM 模型根目录接入总转换流水线。
 *
 * SkinConvertor 只负责「识别是否为 YSM + 分配 packId」；
 * 具体 ResourceManager / 图标 / 包内转换均在此完成。
 */
export async function convertYsmPackRoot(params: ConvertYsmPackRootParams): Promise<void> {
  const {packId, zipIndex, root, animationManager, result} = params;

  // domain 须与 YsmPackConvertor.packNameSafe 一致，AnimationManager 才能按 namespace 取到文件
  const domain = toSafeIdentifier(root.modelId, packId);
  const resource = ResourceManager.fromFlatDomain(domain, root.zipFolder, 'ysm');
  animationManager.setResourceManager(resource, zipIndex);

  if (packId === 1) {
    await copyYsmPackIcon(root.zipFolder, result);
  }

  const packConvertor = new YsmPackConvertor({
    packId,
    root,
    resourceManager: resource,
    animationManager,
    res: result,
  });
  await packConvertor.handlePack();
}
