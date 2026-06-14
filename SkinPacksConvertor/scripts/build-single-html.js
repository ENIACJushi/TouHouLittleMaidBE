/**
 * 单文件网站打包脚本
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const htmlPath = path.join(projectRoot, 'src', 'index.html');
const bundlePath = path.join(projectRoot, 'dist', 'SkinConvertor.bundle.js');
const outputPath = path.join(projectRoot, 'SkinPacksConvertor.html'); // 输出路径

if (!fs.existsSync(bundlePath)) {
  throw new Error(`未找到 bundle 文件: ${bundlePath}，请先执行 npm run build`);
}

const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const bundleContent = fs.readFileSync(bundlePath, 'utf8');

const scriptTagRegex = /<script\s+src=["']\.\.\/dist\/SkinConvertor\.bundle\.js["']><\/script>/;
if (!scriptTagRegex.test(htmlContent)) {
  throw new Error('未在 HTML 中找到目标 script 标签，无法自动内联。');
}

const inlineScriptTag = `<script>\n${bundleContent}\n</script>`;
const singleHtml = htmlContent.replace(scriptTagRegex, inlineScriptTag);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, singleHtml, 'utf8');

console.log(`已生成单文件版本: ${outputPath}`);
