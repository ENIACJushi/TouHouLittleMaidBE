/**
 * Node 环境补丁：补齐转换器依赖的浏览器 API
 *  （alert / document / canvas / createImageBitmap）
 */
import { PNG } from 'pngjs';

type BitmapLike = {
  width: number;
  height: number;
  close: () => void;
  buffer: Buffer;
};

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const errorLogEl = {
  _html: '',
  get innerHTML() {
    return this._html;
  },
  set innerHTML(value: string) {
    const added = value.startsWith(this._html) ? value.slice(this._html.length) : value;
    this._html = value;
    if (added.trim()) {
      console.error(added.trimEnd());
    }
  },
};

async function blobToBuffer(blob: Blob): Promise<Buffer> {
  return Buffer.from(await blob.arrayBuffer());
}

function readPngSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIG)) {
    return null;
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function cropPngTopSquare(buffer: Buffer, size: number): Buffer {
  const png = PNG.sync.read(buffer);
  const out = new PNG({ width: size, height: size });
  PNG.bitblt(png, out, 0, 0, size, size, 0, 0);
  return PNG.sync.write(out);
}

class FakeCanvas {
  width = 0;
  height = 0;
  private source: { bitmap: BitmapLike; size: number } | null = null;

  getContext(type: string) {
    if (type !== '2d') {
      return null;
    }
    return {
      drawImage: (bitmap: BitmapLike, _sx: number, _sy: number, sw: number) => {
        this.source = { bitmap, size: sw };
      },
    };
  }

  toBlob(callback: (blob: Blob | null) => void, mimeType?: string) {
    const type = mimeType || 'image/png';
    try {
      if (!this.source) {
        callback(null);
        return;
      }
      const { bitmap, size } = this.source;
      let bytes: Buffer;
      try {
        bytes = cropPngTopSquare(bitmap.buffer, size);
      } catch (e) {
        console.warn('[polyfill] 图标裁剪失败，改用原图', e);
        bytes = bitmap.buffer;
      }
      // @ts-ignore
      callback(new Blob([bytes], { type }));
    } catch (e) {
      console.error('[polyfill] canvas.toBlob 失败', e);
      callback(null);
    }
  }
}

(globalThis as any).alert = (msg: string) => {
  console.warn('[alert]', msg);
};

/**
 * JSZip 写入 Blob 时依赖 FileReader.readAsArrayBuffer，Node 22 尚未提供
 */
class FileReaderPolyfill {
  result: ArrayBuffer | null = null;
  onload: ((event: { target: FileReaderPolyfill }) => void) | null = null;
  onerror: ((event: { target: { error: unknown } }) => void) | null = null;

  readAsArrayBuffer(blob: Blob) {
    blob.arrayBuffer()
      .then((buffer) => {
        this.result = buffer;
        this.onload?.({ target: this });
      })
      .catch((error) => {
        this.onerror?.({ target: { error } });
      });
  }
}

(globalThis as any).FileReader = FileReaderPolyfill;

(globalThis as any).document = {
  getElementById: (id: string) => {
    if (id === 'error_log') {
      return errorLogEl;
    }
    return null;
  },
  createElement: (tag: string) => {
    if (tag.toLowerCase() === 'canvas') {
      return new FakeCanvas();
    }
    throw new Error(`node-polyfill: 不支持的元素 ${tag}`);
  },
};

(globalThis as any).createImageBitmap = async (image: Blob): Promise<BitmapLike> => {
  const buffer = await blobToBuffer(image);
  const size = readPngSize(buffer);
  return {
    width: size?.width ?? 1,
    height: size?.height ?? 1,
    buffer,
    close() {},
  };
};

/** 读取转换过程中写入的错误日志 */
export function getErrorLog(): string {
  return errorLogEl.innerHTML;
}
