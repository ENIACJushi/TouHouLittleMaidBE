/**
 * MD5 十六进制摘要，对齐 Java `Md5Utils.md5Hex`（UTF-8 → 小写 hex）。
 * 纯实现，兼容浏览器 webpack 与 Node 测试环境。
 */

/**
 * 计算字符串的 MD5 hex（小写）
 */
export function md5Hex(data: string): string {
  return bytesToHex(md5(utf8ToBytes(data)));
}

function utf8ToBytes(str: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff) {
      const next = str.charCodeAt(++i);
      const cp = 0x10000 + (((c & 0x3ff) << 10) | (next & 0x3ff));
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return out;
}

function bytesToHex(bytes: number[]): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += (bytes[i] >>> 0).toString(16).padStart(2, '0');
  }
  return hex;
}

/** 标准 MD5（RFC 1321），输入为字节数组 */
function md5(bytes: number[]): number[] {
  const originalLen = bytes.length;
  // 填充：先补 0x80，再补 0 至长度 ≡ 56 (mod 64)，最后 8 字节小端 bit 长度
  const withOne = originalLen + 1;
  const padLen = (withOne % 64 <= 56) ? (56 - (withOne % 64)) : (56 + 64 - (withOne % 64));
  const totalLen = withOne + padLen + 8;
  const buf = new Array<number>(totalLen).fill(0);
  for (let i = 0; i < originalLen; i++) {
    buf[i] = bytes[i];
  }
  buf[originalLen] = 0x80;
  const bitLen = originalLen * 8;
  // 小端 64-bit 长度（我们只用低 32 位，模型路径不会超长）
  buf[totalLen - 8] = bitLen & 0xff;
  buf[totalLen - 7] = (bitLen >>> 8) & 0xff;
  buf[totalLen - 6] = (bitLen >>> 16) & 0xff;
  buf[totalLen - 5] = (bitLen >>> 24) & 0xff;

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const K = new Array<number>(64);
  for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;
  }

  for (let offset = 0; offset < totalLen; offset += 64) {
    const M = new Array<number>(16);
    for (let j = 0; j < 16; j++) {
      const i = offset + j * 4;
      M[j] = buf[i] | (buf[i + 1] << 8) | (buf[i + 2] << 16) | (buf[i + 3] << 24);
    }

    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i++) {
      let F: number;
      let g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + rotl(F, s[i])) >>> 0;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  return wordToBytes(a0).concat(wordToBytes(b0), wordToBytes(c0), wordToBytes(d0));
}

function rotl(x: number, c: number): number {
  return ((x << c) | (x >>> (32 - c))) >>> 0;
}

function wordToBytes(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
}
