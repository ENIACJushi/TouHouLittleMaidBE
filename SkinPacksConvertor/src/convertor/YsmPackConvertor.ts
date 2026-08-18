import JSZip from 'jszip';
import {PackFile} from './model/PackFile';
import {TemplatesBE} from './model/Templates';
import {LangFile, LangFileType, LangType} from './model/LangFile';
import {YsmJson, YsmTextureEntry} from './model/YsmJson';
import {ResourceManager} from './resource_manager/ResourceManager';
import {AnimationManager} from './resource_manager/AnimationManager';
import {YsmPackRoot} from './resource_manager/YsmPackLocator';
import {
  buildControllerClipHints,
  ControllerClipHints,
  fillEmptyCanonicalClips,
  YsmAnimationControllerFile,
} from './animation/YsmLocomotionResolver';
import {registerYsmAccessoryDefaults} from './animation/YsmAccessoryDefaults';
import {
  applyHideBonesToGeometry,
  collectYsmHideBoneNames,
} from './animation/YsmAccessoryGeoHide';

const TAG = 'YsmPackConvertor';
const BASE_INDEX = 1000;

/**
 * 女仆侧优先绑定的 YSM 动画角色（顺序有意义：后绑定可覆盖同名 clip）。
 * arm / tac / slashblade / extra 等暂不接入，避免无关状态干扰女仆实体。
 */
const MAID_ANIMATION_ROLES = ['main', 'tlm'] as const;

/**
 * YSM 模型包转换器
 *
 * 将单个 YSM 包（根目录含 `ysm.json`）转换为基岩女仆皮肤条目，
 * 输出结构与 {@link SkinPackConvertor} 对齐，以便共用 AnimationManager / PackFile。
 */
export class YsmPackConvertor {
  packId: number;
  /** 原始模型 ID（文件夹名） */
  modelId: string;
  /** 用于 geometry / Texture 标识的安全名 */
  packNameSafe: string;
  /** 模型包根 zip 文件夹 */
  input: JSZip;
  resourceManager: ResourceManager;
  animationManager: AnimationManager;
  res: PackFile;
  langJava = new LangFile();
  pack_models: JSZip;
  pack_controller: TemplatesBE.RenderControllerPack;
  private manifest!: YsmJson;
  /** 从 animation_controllers 解析的 locomotion clip 提示（包级缓存） */
  private controllerHints?: ControllerClipHints;

  constructor(params: YsmPackConvertorInitParams) {
    this.packId = params.packId;
    this.modelId = params.root.modelId;
    this.input = params.root.zipFolder;
    this.resourceManager = params.resourceManager;
    this.animationManager = params.animationManager;
    this.res = params.res;

    this.packNameSafe = toSafeIdentifier(this.modelId, this.packId);
    this.pack_models = this.res.models.folder(this.packNameSafe);
    this.pack_controller = JSON.parse(JSON.stringify(TemplatesBE.RENDER_CONTROLLER_PACK));
  }

  /**
   * 执行单个 YSM 包转换
   */
  async handlePack() {
    console.log(TAG, `Process YSM pack: ${this.modelId} → ${this.packNameSafe}`);

    const manifestFile = this.input.file('ysm.json');
    if (!manifestFile) {
      console.warn(TAG, `缺少 ysm.json，跳过: ${this.modelId}`);
      return;
    }

    const raw = await manifestFile.async('string');
    this.manifest = JSON.parse(raw) as YsmJson;
    if (this.manifest.spec !== 2) {
      console.warn(TAG, `不支持的 ysm.json spec=${this.manifest.spec}，当前仅支持 2，跳过: ${this.modelId}`);
      return;
    }
    if (!this.manifest.files?.player?.model?.main) {
      console.warn(TAG, `ysm.json 缺少 files.player.model.main，跳过: ${this.modelId}`);
      return;
    }

    await this.parseAllLang();
    await this.convertMetadata();
    // 配饰默认值须在藏骨/动画转换之前登记
    this.controllerHints = await this.loadControllerHints();
    await this.registerAccessoryDefaults();
    const hideBones = await this.collectHideBoneNames();
    await this.convertMainModel(hideBones);
    await this.convertTexturesAndModels();
    this.finalizeRenderController();
  }

  /**
   * 读取 main/tlm 动画文本 + ysm.json 轮盘配置，登记 v.roaming.* 默认值。
   */
  private async registerAccessoryDefaults() {
    const texts = await this.readMaidAnimationTexts();
    registerYsmAccessoryDefaults(this.manifest, texts);
  }

  /**
   * 从动画中收集默认应隐藏的骨骼，并在几何体层永久隐藏。
   */
  private async collectHideBoneNames(): Promise<Set<string>> {
    const animMap = this.manifest.files.player.animation ?? {};
    const jsonList: object[] = [];
    for (const role of MAID_ANIMATION_ROLES) {
      const relPath = animMap[role];
      if (!relPath) {
        continue;
      }
      const file = this.input.file(relPath);
      if (!file) {
        continue;
      }
      try {
        jsonList.push(JSON.parse(await file.async('string')));
      } catch (e) {
        console.warn(TAG, `解析动画失败: ${relPath}`, e);
      }
    }
    const hide = collectYsmHideBoneNames(jsonList);
    console.log(TAG, `几何体隐藏骨骼 ${hide.size} 个`);
    return hide;
  }

  private async readMaidAnimationTexts(): Promise<string[]> {
    const animMap = this.manifest.files.player.animation ?? {};
    const texts: string[] = [];
    for (const role of MAID_ANIMATION_ROLES) {
      const relPath = animMap[role];
      if (!relPath) {
        continue;
      }
      const file = this.input.file(relPath);
      if (!file) {
        continue;
      }
      texts.push(await file.async('string'));
    }
    return texts;
  }

  /**
   * 包级元数据：显示名、作者、描述、图标
   */
  private async convertMetadata() {
    const meta = this.manifest.metadata;
    const packKey = this.packId + BASE_INDEX;

    // 包名
    const packName = meta?.name ?? this.modelId;
    this.res.lang.setLang(`maid_pack.${packKey}.name`, packName);

    // 作者
    const authors = (meta?.authors ?? []).map((a) => a.name).filter(Boolean);
    this.res.lang.setLang(`maid_pack.${packKey}.authors`, authors.join(', '));

    // 描述（tips）
    this.res.lang.setLang(`maid_pack.${packKey}.desc`, meta?.tips ?? '');

    // 图标：优先作者头像，其次默认贴图
    await this.parseIcon();
  }

  /**
   * 解析包图标
   */
  private async parseIcon() {
    const authors = this.manifest.metadata?.authors ?? [];
    const avatarPath = authors.find((a) => a.avatar)?.avatar;
    let iconFile = avatarPath ? this.input.file(avatarPath) : undefined;

    if (!iconFile) {
      const textures = this.manifest.files.player.texture ?? [];
      const defaultBase = this.manifest.properties?.default_texture;
      const uvPath = pickDefaultTexturePath(textures, defaultBase);
      if (uvPath) {
        iconFile = this.input.file(uvPath);
      }
    }

    if (!iconFile) {
      return;
    }
    const blob = await iconFile.async('blob');
    this.res.textures_icon.file(`pack_pack_${this.packId + BASE_INDEX}.png`, blob);
  }

  /**
   * 转换主模型（arm 第一人称模型对女仆实体无用，跳过）
   * @param hideBones 默认应隐藏的配饰骨骼（几何体层永久隐藏）
   */
  private async convertMainModel(hideBones: Set<string> = new Set()) {
    const mainPath = this.manifest.files.player.model.main;
    const file = this.input.file(mainPath);
    if (!file) {
      throw new Error(`${TAG}: 主模型不存在: ${mainPath}`);
    }
    await this.convertModelFile(mainPath, file, hideBones);
  }

  /**
   * 转换单个 geo JSON：改 identifier、补 Root 骨、隐藏配饰骨
   */
  private async convertModelFile(
    path: string,
    file: JSZip.JSZipObject,
    hideBones: Set<string> = new Set(),
  ): Promise<boolean> {
    const modelName = getJsonBaseName(path);
    if (!modelName) {
      return false;
    }
    const content = await file.async('string');
    let modelText = content.replace(/NaN/g, '0');
    let modelJson = JSON.parse(modelText);

    let beModelStr: string;
    if (modelJson['format_version'] === '1.10.0') {
      beModelStr = modelText.replace('geometry.model', `geometry.${this.packNameSafe}.${modelName}`);
    } else {
      for (const model of modelJson['minecraft:geometry'] ?? []) {
        model['description']['identifier'] = `geometry.${this.packNameSafe}.${modelName}`;
      }
      beModelStr = JSON.stringify(modelJson, null, '\t');
    }

    const beModel = JSON.parse(beModelStr);
    if (beModel['format_version'] === '1.10.0') {
      for (const key in beModel) {
        if (key !== 'format_version') {
          this.processBones(beModel[key]['bones']);
        }
      }
    } else {
      for (const geo of beModel['minecraft:geometry'] ?? []) {
        this.processBones(geo['bones']);
      }
    }

    // 几何体层永久隐藏配饰（动画 scale:0 在基岩上不可靠）
    const hidden = applyHideBonesToGeometry(beModel, hideBones);
    if (hidden > 0) {
      console.log(TAG, `已在几何体隐藏 ${hidden} 个配饰骨骼`);
    }

    // 输出路径统一落到 models/entity/<pack>/main.json 等形式
    const outName = `${modelName}.json`;
    this.pack_models.file(outName, JSON.stringify(beModel));
    return true;
  }

  private rootBone = {
    name: 'Root',
    pivot: [0, 0, 0],
  };

  private processBones(bones: { name: string; pivot: number[]; parent?: string }[] | undefined) {
    if (!bones) {
      console.error(TAG, 'processBones >> bones is undefined');
      return;
    }
    if (!bones.some((bone) => bone.name === 'Root')) {
      bones.unshift(this.rootBone);
      for (const bone of bones) {
        if (bone.name !== 'Root' && bone.parent === undefined) {
          bone.parent = 'Root';
        }
      }
    }
  }

  /**
   * 按贴图列表生成模型条目（多贴图 = 多可选皮肤，共用主模型与动画）
   */
  private async convertTexturesAndModels() {
    const textures = this.manifest.files.player.texture ?? [];
    if (textures.length === 0) {
      throw new Error(`${TAG}: files.player.texture 为空: ${this.modelId}`);
    }

    const defaultBase = this.manifest.properties?.default_texture;
    const ordered = orderTextures(textures, defaultBase);
    const packTextures = this.res.textures.folder(this.packNameSafe).folder('entity');

    this.res.modelAmount[this.packId - 1] = ordered.length;

    const scale = clampScale(this.manifest.properties?.height_scale ?? 0.7);
    const mainModelName = getJsonBaseName(this.manifest.files.player.model.main) ?? 'main';

    for (let seq = 0; seq < ordered.length; seq++) {
      const uvPath = ordered[seq];
      const texBase = getTextureBaseName(uvPath);
      const safeTexId = toSafeIdentifier(texBase, seq);

      // 复制贴图到 textures/<pack>/entity/<id>.png
      const texFile = this.input.file(uvPath);
      if (!texFile) {
        console.warn(TAG, `贴图不存在，跳过条目: ${uvPath}`);
        continue;
      }
      const blob = await texFile.async('blob');
      packTextures.file(`${safeTexId}.png`, blob);

      // 语言
      const displayName = this.manifest.metadata?.name
        ? (ordered.length > 1 ? `${this.manifest.metadata.name} (${texBase})` : this.manifest.metadata.name)
        : `${this.modelId}_${texBase}`;
      this.res.lang.setLang(`model.${this.packId + BASE_INDEX}.${seq}.name`, displayName);
      this.res.lang.setLang(
        `model.${this.packId + BASE_INDEX}.${seq}.desc`,
        this.manifest.metadata?.tips ?? '',
      );

      // 实体贴图 / 几何
      const geoKey = `${this.packNameSafe}_${safeTexId}`;
      this.res.entity_description['textures'][geoKey] =
        `textures/${this.packNameSafe}/entity/${safeTexId}`;
      this.res.entity_description['geometry'][geoKey] =
        `geometry.${this.packNameSafe}.${mainModelName}`;

      this.pack_controller['arrays']['textures']['Array.skins'].push(`Texture.${geoKey}`);
      this.pack_controller['arrays']['geometries']['Array.geos'].push(`Geometry.${geoKey}`);

      // 缩放与 gecko 标记（YSM 均为 Bedrock/Gecko 风格 JSON 动画）
      this.animationManager.bindModelScale(this.packId, seq, scale);
      this.animationManager.bindModelIsGecko(this.packId, seq, true);

      // 绑定动画
      await this.bindMaidAnimations(seq);
    }
  }

  /**
   * 绑定女仆相关动画文件（main + tlm），并按控制器/启发式填充空桩。
   */
  private async bindMaidAnimations(seq: number) {
    const animMap = this.manifest.files.player.animation ?? {};
    const hints = this.controllerHints ?? new Map();

    for (const role of MAID_ANIMATION_ROLES) {
      const relPath = animMap[role];
      if (!relPath) {
        continue;
      }
      if (!this.input.file(relPath)) {
        console.warn(TAG, `动画文件不存在 (${role}): ${relPath}`);
        continue;
      }
      const info = await this.animationManager.bindModelAnimation(
        this.packId,
        seq,
        relPath,
        this.packNameSafe,
      );
      // main 角色常把 walk/idle 留作空桩，真实 clip 在 pre_main 控制器里
      if (info?.animation?.animations && role === 'main') {
        fillEmptyCanonicalClips(info.animation.animations, hints);
      }
    }
  }

  /**
   * 读取 ysm.json 中列出的 animation_controllers，构建状态→clip 提示。
   */
  private async loadControllerHints(): Promise<ControllerClipHints> {
    const paths = this.manifest.files.player.animation_controllers ?? [];
    const files: YsmAnimationControllerFile[] = [];
    for (const relPath of paths) {
      const file = this.input.file(relPath);
      if (!file) {
        console.warn(TAG, `动画控制器不存在: ${relPath}`);
        continue;
      }
      try {
        const raw = await file.async('string');
        files.push(JSON.parse(raw) as YsmAnimationControllerFile);
      } catch (e) {
        console.warn(TAG, `解析动画控制器失败: ${relPath}`, e);
      }
    }
    const hints = buildControllerClipHints(files);
    if (hints.size > 0) {
      console.log(TAG, `控制器 locomotion 提示: ${[...hints.keys()].join(', ')}`);
    }
    return hints;
  }

  private finalizeRenderController() {
    this.pack_controller['geometry'] = this.pack_controller['geometry']
      .replace('<index>', `${this.packId + BASE_INDEX}`);
    this.pack_controller['textures'][0] = this.pack_controller['textures'][0]
      .replace('<index>', `${this.packId + BASE_INDEX}`);

    this.res.render_controller['render_controllers'][
      `controller.render.touhou_little_maid.pack_${this.packNameSafe}`
    ] = this.pack_controller;
    this.res.entity_description['render_controllers']
      .push(`controller.render.touhou_little_maid.pack_${this.packNameSafe}`);
  }

  /**
   * 解析 lang/ 下语言文件（YSM 使用 en_us.json 等小写名）
   */
  private async parseAllLang() {
    const langDir = this.manifest.files.language_path ?? 'lang';
    for (const langType of Object.values(LangType)) {
      const candidates = [
        `${langDir}/${langType.toLowerCase()}.json`,
        `${langDir}/${langType}.json`,
        `${langDir}/${langType.toLowerCase()}.lang`,
        `${langDir}/${langType}.lang`,
      ];
      let langFile: JSZip.JSZipObject | null = null;
      for (const candidate of candidates) {
        langFile = this.input.file(candidate);
        if (langFile) {
          break;
        }
      }
      if (!langFile) {
        continue;
      }
      const content = await langFile.async('string');
      const isJson = langFile.name.toLowerCase().endsWith('.json');
      this.langJava.parse(
        langType as LangType,
        content,
        isJson ? LangFileType.JSON_FILE : LangFileType.LANG_FILE,
      );
    }
  }
}

export interface YsmPackConvertorInitParams {
  packId: number;
  root: YsmPackRoot;
  resourceManager: ResourceManager;
  animationManager: AnimationManager;
  res: PackFile;
}

/** 将任意名称转为可用作 geometry / 路径段的安全标识 */
export function toSafeIdentifier(name: string, fallbackId: number): string {
  let safe = name
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  if (!safe) {
    safe = `ysm_${fallbackId}`;
  }
  if (/^[0-9]/.test(safe)) {
    safe = `a${safe}`;
  }
  return safe.toLowerCase();
}

function getJsonBaseName(path: string): string | undefined {
  const parts = path.replace(/\\/g, '/').split('/');
  const file = parts[parts.length - 1];
  if (!file.toLowerCase().endsWith('.json')) {
    return undefined;
  }
  const name = file.slice(0, -5);
  return name || undefined;
}

function getTextureUvPath(entry: YsmTextureEntry): string {
  return typeof entry === 'string' ? entry : entry.uv;
}

function getTextureBaseName(uvPath: string): string {
  const parts = uvPath.replace(/\\/g, '/').split('/');
  const file = parts[parts.length - 1] ?? 'texture';
  return file.replace(/\.png$/i, '') || 'texture';
}

/**
 * 按 default_texture 将默认贴图排到最前，其余保持原序。
 */
function orderTextures(textures: YsmTextureEntry[], defaultBase?: string): string[] {
  const paths = textures.map(getTextureUvPath);
  if (!defaultBase) {
    return paths;
  }
  const preferred: string[] = [];
  const rest: string[] = [];
  for (const p of paths) {
    if (getTextureBaseName(p).toLowerCase() === defaultBase.toLowerCase()) {
      preferred.push(p);
    } else {
      rest.push(p);
    }
  }
  return preferred.length > 0 ? [...preferred, ...rest] : paths;
}

function pickDefaultTexturePath(textures: YsmTextureEntry[], defaultBase?: string): string | undefined {
  const ordered = orderTextures(textures, defaultBase);
  return ordered[0];
}

function clampScale(raw: number): number {
  return Math.max(0.2, Math.min(2, raw));
}
