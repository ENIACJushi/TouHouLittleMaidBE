/**
 * 单文件网站打包脚本
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const htmlPath = path.join(projectRoot, 'src', 'index.html');
const outputPath = path.join(projectRoot, 'SkinPacksConvertor.html');

/** 需要内联的 bundle：HTML 中的 script src 与 dist 文件名 */
const bundles = [
  {
    name: 'SkinConvertor',
    scriptTagRegex: /<script\s+src=["']\.\.\/dist\/SkinConvertor\.bundle\.js["']><\/script>/
  },
  {
    name: 'PacksBrowser',
    scriptTagRegex: /<script\s+src=["']\.\.\/dist\/PacksBrowser\.bundle\.js["']><\/script>/
  }
];

for (const bundle of bundles) {
  const bundlePath = path.join(projectRoot, 'dist', `${bundle.name}.bundle.js`);
  if (!fs.existsSync(bundlePath)) {
    throw new Error(`未找到 bundle 文件: ${bundlePath}，请先执行 npm run build`);
  }
}

let htmlContent = fs.readFileSync(htmlPath, 'utf8');

for (const bundle of bundles) {
  const bundlePath = path.join(projectRoot, 'dist', `${bundle.name}.bundle.js`);
  const bundleContent = fs.readFileSync(bundlePath, 'utf8');

  if (!bundle.scriptTagRegex.test(htmlContent)) {
    throw new Error(`未在 HTML 中找到目标 script 标签: ${bundle.name}.bundle.js，无法自动内联。`);
  }

  const inlineScriptTag = `<script>\n${bundleContent}\n</script>`;
  htmlContent = htmlContent.replace(bundle.scriptTagRegex, inlineScriptTag);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, htmlContent, 'utf8');

console.log(`已生成单文件版本: ${outputPath}`);
