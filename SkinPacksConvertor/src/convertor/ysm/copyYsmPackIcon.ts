import JSZip from 'jszip';
import {PackFile} from '../model/PackFile';
import {ensurePngBlob} from '../util/ensurePngBlob';

/**
 * 尝试将 YSM 包内可用图片写为资源包根目录 `pack_icon.png`。
 * 优先作者头像，其次 player.texture；非 PNG（如 WebP 假后缀）会先转码，失败则换下一张。
 */
export async function copyYsmPackIcon(folder: JSZip, result: PackFile): Promise<void> {
  try {
    const manifestFile = folder.file('ysm.json');
    if (!manifestFile) {
      return;
    }
    const manifest = JSON.parse(await manifestFile.async('string'));
    const avatar = manifest?.metadata?.authors?.[0]?.avatar;
    const candidates: string[] = [];
    if (avatar) {
      candidates.push(avatar);
    }
    const textures = manifest?.files?.player?.texture ?? [];
    for (const t of textures) {
      candidates.push(typeof t === 'string' ? t : t?.uv);
    }
    for (const path of candidates) {
      if (!path) {
        continue;
      }
      const file = folder.file(path);
      if (!file) {
        continue;
      }
      const png = await ensurePngBlob(await file.async('blob'));
      if (png) {
        result.resultFile.file('pack_icon.png', png);
        return;
      }
    }
  } catch (e) {
    console.error('copyYsmPackIcon ERROR', e);
  }
}
