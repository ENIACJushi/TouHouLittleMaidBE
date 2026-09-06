/**
 * 语言类型
 */
export enum LangType {
  de_DE = 'de_DE',
  en_US = 'en_US',
  es_ES = 'es_ES',
  fr_FR = 'fr_FR',
  it_IT = 'it_IT',
  ja_JP = 'ja_JP',
  ko_KR = 'ko_KR',
  pt_BR = 'pt_BR',
  pt_PT = 'pt_PT',
  ru_RU = 'ru_RU',
  tr_TR = 'tr_TR',
  zh_CN = 'zh_CN',
}

/**
 * 多语言 语言文件（基岩版和Java版格式通用）
 * 主要使用场景是修改 key，利用两函数：导出某个 key 的全部语言数据 `getLang`，设置某个 key 的全部语言数据 `setLang`
 */
export class LangFile {
  /**
   * 语言数据
   */
  private data: Map<LangType, Map<string, string>> = new Map();

  /**
   * 解析语言文件字符串 需要外部逐个读取然后传入解析
   */
  parse(type: LangType, fileStr: string, fileType: LangFileType) {
    // 获取该语言对应的映射
    let record = this.data.get(type) ?? new Map();

    if (fileType === LangFileType.LANG_FILE) {
      // 逐行解析：key=value
      for (const rawLine of fileStr.split(/\r?\n/)) {
        const line = rawLine.trim();
        // 跳过空行和注释行
        if (!line || line.startsWith('#')) {
          continue;
        }
        // 用 "=" 分隔，得到 key-value
        const splitIndex = line.indexOf('=');
        if (splitIndex === -1) {
          continue; // 没有等于号，格式不对直接跳过
        }
        const key = line.substring(0, splitIndex).trim();
        const value = line.substring(splitIndex + 1);
        if (!key) {
          continue;
        }
        // 写入数据
        record.set(key, value);
      }
    } else {
      // 解析 json
      let jsonData = JSON.parse(fileStr) as Record<string, string>;
      for (let key in jsonData) {
        const value = jsonData[key];
        if (!key) {
          continue;
        }
        // 写入数据
        record.set(key, value);
      }
    }

    // 更新 data
    this.data.set(type, record);
  }

  /**
   * 输出语言文件字符串
   */
  stringify(): Map<LangType, string> {
    let result = new Map<LangType, string>();
    this.data.forEach((record, langType) => {
      let str = '';
      record.forEach((value, key) => {
        str += `${key}=${value}\n`;
      });
      result.set(langType, str);
    });
    return result;
  }

  /**
   * 获取翻译信息
   * @returns 语言名称-翻译文本 映射
   */
  getLang(key: string): Map<LangType, string> {
    let result: Map<LangType, string> = new Map();
    this.data.forEach((record, langType) => {
      let value = record.get(key);
      if (value) {
        result.set(langType, value);
      }
    });
    return result;
  }

  /**
   * 设置翻译信息
   * @param key 语言名称
   * @param value 字符串 或 语言名称-翻译文本 Record
   */
  setLang(key: string, value: string | Map<LangType, string>) {
    if (value === undefined) {
      return;
    }
    // 使用唯一字符设置，则只设置默认语言 en_US 即可
    if (typeof value === 'string') {
      let en_US = this.getLangRecord(LangType.en_US);
      en_US.set(key, value);
      return;
    }

    // 设置给定的语言
    value.forEach((value, langType) => {
      this.getLangRecord(langType).set(key, value);
    });
  }

  /**
   * 获取指定语言的数据，未创建则新建
   */
  private getLangRecord(type: LangType) {
    // 获取该语言对应的映射
    let record = this.data.get(type);
    if (!record) {
      record = new Map();
      this.data.set(type, record);
    }
    return record;
  }
}

export enum LangFileType {
  LANG_FILE = 0, // XXX=XXX 格式
  JSON_FILE = 1, // JSON 格式
}