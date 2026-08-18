import JSZip from 'jszip';
import {PackFile} from '../model/PackFile';

/**
 * 尝试将 YSM 包内可用图片写为资源包根目录 `pack_icon.png`。
 * 优先作者头像，其次 player.texture 列表中的第一张存在的 uv。
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
      if (file) {
        result.resultFile.file('pack_icon.png', await file.async('blob'));
        return;
      }
    }
  } catch (e) {
    console.error('copyYsmPackIcon ERROR', e);
  }
}
