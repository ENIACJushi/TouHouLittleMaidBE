import JSZip from 'jszip';
import {
  ADDON_PACK_VERSION,
  AddonPackIds,
  SCRIPT_MIN_ENGINE_VERSION,
  SCRIPT_SERVER_MODULE_VERSION,
  TLM_MAIN_BP_UUID,
  TLM_MAIN_PACK_VERSION,
} from './AddonPackIds';
import { buildRegisterMainScript } from './buildRegisterMainScript';

/**
 * 构建皮肤附加行为包（脚本自动 register → send skin → unregister）。
 *
 * @param ids 派生标识
 * @param skinPayload command.txt 同款 JSON
 */
export function buildRegisterBehaviorPack(
  ids: AddonPackIds,
  skinPayload: string,
): JSZip {
  const zip = new JSZip();
  const manifest = {
    format_version: 2,
    header: {
      name: 'TouHou Little Maid - Skin Pack Scripts',
      description: 'Auto-registers skin/chair pack config to TLM via script channel',
      uuid: ids.bpHeaderUuid,
      version: ADDON_PACK_VERSION,
      min_engine_version: SCRIPT_MIN_ENGINE_VERSION,
    },
    modules: [
      {
        type: 'script',
        language: 'javascript',
        uuid: ids.bpScriptModuleUuid,
        entry: 'scripts/main.js',
        version: ADDON_PACK_VERSION,
      },
    ],
    dependencies: [
      // 与对应资源包互依赖
      {
        uuid: ids.rpHeaderUuid,
        version: ADDON_PACK_VERSION,
      },
      // 主包接收端
      {
        uuid: TLM_MAIN_BP_UUID,
        version: TLM_MAIN_PACK_VERSION,
      },
      {
        module_name: '@minecraft/server',
        version: SCRIPT_SERVER_MODULE_VERSION,
      },
    ],
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, '\t'));
  zip.folder('scripts')!.file(
    'main.js',
    buildRegisterMainScript(ids.channelUuid, skinPayload),
  );
  return zip;
}
