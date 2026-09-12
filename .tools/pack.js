/**
 * 将json压缩并导出发布包
 */
// import * as AdmZip from 'adm-zip'
// import * as fs from "fs"
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { version, MC, HOTFIX } = require('./version');

const PATH_BP = "../TouhouLittleMaid_BP";
const PATH_RP = "../TouhouLittleMaid_RP";
const BP_NAME = "TouhouLittleMaidBP.mcpack";
const RP_NAME = "TouhouLittleMaidRP.mcpack";

const SPC_PATH = "../SkinPacksConvertor/SkinPacksConvertor.html"

const PACK_NAME = `TouhouLittleMaidBE_${version.join('.')}${HOTFIX===0 ? '' : '_hotfix' + HOTFIX}_${MC}.zip`;

/**
 * 路径包含以下字符串的所有文件会被排除
 */
const excludeList = [
    'typescripts\\'
]
async function main(){
    let bp = zipPack(PATH_BP);
    let rp = zipPack(PATH_RP);
    await bp.writeZipPromise(BP_NAME);
    await rp.writeZipPromise(RP_NAME);
    
    const mcaddon = new AdmZip();
    mcaddon.addLocalFile(BP_NAME);
    mcaddon.addLocalFile(RP_NAME);
    mcaddon.addLocalFile(SPC_PATH);
    await mcaddon.writeZipPromise(PACK_NAME);
    fs.unlink(BP_NAME,()=>{});
    fs.unlink(RP_NAME,()=>{});
}

function zipPack(path){
    const zip = new AdmZip();
    traverseDirectory(path, zip, '');
    return zip;
}

/**
 * 递归处理文件夹
 * @param {string} dir 
 * @param {AdmZip} zip 
 * @param {string} zipDir 
 */
function traverseDirectory(dir, zip, zipDir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const filePathZip = path.join(zipDir, file);
    for (let str of excludeList) {
        if (filePath.indexOf(str) >= 0) {
            console.warn('exclude:', filePathZip);
            return;
        }
    }
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
        // 递归遍历子目录
        traverseDirectory(filePath, zip, filePathZip);
    } else {
        console.log(filePathZip);
        // 处理文件
        try{
            let content = fs.readFileSync(filePath, 'utf-8');
            content = JSON.parse(content);
            zip.addFile(filePathZip, Buffer.from(JSON.stringify(content), "utf8"));
        }
        catch{
            zip.addLocalFile(filePath, zipDir);
        }
    }
  });
}

if(require.main === module) {
    main();
}
