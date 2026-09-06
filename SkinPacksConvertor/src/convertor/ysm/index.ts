/**
 * Yes Steve Model（YSM）包 → 基岩女仆皮肤 转换模块。
 *
 * ## 目录
 * - `YsmJson.d.ts` / `YsmPackLocator`：清单类型与 zip 内定位
 * - `YsmPackConvertor` / `convertYsmPackRoot`：单包转换入口
 * - `YsmLocomotionResolver`：空桩 walk/idle 等用控制器/启发式填充
 * - `adaptYsmSitAnimation`：坐下动画贴地补足（Root/AllBody Y + sitheight 默认）
 * - `adaptYsmSitSkirt`：坐下裙姿（骨名别名、弱俯仰补强、parallel 冲突门控）
 * - `roaming/`：`v.roaming.*` 展平字段名与简易求值
 * - `accessory/`：默认隐藏登记、几何体删骨、动画 scale 烘焙、pre_animation 兜底
 *
 * ## 单包流水线（{@link YsmPackConvertor.handlePack}）
 * 1. 解析 `ysm.json`（spec=2，需 `files.player.model.main`）
 * 2. 语言 / 元数据 / 图标
 * 3. 读 animation_controllers → locomotion 提示
 * 4. {@link registerYsmAccessoryDefaults}（轮盘 + 动画文本；sitheight 负向默认）
 * 5. {@link collectYsmHideBoneNames} → 几何体永久隐藏
 * 6. 贴图变体、绑定 main/tlm 动画、{@link fillEmptyCanonicalClips}、{@link adaptYsmSitClips}、{@link adaptYsmSitSkirtClips}
 * 7. 渲染控制器 / 实体 geometry+textures
 *
 * ## 与总入口的关系
 * {@link SkinConvertor}：zip 分流（YSM vs TLM）、清空 Molang 动态登记、导出动画。
 * 识别到 ysm.json 后调用 {@link convertYsmPackRoot}。
 *
 * ## 注意
 * - `molang/ysm/YsmResolvers.ts` 是 TLM/Gecko 的 `ysm.*` Molang 解析，**不是**本包导入逻辑。
 * - 加密 `.ysm` 二进制无法解析，入口层直接跳过。
 */

export type * from './YsmJson';
export {YsmPackLocator} from './YsmPackLocator';
export type {YsmPackRoot} from './YsmPackLocator';
export {YsmPackConvertor} from './YsmPackConvertor';
export type {YsmPackConvertorInitParams} from './YsmPackConvertor';
export {toSafeIdentifier} from './YsmIdentifier';
export {convertYsmPackRoot} from './convertYsmPackRoot';
export type {ConvertYsmPackRootParams} from './convertYsmPackRoot';
export {copyYsmPackIcon} from './copyYsmPackIcon';
export {
  isAnimationEmpty,
  buildControllerClipHints,
  fillEmptyCanonicalClips,
  resolveLocomotionSourceKey,
  extractStateAnimationNames,
} from './YsmLocomotionResolver';
export {
  adaptYsmSitAnimation,
  adaptYsmSitClips,
  estimateSitDownwardY,
  sitheightDefaultFromForm,
  isSitheightField,
  YSM_SIT_TARGET_LOWER_Y,
  YSM_SITHEIGHT_DEFAULT,
} from './adaptYsmSitAnimation';
export {
  adaptYsmSitSkirtClips,
  remapMissingBonesByAlias,
  boostWeakSitSkirtPitch,
  gateParallelConflictsWithSit,
  YSM_SIT_SKIRT_TARGET_PITCH,
  YSM_SIT_SKIRT_WEAK_ABS,
} from './adaptYsmSitSkirt';
export type {AdaptYsmSitSkirtResult} from './adaptYsmSitSkirt';
export type {
  ControllerClipHints,
  YsmAnimationControllerFile,
  YsmAnimationController,
  YsmControllerState,
} from './YsmLocomotionResolver';
export {toFlatYsmRoamingField, toYsmRoamingKeepField} from './roaming/YsmRoamingFields';
export {evalSimpleYsmRoamingExpr} from './roaming/YsmRoamingExpr';
export {registerYsmAccessoryDefaults} from './accessory/YsmAccessoryDefaults';
export {
  collectYsmHideBoneNames,
  applyHideBonesToGeometry,
} from './accessory/YsmAccessoryGeoHide';
export {appendForcedYsmAccessoryDefaultsToPreAnimation} from './accessory/appendForcedAccessoryDefaults';
export {data as apYsmAccessoryHideData} from './accessory/APYsmAccessoryHide';
