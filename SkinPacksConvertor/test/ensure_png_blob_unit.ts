/**
 * 验证 ensurePngBlob：真 PNG 直通；WebP 在 Node polyfill 下应失败以便回退。
 */
import './node-polyfill';
import * as fs from 'fs/promises';
import * as path from 'path';
import {fileURLToPath} from 'url';
import {ensurePngBlob, isPngBytes, isWebpBytes} from '../src/convertor/util/ensurePngBlob';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    throw new Error(msg);
  }
}

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '../..');
const sampleDir = path.join(repoRoot, '.ref', '小恶魔', '小恶魔');

async function loadBlob(rel: string): Promise<{blob: Blob; bytes: Uint8Array}> {
  const buf = await fs.readFile(path.join(sampleDir, rel));
  const bytes = new Uint8Array(buf);
  return {blob: new Blob([buf]), bytes};
}

async function main() {
  {
    const {blob, bytes} = await loadBlob('textures/default.png');
    assert(isPngBytes(bytes), 'default.png should be PNG');
    assert(!isWebpBytes(bytes), 'default.png should not be WebP');
    const out = await ensurePngBlob(blob);
    assert(out !== null, 'PNG ensure should succeed');
    const outBytes = new Uint8Array(await out!.arrayBuffer());
    assert(isPngBytes(outBytes), 'ensurePngBlob PNG output must stay PNG');
    assert(out!.type === 'image/png', 'MIME must be image/png');
  }

  {
    const {blob, bytes} = await loadBlob(path.join('avatar', '平凡而久远.png'));
    assert(isWebpBytes(bytes), 'avatar misnamed png should be WebP');
    assert(!isPngBytes(bytes), 'avatar should not be real PNG');
    const out = await ensurePngBlob(blob);
    // Node polyfill 无法解码 WebP → null，调用方应回退到 default.png
    assert(out === null, 'WebP ensure should fail under node polyfill');
  }

  console.log('OK ensurePngBlob unit');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
