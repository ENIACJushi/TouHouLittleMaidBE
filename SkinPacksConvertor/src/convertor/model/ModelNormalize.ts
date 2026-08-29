/**
 * 模型几何体字段规范化
 */

const TEXTURE_SIZE_KEYS = [
  'texturewidth',
  'textureheight',
  'texture_width',
  'texture_height',
] as const;

/**
 * 将 texturewidth / textureheight（及 1.12+ 的 texture_width / texture_height）
 * 在值为字符串时转为数字，避免基岩版解析异常。
 */
export function normalizeTextureSize(beModel: Record<string, any>): void {
  if (!beModel || typeof beModel !== 'object') {
    return;
  }

  if (beModel['format_version'] === '1.10.0') {
    for (const key in beModel) {
      if (key === 'format_version') {
        continue;
      }
      coerceTextureSizeFields(beModel[key]);
    }
    return;
  }

  // 1.12.0+：尺寸字段在 description 上
  for (const geo of beModel['minecraft:geometry'] ?? []) {
    coerceTextureSizeFields(geo);
    coerceTextureSizeFields(geo?.description);
  }
}

/** 将对象上的贴图尺寸字符串字段转为数字 */
function coerceTextureSizeFields(obj: Record<string, any> | undefined): void {
  if (!obj || typeof obj !== 'object') {
    return;
  }
  for (const key of TEXTURE_SIZE_KEYS) {
    if (typeof obj[key] === 'string') {
      const n = Number(obj[key]);
      if (!Number.isNaN(n)) {
        obj[key] = n;
      }
    }
  }
}
