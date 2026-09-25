import { md5Hex } from '../util/md5';

/**
 * 东方女仆主行为包 header uuid（皮肤附加 BP 依赖它，通道接收端在主包内）。
 */
export const TLM_MAIN_BP_UUID = 'fed26523-2c16-4560-9076-aff6ad49a1e3';

/**
 * 东方女仆主资源包 header uuid。
 */
export const TLM_MAIN_RP_UUID = '919b50d9-d6ab-40bb-828d-9e2f40f664a5';

/**
 * 主包依赖版本（与仓库 manifest 对齐）。
 */
export const TLM_MAIN_PACK_VERSION: [number, number, number] = [1, 14, 2];

/**
 * 附加包自身 version。
 */
export const ADDON_PACK_VERSION: [number, number, number] = [1, 0, 0];

/**
 * sendScriptEvent 进入正式版的最低 @minecraft/server（MC 1.21.70 / server 1.18.0）。
 */
export const SCRIPT_SERVER_MODULE_VERSION = '1.18.0';

/**
 * 与 SCRIPT_SERVER_MODULE_VERSION 对应的最低引擎版本。
 */
export const SCRIPT_MIN_ENGINE_VERSION: [number, number, number] = [1, 21, 70];

/**
 * 将 32 位 hex 格式化为带横线的 UUID 字符串。
 */
export function formatUuid(hex32: string): string {
  const h = hex32.toLowerCase().replace(/[^0-9a-f]/g, '');
  if (h.length < 32) {
    throw new Error(`formatUuid: hex 过短 (${h.length})`);
  }
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/**
 * 由种子派生稳定 UUID（MD5 → 带横线）。
 * 使用场景：由资源包 uuid 派生行为包 header / 各 module uuid。
 */
export function derivePackUuid(seed: string): string {
  return formatUuid(md5Hex(seed));
}

/**
 * 由资源包 uuid 派生通道用 32 位小写 hex（无横线）。
 * 使用场景：写入附加 BP 脚本，保证每次加载同一通道身份。
 */
export function deriveChannelUuid(resourcePackUuid: string): string {
  return md5Hex(`${normalizeUuid(resourcePackUuid)}:tlm-channel`);
}

/**
 * 规范化用户输入的 UUID（小写、保留横线）。
 */
export function normalizeUuid(uuid: string): string {
  const trimmed = uuid.trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(trimmed)) {
    throw new Error(`非法 UUID: ${uuid}`);
  }
  return trimmed;
}

/**
 * 一次转换所需的全部派生标识。
 */
export type AddonPackIds = {
  /** 资源包 header uuid（用户输入） */
  rpHeaderUuid: string;
  /** 资源包 resources 模块 uuid */
  rpModuleUuid: string;
  /** 行为包 header uuid */
  bpHeaderUuid: string;
  /** 行为包 script 模块 uuid */
  bpScriptModuleUuid: string;
  /** 通道身份 32 hex */
  channelUuid: string;
};

/**
 * 由用户填写的资源包 UUID 派生全套附加包标识。
 */
export function buildAddonPackIds(resourcePackUuid: string): AddonPackIds {
  const rpHeaderUuid = normalizeUuid(resourcePackUuid);
  return {
    rpHeaderUuid,
    rpModuleUuid: derivePackUuid(`${rpHeaderUuid}:rp-module`),
    bpHeaderUuid: derivePackUuid(`${rpHeaderUuid}:bp-header`),
    bpScriptModuleUuid: derivePackUuid(`${rpHeaderUuid}:bp-script`),
    channelUuid: deriveChannelUuid(rpHeaderUuid),
  };
}
