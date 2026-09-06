/**
 * 从 tlmdl 下载 info.json，供 webpack 打包进网页（避免运行时跨域）。
 * 若网络失败且本地已有文件，则保留现有文件并警告后继续。
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const INFO_URL = 'https://tlmdl.cfpa.team/info.json';
const outDir = path.join(__dirname, '..', 'packs-browser', 'data');
const outFile = path.join(outDir, 'info.json');

function download(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Accept: 'application/json' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        download(res.headers.location).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Timeout downloading info.json'));
    });
  });
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  try {
    const buf = await download(INFO_URL);
    const text = buf.toString('utf8');
    const data = JSON.parse(text);
    if (!Array.isArray(data)) {
      throw new Error('info.json root is not an array');
    }
    fs.writeFileSync(outFile, JSON.stringify(data), 'utf8');
    console.log(`已下载 info.json → ${outFile}（${data.length} 条，${buf.length} bytes）`);
  } catch (err) {
    if (fs.existsSync(outFile)) {
      console.warn(`下载失败，使用已有本地文件: ${outFile}`);
      console.warn(String(err && err.message ? err.message : err));
      return;
    }
    console.error('下载 info.json 失败，且本地无缓存文件，无法继续打包。');
    console.error(String(err && err.message ? err.message : err));
    process.exit(1);
  }
}

main();
