/**
 * 修改模组版本
 */

const fs = require('fs');

///////////////////////////////
const version = [ 1, 6, 0 ]; //
const MC = "1.21.4x";        //
const HOTFIX = 1;            //
///////////////////////////////

const versionStr = version.join('.') + `${HOTFIX===0 ? '' : ' - hotfix ' + HOTFIX}`;
const BP_PATH = "../TouHouLittleMaid_BP"
const RP_PATH = "../TouHouLittleMaid_RP"
const BP_UUID = "fed26523-2c16-4560-9076-aff6ad49a1e3";
const RP_UUID = "919b50d9-d6ab-40bb-828d-9e2f40f664a5"
const TEXT_STARTER = "### VERSION_AUTO_GENERATE_START ###"
const TEXT_ENDER = "### VERSION_AUTO_GENERATE_END ###"


const LANG_TEMPLATE = {
    "zh_CN": {
        "pack.name": `车万女仆`,
        "pack.description": `作者: 体宿一(b站) | 版本 ${versionStr} (MC ${MC})`,
        "message.tlm.mc_version": MC,
        "message.tlm.player_join1": `§e[TLM] 车万女仆 ${versionStr}`,
        "message.tlm.player_join2": `§e 访问 mcmod.cn 获取全部教程。`
    },
    "en_US": {
        "pack.name": `Touhou Little Maid`,
        "pack.description": `By: ENIAC_Jushi, version ${versionStr} (For MC ${MC})`,
        "message.tlm.mc_version": MC,
        "message.tlm.player_join1": `§e[TLM] Touhou Little Maid ${versionStr}`,
        "message.tlm.player_join2": `§e Visit mcmod.cn for complete tutorial.`
    }
}


editManifest(true);
editManifest(false);
editLang(BP_PATH);
editLang(RP_PATH);

/**
 * @param {Boolean} BP 是行为包 
 */
function editManifest(BP){
    let dependence = BP ? RP_UUID : BP_UUID;
    let p = BP ? BP_PATH : RP_PATH;
    //// 资源包
    const path = p + "/manifest.json";
    let old = fs.readFileSync(path, "utf-8");
    let newJson = JSON.parse(old);
    // 包版本
    newJson["header"]["version"] = version;
    // module版本
    for(let obj of newJson["modules"]){
        obj["version"] = version;
    }
    // 依赖版本
    for(let obj of newJson["dependencies"]){
        if(obj["uuid"] === dependence){
            obj["version"] = version;
        }
    }
    // 写入
    fs.writeFile(path, JSON.stringify(newJson, "\n", "  "), 'utf8', (err) => {
        if (err) {
            console.error(`写入${path}文件时发生错误: `, err);
            return;
        }
    });
}

// RP-lang
function editLang(packPath = BP_PATH){
    const path = packPath + "/texts/"
    for(let language in LANG_TEMPLATE){
        let langPath = path + language + ".lang";
        let str = getLangStr(LANG_TEMPLATE[language]) 
        let res = fs.readFileSync(langPath, "utf-8");
        
        let starter = res.indexOf(TEXT_STARTER);
        let ender = res.indexOf(TEXT_ENDER);

        if(starter >= 0 && ender >= 0){
            res = res.substring(0, starter) + TEXT_STARTER + '\n' + str + res.substring(ender);
        }
        else{
            res += TEXT_STARTER + "\n";
            res += str + "\n";
            res += TEXT_ENDER + "\n";
        }
        
        fs.writeFile(langPath, res, 'utf8', (err) => {
            if (err) {
                console.error(`写入${langPath}.lang文件时发生错误: `, err);
                return;
            }
        });
    }
}

/**
 * 获取语言字符串
 * @param {Object} langTemplate 
 */
function getLangStr(langTemplate){
    let res = "";
    for(let key in langTemplate){
        res += `${key}=${langTemplate[key]}\n`;
    }
    return res;
}