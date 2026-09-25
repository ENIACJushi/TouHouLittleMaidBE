# Java 版女仆音效清单

对照工程：`.ref/TouhouLittleMaid-1.20`（TouhouLittleMaid 1.20 / Forge）。  
权威注册：`src/main/java/.../init/InitSounds.java`。  
命名空间：`touhou_little_maid`；下文 ID 省略前缀，写作 `maid.*` 等。

> 说明：女仆「语音」在 `sounds.json` 中多映射到静音占位 `maid/empty`；真实 OGG 由**音效包**（`CustomSoundLoader`）按 `SoundEvent` 填充。播放时服务端选出事件，客户端按女仆的 `soundPackId` 取缓冲。

---

## 1. 播放管线（摘要）

| 步骤 | 行为 | 源 |
|------|------|-----|
| 注册 | `SoundEvent.createFixedRangeEvent(..., 16.0F)` | `InitSounds` |
| 服务端 `playSound` | 路径以 `"maid"` 开头 → 发 `PlayMaidSoundMessage`（16 格），不走原版广播 | `EntityMaid.playSound` |
| 客户端 | `MaidSoundInstance` + `CustomSoundLoader` 缓冲 | `PlayMaidSoundEvent` |
| 频率门 | `soundFreq × GLOBAL_MAID_SOUND_FREQUENCY/100`；未过则丢弃（GUI 试听除外） | `MaidSoundFreqEvent` |
| 静音饰品 | 取消 `MaidPlaySoundEvent`（ambient / hurt / death / item_get 闸门） | `MuteBauble` |
| 音高 | `1 + random * 0.1F` | `EntityMaid.getVoicePitch` |

**Ambient 间隔**：未覆写 → 原版 `LivingEntity` 默认 **80 tick**（4 秒）尝试一次 ambient。

---

## 2. 共享选择器

### 2.1 `SoundUtil.environmentSound(maid, fallback, p)`

按顺序各掷 `rand < p`，命中即返回；全未命中返回 `fallback`：

| 优先级 | SoundEvent | 条件 |
|--------|------------|------|
| 1 | `maid.environment.morning` | dayTime ∈ (0, 3000)（约 6–9 点） |
| 2 | `maid.environment.night` | dayTime ∈ (12000, 15000)（约 18–21 点） |
| 3 | `maid.environment.rain` | 下雨 + 雨生物群系（非热） |
| 4 | `maid.environment.snow` | 下雨 + 雪生物群系 |
| 5 | `maid.environment.cold` | `biome.coldEnoughToSnow(pos)` |
| 6 | `maid.environment.hot` | 温度 > 1.0F |
| — | `fallback` | 模式 ambient |

源：`util/SoundUtil.java`。

### 2.2 `SoundUtil.attackSound(maid, fallback, p)`

| 概率 | 结果 |
|------|------|
| `p` | `maid.ai.find_target` |
| `1-p` | `fallback`（攻击类 mode 音） |

---

## 3. 女仆语音 SoundEvent 全表

### 3.1 模式 / Ambient（`maid.mode.*`）

Ambient 入口：`EntityMaid.getAmbientSound` → `task.getAmbientSound(maid)`。

| ID | 触发方式 | 条件 / 任务 | 源 |
|----|----------|-------------|-----|
| `maid.mode.idle` | Ambient | Idle / Honey / BoardGames：`environmentSound(..., 0.5)`；Fishing：**直接 idle，无环境替换** | `TaskIdle` / `TaskHoney` / `TaskBoardGames` / `TaskFishing` |
| `maid.mode.attack` | Ambient | 近战：`attackSound(..., 0.5)` | `TaskAttack` |
| `maid.mode.range_attack` | Ambient | 弓 / 弩 / 三叉戟 / 枪：`attackSound(..., 0.5)` | `TaskBowAttack` 等 |
| `maid.mode.danmaku_attack` | Ambient | 弹幕：`attackSound(..., 0.5)` | `TaskDanmakuAttack` |
| `maid.mode.farm` | Ambient | 农场类 `IFarmTask` 默认：`environmentSound(..., 0.5)` | `TaskNormalFarm` / 甘蔗 / 瓜 / 可可 / 花草 等 |
| `maid.mode.feed` | Ambient | 喂主人：`environmentSound(..., 0.3)`（概率更低） | `TaskFeedOwner` |
| `maid.mode.shears` | Ambient | 剪毛：env 0.5 | `TaskShears` |
| `maid.mode.milk` | Ambient | 挤奶：env 0.5 | `TaskMilk` |
| `maid.mode.snow` | Ambient | 清雪：env 0.5（覆写 `IFarmTask`） | `TaskSnow` |
| `maid.mode.torch` | Ambient | 火把：env 0.5 | `TaskTorch` |
| `maid.mode.feed_animal` | Ambient | 繁殖：env 0.5 | `TaskFeedAnimal` |
| `maid.mode.extinguishing` | Ambient | 灭火：env 0.5 | `TaskExtinguishing` |
| `maid.mode.break` | **仅注册** | 当前任务无播放路径；音效包可复用 idle 缓冲 | `InitSounds` / `CustomSoundLoader` |
| `maid.mode.furnace` | **仅注册** | 同上 | 同上 |
| `maid.mode.brewing` | **仅注册** | 同上 | 同上 |

**任务 → ambient 基音速查**

| 任务 | 基音 | 选择器 |
|------|------|--------|
| Idle / Honey / BoardGames | idle | env 0.5 |
| Fishing | idle | 无 |
| Attack | attack | attack 0.5 |
| Bow / Crossbow / Trident / Gun | range_attack | attack 0.5 |
| Danmaku | danmaku_attack | attack 0.5 |
| Farm 系列 | farm | env 0.5 |
| Snow | snow | env 0.5 |
| FeedOwner | feed | env **0.3** |
| Shears / Milk / Torch / FeedAnimal / Extinguishing | 同名 mode | env 0.5 |

---

### 3.2 环境（`maid.environment.*`）

不单独挂事件；仅作为 ambient 的替换结果（见 §2.1）。

| ID | 条件摘要 |
|----|----------|
| `maid.environment.morning` | dayTime (0, 3000) + 概率 `p` |
| `maid.environment.night` | dayTime (12000, 15000) + `p` |
| `maid.environment.rain` | 雨 + RAIN 群系 + 非热 + `p` |
| `maid.environment.snow` | 雨 + SNOW 群系 + `p` |
| `maid.environment.cold` | `coldEnoughToSnow` + `p` |
| `maid.environment.hot` | temp > 1.0 + `p` |

---

### 3.3 AI / 事件（`maid.ai.*`）

| ID | 何时播放 | 条件 | 源 |
|----|----------|------|-----|
| `maid.ai.find_target` | Ambient 替代 | 战斗任务 `attackSound` 以概率 `p` 选中 | `SoundUtil.attackSound` |
| `maid.ai.hurt` | 受伤 | 非火焰；非「玩家伤害且冷却为 0」 | `EntityMaid.getHurtSound` |
| `maid.ai.hurt_fire` | 受伤 | `DamageTypeTags.IS_FIRE` | 同上 |
| `maid.ai.hurt_player` | 受伤 | 攻击者为 `Player` 且 `playerHurtSoundCount == 0`；随后置 **120** tick（约 6s）冷却，每 tick 递减 | 同上 + `aiStep` |
| `maid.ai.tamed` | 驯服成功 | 驯服物 / NTR；主人女仆数量允许（或创造） | `EntityMaid.tameMaid`（**不经** `MaidPlaySoundEvent`，静音饰品挡不住） |
| `maid.ai.item_get` | 拾物成功 | 未静音；`pickupSoundCount` 递减，到 **0** 时播放并重置为 **5**（约每 5 次拾取播一次） | `tryPlayMaidPickupSound` |
| `maid.ai.death` | 死亡 | `getDeathSound`（可被 mute 事件取消） | `EntityMaid.getDeathSound` |
| `maid.ai.game_win` | 棋类胜利 | `MaidGameRecordManager.markStatue(true)` | 五子棋 / 象棋等 |
| `maid.ai.game_lost` | 棋类失败 | `markStatue(false)` | 同上 |

---

### 3.4 其它女仆相关

| ID | 何时 | 条件 | 源 |
|----|------|------|-----|
| `maid.credit` | 音效包 GUI 试听 | `isTestSound=true`，绕过频率门 | `MaidSoundPackGui` |
| `maid.ai_chat` | AI / TTS 回复 | 客户端流式音频实例 | `MaidAISoundInstance` / `TTSAudioToClientMessage` |

---

## 4. 同注册表、非女仆语音（相关）

| ID | 说明 | 触发 |
|----|------|------|
| `item.camera_use` | 相机快门 | 对已驯服非睡眠女仆使用相机（射线 ≤8） |
| `block.altar_craft` | 祭坛合成 | 祭坛成功 / 胶片还原 |
| `block.gomoku` / `block.gomoku_reset` | 棋盘落子 / 重置 | 五子棋、象棋等 |
| `entity.box` | 蛋糕盒开盒 | 交互推进阶段；pitch 依阶段 1.0 或 2.0 |
| `item.compass` | 河童罗盘 | 日程读写等；vol 0.8 pitch 1.5 |
| `entity.fairy.*` | 妖怪女仆 ambient/hurt/death | 复用兔子音 |
| `ui.recording_start` / `ui.recording_end` | STT 按键 UI | LLM+STT 开启时 |

内置 OGG（非语音包）：`sounds/block/*`、`entity/box`、`item/camera_use`、`item/point`、`maid/empty`、`ui/recording_*` 等。

---

## 5. 音效包机制（简）

| 项 | 内容 |
|----|------|
| 发现 | `CustomPackLoader` → `CustomSoundLoader.loadSoundPack`；需 `assets/<id>/maid_sound.json` |
| 文件布局 | `assets/<id>/sounds/maid/{mode,ai,environment,other}/`；`前缀+数字.ogg` |
| 空缓冲复用 | attack → range/danmaku；idle → farm/feed/shears/…/break/furnace/brewing；hurt → hurt_fire |
| 内置包 | `littlemaid_peco`（默认约 75%）、`touhou_little_maid` |
| 选择 | GUI → `SetMaidSoundIdMessage` → `EntityMaid.setSoundPackId` |

---

## 6. 闸门与扩展

| 机制 | 作用 |
|------|------|
| `MaidPlaySoundEvent` | 可取消；ambient / hurt / death / item_get 前 |
| `MuteBauble` | 取消上述事件 |
| 女仆 `soundFreq` + 全局频率配置 | 客户端随机丢弃 |
| KubeJS `MAID_PLAY_SOUND` | 脚本可取消 |
| `isSilent()` | 实例级禁播 |

**注意**：`tamed`、棋类 win/lose 直接 `playSound`，**不走** `MaidPlaySoundEvent`。

---

## 7. `InitSounds` 字段 → ID

| 字段 | Registry path |
|------|---------------|
| `MAID_IDLE` … `MAID_BREWING` | `maid.mode.*`（含 break/furnace/brewing） |
| `MAID_FIND_TARGET` … `MAID_DEATH` | `maid.ai.*`（含 hurt_fire / hurt_player / item_get） |
| `GAME_WIN` / `GAME_LOST` | `maid.ai.game_win` / `game_lost` |
| `MAID_HOT` … `MAID_NIGHT` | `maid.environment.*` |
| `MAID_CREDIT` / `MAID_AI_CHAT` | `maid.credit` / `maid.ai_chat` |
| 相机 / 祭坛 / 棋盘 / 盒 / 罗盘 / fairy / recording | 见 §4 |

---

## 8. 源文件索引

| 用途 | 路径（相对 Java 工程根） |
|------|--------------------------|
| 注册 | `src/main/java/.../init/InitSounds.java` |
| 环境/攻击选择 | `.../util/SoundUtil.java` |
| 实体 hurt/death/ambient/拾物/驯服 | `.../entity/passive/EntityMaid.java` |
| 各任务 ambient | `.../entity/task/Task*.java` |
| 音效包加载 | `.../client/sound/CustomSoundLoader.java` |
| 频率门 | `.../client/event/MaidSoundFreqEvent.java` |
| JSON 占位 | `src/main/resources/assets/touhou_little_maid/sounds.json` |

---

**要点**：Java 女仆语音是「任务 ambient（约 4s）+ 环境/索敌替换」与「受伤/死亡/拾物/驯服等事件」两套；模式音在**持续工作中周期性出现**，而非仅在切模式瞬间。
