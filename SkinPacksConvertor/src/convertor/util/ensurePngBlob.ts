/**
 * 将任意图片 Blob 规范为基岩可用的真 PNG。
 * YSM 作者头像常把 WebP 写成 .png，原样复制会导致 TextureSet 解析失败。
 */

const PNG_SIG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** RIFF....WEBP */
const WEBP_RIFF = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
const WEBP_TAG = new Uint8Array([0x57, 0x45, 0x42, 0x50]);

function startsWith(bytes: Uint8Array, sig: Uint8Array, offset = 0): boolean {
  if (bytes.length < offset + sig.length) {
    return false;
  }
  for (let i = 0; i < sig.length; i++) {
    if (bytes[offset + i] !== sig[i]) {
      return false;
    }
  }
  return true;
}

/** 是否为 PNG 文件头 */
export function isPngBytes(bytes: Uint8Array): boolean {
  return startsWith(bytes, PNG_SIG);
}

/** 是否为 WebP（RIFF....WEBP） */
export function isWebpBytes(bytes: Uint8Array): boolean {
  return startsWith(bytes, WEBP_RIFF) && bytes.length >= 12 && startsWith(bytes, WEBP_TAG, 8);
}

/**
 * 保证输出为 image/png Blob。
 * - 已是 PNG：原样返回（补齐 MIME）
 * - 其它格式：尝试 createImageBitmap + canvas 重编码为 PNG（浏览器可解 WebP）
 * - 无法转换：返回 null，由调用方尝试下一候选
 */
export async function ensurePngBlob(blob: Blob): Promise<Blob | null> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (isPngBytes(bytes)) {
    if (blob.type === 'image/png') {
      return blob;
    }
    return new Blob([buffer], {type: 'image/png'});
  }

  // 带正确 MIME 有利于部分环境的 createImageBitmap 识别
  const typed = isWebpBytes(bytes)
    ? new Blob([buffer], {type: 'image/webp'})
    : new Blob([buffer], {type: blob.type || 'application/octet-stream'});

  try {
    const bitmap = await createImageBitmap(typed);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return null;
      }
      ctx.drawImage(bitmap, 0, 0);
      const png = await canvasToPngBlob(canvas);
      return png;
    } finally {
      bitmap.close();
    }
  } catch (e) {
    console.warn('[ensurePngBlob] 无法转换为 PNG，将尝试其它候选图', e);
    return null;
  }
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((result) => resolve(result), 'image/png');
  });
}
