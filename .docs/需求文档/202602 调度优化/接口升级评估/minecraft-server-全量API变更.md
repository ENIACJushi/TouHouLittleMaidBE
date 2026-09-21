# @minecraft/server 全量 API 变更总结

## 对比范围

| 项 | 旧版 | 新版 |
| --- | --- | --- |
| 包版本 | `2.3.0-beta.1.21.111-stable` | `2.11.0-beta.1.26.51-stable` |
| 声明文件 | `TouHouLittleMaidBE/.../@minecraft/server/index.d.ts` | `minecraft-server/.../@minecraft/server/index.d.ts` |
| 文件行数 | 23301 | 29716 |
| 导出符号总数 | 504 | 702 |

相关文档：[Entity 相关变更](./minecraft-server-Entity-API变更.md)（本文为全量总览，Entity 细节以专文为准）。

## 变更摘要

- 新增导出：**202**
- 移除导出：**4**
- 种类变更（class/interface/enum/type）：**0**
- 枚举成员：新增约 **10**，移除约 **1**（涉及 5 个枚举）
- 核心类型成员有变化：Entity, Player, World, WorldAfterEvents, WorldBeforeEvents, Dimension, Block, ItemStack
- 其他 class/interface 成员有变化：**30** 个类型
- WorldAfterEvents 新增信号：**19**；WorldBeforeEvents 新增信号：**5**

按领域看，新版主要扩展方向：

1. **实体/玩家事件与能力**（heal、item drop/pickup、sneaking、tamed、upgrade、容器开关、`Entity.addItem` / `getAABB` 等）
2. **Locator / Waypoint / HUD**（实体与玩家航点、可见性规则）
3. **方块/物品组件与自定义组件面**；`Dimension` 新增 POI / cloneBlocks / spawnXp 等，且 **`findClosestBiome` → `calculateClosestBiomeFromSeed`**、`getBlocks` 参数形态变更（潜在破坏）
4. **战利品表条件与函数**
5. **输入、相机、UI/模态、WorldClock、声音实例** 等

对本仓库的落地建议见文末 **第 9 节**。

## 1. 新增导出（按领域）

### Block/World结构（22）

| 名称 | 种类 | 分类 |
| --- | --- | --- |
| `BlockComponentBlockBreakEvent` | class | 事件 |
| `BlockComponentBlockStateChangeEvent` | class | 事件 |
| `BlockComponentEntityEvent` | class | 事件 |
| `BlockComponentRedstoneUpdateEvent` | class | 事件 |
| `BlockContainerAccessEventOptions` | interface | 选项/结构 |
| `BlockContainerClosedAfterEvent` | class | 事件 |
| `BlockContainerClosedAfterEventSignal` | class | 事件信号 |
| `BlockContainerOpenedAfterEvent` | class | 事件 |
| `BlockContainerOpenedAfterEventSignal` | class | 事件信号 |
| `BlockDynamicPropertiesComponent` | class | 组件 |
| `BlockInstrumentComponent` | class | 组件 |
| `BlockPrecipitationInteractionsComponent` | class | 组件 |
| `BlockQueryOptions` | interface | 选项/结构 |
| `BlockRedstoneProducerComponent` | class | 组件 |
| `PoiBlockInstance` | class | 核心对象 |
| `PoiBlockManager` | class | 核心对象 |
| `PoiBlockOccupancyFilter` | enum | 选项/结构 |
| `PoiBlockType` | class | 核心对象 |
| `PoiDistancePair` | interface | interface |
| `PoiManager` | class | class |
| `PoiNameFilter` | interface | 选项/结构 |
| `PoiTagFilter` | interface | 选项/结构 |

### Entity/Player（55）

| 名称 | 种类 | 分类 |
| --- | --- | --- |
| `EntityAttachPoint` | enum | 枚举 |
| `EntityContainerAccessEventOptions` | interface | 选项/结构 |
| `EntityContainerClosedAfterEvent` | class | 事件 |
| `EntityContainerClosedAfterEventSignal` | class | 事件信号 |
| `EntityContainerOpenedAfterEvent` | class | 事件 |
| `EntityContainerOpenedAfterEventSignal` | class | 事件信号 |
| `EntityEnderInventoryComponent` | class | 组件 |
| `EntityHasMarkVariantCondition` | class | 战利品 |
| `EntityHasVariantCondition` | class | 战利品 |
| `EntityHealAfterEvent` | class | 事件 |
| `EntityHealAfterEventSignal` | class | 事件信号 |
| `EntityHealBeforeEvent` | class | 事件 |
| `EntityHealBeforeEventSignal` | class | 事件信号 |
| `EntityHealCause` | enum | 枚举 |
| `EntityHealEventOptions` | interface | 选项/结构 |
| `EntityHealSource` | class | 选项/结构 |
| `EntityHurtAfterEventOptions` | interface | 选项/结构 |
| `EntityHurtBeforeEvent` | class | 事件 |
| `EntityHurtBeforeEventOptions` | interface | 选项/结构 |
| `EntityHurtBeforeEventSignal` | class | 事件信号 |
| `EntityItemDropAfterEvent` | class | 事件 |
| `EntityItemDropAfterEventSignal` | class | 事件信号 |
| `EntityItemDropEventOptions` | interface | 选项/结构 |
| `EntityItemPickupAfterEvent` | class | 事件 |
| `EntityItemPickupAfterEventSignal` | class | 事件信号 |
| `EntityItemPickupBeforeEvent` | class | 事件 |
| `EntityItemPickupBeforeEventSignal` | class | 事件信号 |
| `EntityItemPickupEventOptions` | interface | 选项/结构 |
| `EntityKilledCondition` | class | 战利品 |
| `EntitySneakingChangedEventOptions` | interface | 选项/结构 |
| `EntityStartSneakingAfterEvent` | class | 事件 |
| `EntityStartSneakingAfterEventSignal` | class | 事件信号 |
| `EntityStopSneakingAfterEvent` | class | 事件 |
| `EntityStopSneakingAfterEventSignal` | class | 事件信号 |
| `EntitySwingSource` | enum | 选项/结构 |
| `EntityTamedAfterEvent` | class | 事件 |
| `EntityTamedAfterEventSignal` | class | 事件信号 |
| `EntityTamedBeforeEvent` | class | 事件 |
| `EntityTamedBeforeEventSignal` | class | 事件信号 |
| `EntityTamedEventOptions` | interface | 选项/结构 |
| `EntityUpgradeAfterEvent` | class | 事件 |
| `EntityUpgradeAfterEventSignal` | class | 事件信号 |
| `EntityVisibilityRules` | interface | 选项/结构 |
| `EntityWaypoint` | class | 客户端/UI |
| `PlayerBreakingBlockEventOptions` | interface | 选项/结构 |
| `PlayerCancelBreakingBlockAfterEvent` | class | 事件 |
| `PlayerCancelBreakingBlockAfterEventSignal` | class | 事件信号 |
| `PlayerSplitScreenSlot` | enum | 枚举 |
| `PlayerStartBreakingBlockAfterEvent` | class | 事件 |
| `PlayerStartBreakingBlockAfterEventSignal` | class | 事件信号 |
| `PlayerUseNameTagAfterEvent` | class | 事件 |
| `PlayerUseNameTagAfterEventSignal` | class | 事件信号 |
| `PlayerVisibilityRules` | interface | 选项/结构 |
| `PlayerWaypoint` | class | 客户端/UI |
| `PlayerWaypointsMode` | enum | 枚举 |

### Errors（11）

| 名称 | 种类 | 分类 |
| --- | --- | --- |
| `CustomDimensionAlreadyRegisteredError` | class | 错误 |
| `CustomDimensionInvalidRegistryError` | class | 错误 |
| `CustomDimensionNameError` | class | 错误 |
| `CustomDimensionReloadNewDimensionError` | class | 错误 |
| `FogSettingsError` | class | 错误 |
| `InvalidBlockComponentError` | class | 错误 |
| `InvalidEntityComponentError` | class | 错误 |
| `InvalidWaypointError` | class | 错误 |
| `InvalidWaypointTextureSelectorError` | class | 错误 |
| `PrimitiveShapeError` | class | 错误 |
| `TickingAreaError` | class | 错误 |

### Item/Container（8）

| 名称 | 种类 | 分类 |
| --- | --- | --- |
| `ContainerAccessSource` | interface | 选项/结构 |
| `ContainerAccessSourceFilter` | interface | 选项/结构 |
| `EnchantInfo` | class | class |
| `EnchantRandomEquipmentFunction` | class | 战利品 |
| `EnchantRandomlyFunction` | class | 战利品 |
| `EnchantWithLevelsFunction` | class | 战利品 |
| `ItemBlockDynamicPropertiesComponent` | class | 组件 |
| `ItemFilter` | interface | 选项/结构 |

### Loot（36）

| 名称 | 种类 | 分类 |
| --- | --- | --- |
| `CarryOverBlockEntityDataFunction` | class | 战利品 |
| `DamagedByEntityCondition` | class | 战利品 |
| `ExplorationMapFunction` | class | 战利品 |
| `ExplosionDecayFunction` | class | 战利品 |
| `FillContainerFunction` | class | 战利品 |
| `IsBabyCondition` | class | 战利品 |
| `KilledByEntityCondition` | class | 战利品 |
| `KilledByPlayerCondition` | class | 战利品 |
| `KilledByPlayerOrPetsCondition` | class | 战利品 |
| `LootItemCondition` | class | 战利品 |
| `LootItemFunction` | class | 战利品 |
| `LootingEnchantFunction` | class | 战利品 |
| `MatchToolCondition` | class | 战利品 |
| `PassengerOfEntityCondition` | class | 战利品 |
| `RandomAuxValueFunction` | class | 战利品 |
| `RandomBlockStateFunction` | class | 战利品 |
| `RandomChanceCondition` | class | 战利品 |
| `RandomChanceWithLootingCondition` | class | 战利品 |
| `RandomDifficultyChanceCondition` | class | 战利品 |
| `RandomDyeFunction` | class | 战利品 |
| `RandomRegionalDifficultyChanceCondition` | class | 战利品 |
| `SetArmorTrimFunction` | class | 战利品 |
| `SetBannerDetailsFunction` | class | 战利品 |
| `SetBookContentsFunction` | class | 战利品 |
| `SetDataFromColorIndexFunction` | class | 战利品 |
| `SetItemCountFunction` | class | 战利品 |
| `SetItemDamageFunction` | class | 战利品 |
| `SetItemDataFunction` | class | 战利品 |
| `SetItemLoreFunction` | class | 战利品 |
| `SetItemNameFunction` | class | 战利品 |
| `SetOminousBottleFunction` | class | 战利品 |
| `SetPotionFunction` | class | 战利品 |
| `SetSpawnEggFunction` | class | 战利品 |
| `SetStewEffectFunction` | class | 战利品 |
| `SmeltItemFunction` | class | 战利品 |
| `SpecificEnchantFunction` | class | 战利品 |

### Other（34）

| 名称 | 种类 | 分类 |
| --- | --- | --- |
| `AABB` | interface | interface |
| `AnimationOptions` | interface | 选项/结构 |
| `BannerPattern` | class | class |
| `BiomeFilter` | interface | 选项/结构 |
| `CatmullRomSpline` | class | class |
| `CloneMode` | enum | 枚举 |
| `ControlScheme` | enum | 枚举 |
| `CustomTexture` | interface | interface |
| `FogSettings` | class | class |
| `ISerializable` | class | class |
| `LinearSpline` | class | class |
| `LocationWaypoint` | class | 客户端/UI |
| `PrimitiveShape` | class | class |
| `PrimitiveShapeQueryOptions` | interface | 选项/结构 |
| `PrimitiveShapesManager` | class | class |
| `ProgressKeyFrame` | interface | interface |
| `RotationKeyFrame` | interface | interface |
| `SoundCompletedAfterEvent` | class | 事件 |
| `SoundCompletedAfterEventSignal` | class | 事件信号 |
| `SoundDefinition` | class | class |
| `SoundDefinitionDurationInfo` | interface | interface |
| `SoundDefinitionFilter` | interface | 选项/结构 |
| `SoundDefinitionMusicInfo` | interface | interface |
| `SoundDefinitionRegistry` | class | class |
| `SoundDurationInfo` | class | class |
| `SoundInstance` | class | class |
| `SplineAnimation` | interface | interface |
| `TextPrimitive` | class | class |
| `TickingArea` | interface | interface |
| `TickingAreaErrorReason` | enum | 枚举 |
| `TickingAreaManager` | class | class |
| `TickingAreaOptions` | interface | 选项/结构 |
| `TimeMarker` | class | class |
| `TimeMarkerOptions` | interface | 选项/结构 |

### UI/Locator（10）

| 名称 | 种类 | 分类 |
| --- | --- | --- |
| `CameraAttachOptions` | interface | 选项/结构 |
| `CameraShakeOptions` | interface | 选项/结构 |
| `CameraShakeType` | enum | 枚举 |
| `LocatorBar` | class | 客户端/UI |
| `LocatorBarError` | class | 错误 |
| `LocatorBarErrorReason` | enum | 枚举 |
| `Waypoint` | class | 客户端/UI |
| `WaypointTexture` | enum | 枚举 |
| `WaypointTextureBounds` | interface | 客户端/UI |
| `WaypointTextureSelector` | interface | 客户端/UI |

### World/Dimension/System（26）

| 名称 | 种类 | 分类 |
| --- | --- | --- |
| `DimensionRegistry` | class | 核心对象 |
| `WorldClock` | class | 核心对象 |
| `WorldClockAddTimeMarkerError` | class | 错误 |
| `WorldClockEventOptions` | interface | 选项/结构 |
| `WorldClockInvalidRegistryError` | class | 错误 |
| `WorldClockInvalidTimeMarkerError` | class | 错误 |
| `WorldClockNotFoundError` | class | 错误 |
| `WorldClockOnPausedAfterEvent` | class | 事件 |
| `WorldClockOnPausedAfterEventSignal` | class | 事件信号 |
| `WorldClockOnRestartBeforeEvent` | class | 事件 |
| `WorldClockOnRestartBeforeEventSignal` | class | 事件信号 |
| `WorldClockOnResumedAfterEvent` | class | 事件 |
| `WorldClockOnResumedAfterEventSignal` | class | 事件信号 |
| `WorldClockOnTimeMarkerAfterEvent` | class | 事件 |
| `WorldClockOnTimeMarkerAfterEventSignal` | class | 事件信号 |
| `WorldClockOnTimeModifiedAfterEvent` | class | 事件 |
| `WorldClockOnTimeModifiedAfterEventSignal` | class | 事件信号 |
| `WorldClockRegistrationError` | class | 错误 |
| `WorldClockRegistrationOptions` | interface | 选项/结构 |
| `WorldClockRegistry` | class | 核心对象 |
| `WorldClockReloadNewWorldClockError` | class | 错误 |
| `WorldClockReloadTimeMarkerError` | class | 错误 |
| `WorldClockRemoveMinecraftTimeMarkerError` | class | 错误 |
| `WorldClockRewindError` | class | 错误 |
| `WorldClockTimeMarkerEventOptions` | interface | 选项/结构 |
| `WorldClockTimeMarkerNotFoundError` | class | 错误 |

## 2. 移除导出

| 名称 | 旧种类 |
| --- | --- |
| `CompoundBlockVolume` | class |
| `CompoundBlockVolumeAction` | enum |
| `CompoundBlockVolumeItem` | interface |
| `CompoundBlockVolumePositionRelativity` | enum |

## 3. 核心类型成员变化

### `Entity`

**新增**

- `addItem(itemStack: ItemStack): ItemStack | undefined;`
- `getAABB(): AABB;`
- `nameplateDepthTested: boolean;`
- `nameplateRenderDistance: number;`

**签名变更**

- **`setDynamicProperties`**
  - 旧: `setDynamicProperties(values: Record<string, boolean | number | string | Vector3>): void;`
  - 新: `setDynamicProperties(values: Record<string, boolean | number | string | Vector3 | undefined>): void;`

### `Player`

**新增**

- `readonly chatDisplayName: string;`
- `readonly fogSettings: FogSettings;`
- `getControlScheme(): ControlScheme;`
- `getPing(): number;`
- `getSplitScreenSlot(): PlayerSplitScreenSlot | undefined;`
- `readonly locatorBar: LocatorBar;`
- `readonly persistentId: string;`
- `setControlScheme(controlScheme?: ControlScheme): void;`

**签名变更**

- **`clearPropertyOverridesForEntity`**
  - 旧: `clearPropertyOverridesForEntity(targetEntity: Entity): void;`
  - 新: `clearPropertyOverridesForEntity(targetEntity: Entity | string): void;`
- **`playSound`**
  - 旧: `playSound(soundId: string, soundOptions?: PlayerSoundOptions): void;`
  - 新: `playSound(soundId: SoundDefinition | string, soundOptions?: PlayerSoundOptions): SoundInstance;`

### `World`

**新增**

- `allowCheats: boolean;`
- `getClock(name: string): WorldClock;`
- `readonly primitiveShapesManager: PrimitiveShapesManager;`
- `readonly seed: string;`
- `readonly soundDefinitionRegistry: SoundDefinitionRegistry;`
- `readonly tickingAreaManager: TickingAreaManager;`

**签名变更**

- **`getPackSettings`**
  - 旧: `getPackSettings(): Record<string, boolean | number | string>;`
  - 新: `getPackSettings(): Record<string, string[] | boolean | number | string>;`
- **`setDynamicProperties`**
  - 旧: `setDynamicProperties(values: Record<string, boolean | number | string | Vector3>): void;`
  - 新: `setDynamicProperties(values: Record<string, boolean | number | string | Vector3 | undefined>): void;`

### `WorldAfterEvents`

**新增**

- `readonly blockContainerClosed: BlockContainerClosedAfterEventSignal;`
- `readonly blockContainerOpened: BlockContainerOpenedAfterEventSignal;`
- `readonly entityContainerClosed: EntityContainerClosedAfterEventSignal;`
- `readonly entityContainerOpened: EntityContainerOpenedAfterEventSignal;`
- `readonly entityHeal: EntityHealAfterEventSignal;`
- `readonly entityItemDrop: EntityItemDropAfterEventSignal;`
- `readonly entityItemPickup: EntityItemPickupAfterEventSignal;`
- `readonly entityStartSneaking: EntityStartSneakingAfterEventSignal;`
- `readonly entityStopSneaking: EntityStopSneakingAfterEventSignal;`
- `readonly entityTamed: EntityTamedAfterEventSignal;`
- `readonly entityUpgrade: EntityUpgradeAfterEventSignal;`
- `readonly playerCancelBreakingBlock: PlayerCancelBreakingBlockAfterEventSignal;`
- `readonly playerStartBreakingBlock: PlayerStartBreakingBlockAfterEventSignal;`
- `readonly playerUseNameTag: PlayerUseNameTagAfterEventSignal;`
- `readonly soundCompleted: SoundCompletedAfterEventSignal;`
- `readonly worldClockOnPaused: WorldClockOnPausedAfterEventSignal;`
- `readonly worldClockOnResumed: WorldClockOnResumedAfterEventSignal;`
- `readonly worldClockOnTimeMarker: WorldClockOnTimeMarkerAfterEventSignal;`
- `readonly worldClockOnTimeModified: WorldClockOnTimeModifiedAfterEventSignal;`

### `WorldBeforeEvents`

**新增**

- `readonly entityHeal: EntityHealBeforeEventSignal;`
- `readonly entityHurt: EntityHurtBeforeEventSignal;`
- `readonly entityItemPickup: EntityItemPickupBeforeEventSignal;`
- `readonly entityTamed: EntityTamedBeforeEventSignal;`
- `readonly worldClockOnRestart: WorldClockOnRestartBeforeEventSignal;`

### `Dimension`

**新增**

- `calculateClosestBiomeFromSeed( pos: Vector3, biomeToFind: BiomeType | string, options?: BiomeSearchOptions, ): Vector3 | undefined;`
- `cloneBlocks( beginLocation: Vector3, endLocation: Vector3, destination: Vector3, cloneMode: CloneMode, filter?: BlockFilter, ): void;`
- `containsBiomes(volume: BlockVolumeBase, biomeFilter: BiomeFilter, isSuperset: boolean): boolean;`
- `getGeneratedStructures(location: Vector3): (minecraftvanilladata.MinecraftFeatureTypes | string)[];`
- `readonly poiManager: PoiManager;`
- `spawnXp(location: Vector3, amount: number): void;`

**移除**

- `findClosestBiome(pos: Vector3, biomeToFind: BiomeType | string, options?: BiomeSearchOptions): Vector3 | undefined;`

**签名变更**

- **`fillBlocks`**
  - 旧: `fillBlocks( volume: BlockVolumeBase | CompoundBlockVolume, block: BlockPermutation | BlockType | string, options?: BlockFillOptions, ): ListBlockVolume;`
  - 新: `fillBlocks( volume: BlockVolumeBase, block: BlockPermutation | BlockType | string, options?: BlockFillOptions, ): ListBlockVolume;`
- **`getBlocks`**
  - 旧: `getBlocks(volume: BlockVolumeBase, filter: BlockFilter, allowUnloadedChunks?: boolean): ListBlockVolume;`
  - 新: `getBlocks(volume: BlockVolumeBase, options: BlockQueryOptions, allowUnloadedChunks?: boolean): ListBlockVolume;`
- **`playSound`**
  - 旧: `playSound(soundId: string, location: Vector3, soundOptions?: WorldSoundOptions): void;`
  - 新: `playSound(soundId: string, location: Vector3, soundOptions?: WorldSoundOptions): SoundInstance;`

### `Block`

**新增**

- `getComponents(): BlockComponent[];`
- `getParts(): Block[] | undefined;`
- `hasComponent(componentId: string): boolean;`

### `ItemStack`

**签名变更**

- **`setDynamicProperties`**
  - 旧: `setDynamicProperties(values: Record<string, boolean | number | string | Vector3>): void;`
  - 新: `setDynamicProperties(values: Record<string, boolean | number | string | Vector3 | undefined>): void;`

## 4. World 事件信号变化

### WorldAfterEvents 新增

- `readonly blockContainerClosed: BlockContainerClosedAfterEventSignal;`
- `readonly blockContainerOpened: BlockContainerOpenedAfterEventSignal;`
- `readonly entityContainerClosed: EntityContainerClosedAfterEventSignal;`
- `readonly entityContainerOpened: EntityContainerOpenedAfterEventSignal;`
- `readonly entityHeal: EntityHealAfterEventSignal;`
- `readonly entityItemDrop: EntityItemDropAfterEventSignal;`
- `readonly entityItemPickup: EntityItemPickupAfterEventSignal;`
- `readonly entityStartSneaking: EntityStartSneakingAfterEventSignal;`
- `readonly entityStopSneaking: EntityStopSneakingAfterEventSignal;`
- `readonly entityTamed: EntityTamedAfterEventSignal;`
- `readonly entityUpgrade: EntityUpgradeAfterEventSignal;`
- `readonly playerCancelBreakingBlock: PlayerCancelBreakingBlockAfterEventSignal;`
- `readonly playerStartBreakingBlock: PlayerStartBreakingBlockAfterEventSignal;`
- `readonly playerUseNameTag: PlayerUseNameTagAfterEventSignal;`
- `readonly soundCompleted: SoundCompletedAfterEventSignal;`
- `readonly worldClockOnPaused: WorldClockOnPausedAfterEventSignal;`
- `readonly worldClockOnResumed: WorldClockOnResumedAfterEventSignal;`
- `readonly worldClockOnTimeMarker: WorldClockOnTimeMarkerAfterEventSignal;`
- `readonly worldClockOnTimeModified: WorldClockOnTimeModifiedAfterEventSignal;`

### WorldAfterEvents 移除

_无_

### WorldAfterEvents 签名变更

_无_

### WorldBeforeEvents 新增

- `readonly entityHeal: EntityHealBeforeEventSignal;`
- `readonly entityHurt: EntityHurtBeforeEventSignal;`
- `readonly entityItemPickup: EntityItemPickupBeforeEventSignal;`
- `readonly entityTamed: EntityTamedBeforeEventSignal;`
- `readonly worldClockOnRestart: WorldClockOnRestartBeforeEventSignal;`

### WorldBeforeEvents 移除

_无_

### WorldBeforeEvents 签名变更

_无_

## 5. 组件 TypeMap 新增键

### EntityComponentTypeMap

- `minecraft:ender_inventory`

### BlockComponentTypeMap

- `minecraft:dynamic_properties`
- `minecraft:instrument_sound`
- `minecraft:precipitation_interactions`
- `minecraft:redstone_producer`

### ItemComponentTypeMap

- `minecraft:block_actor_dynamic_properties`

## 6. 枚举成员变化

### `BlockComponentTypes`

新增:

- `DynamicProperties`
- `Instrument`
- `MapColor`
- `Movable`
- `PrecipitationInteractions`
- `RedstoneProducer`

### `EnchantmentSlot`

新增:

- `MeleeSpear`

### `EntityComponentTypes`

新增:

- `EnderInventory`

### `GameRule`

新增:

- `PlayerWaypoints`

移除:

- `LocatorBar`

### `ItemComponentTypes`

新增:

- `BlockDynamicProperties`

## 7. 其他类型成员变化一览

下表列出除第 3 节核心类型外、成员有增删改的 class/interface（数字为新增/移除/签名变更条数）。明细过长时建议对照新版 `index.d.ts`。

| 名称 | 种类 | + | - | ~ |
| --- | --- | ---: | ---: | ---: |
| `AimAssistCategory` | class | 2 | 0 | 0 |
| `AimAssistCategorySettings` | class | 4 | 0 | 0 |
| `AimAssistPreset` | class | 4 | 1 | 0 |
| `AimAssistPresetSettings` | class | 8 | 2 | 0 |
| `BiomeType` | class | 2 | 0 | 0 |
| `BlockPermutation` | class | 1 | 0 | 0 |
| `BlockType` | class | 1 | 0 | 0 |
| `BlockVolumeBase` | class | 2 | 0 | 0 |
| `BookError` | class | 0 | 0 | 1 |
| `BookPageContentError` | class | 0 | 0 | 2 |
| `Camera` | class | 4 | 0 | 0 |
| `ClientSystemInfo` | class | 1 | 0 | 0 |
| `ContainerRulesError` | class | 0 | 0 | 1 |
| `ContainerSlot` | class | 0 | 0 | 1 |
| `CustomCommandError` | class | 0 | 0 | 1 |
| `CustomComponentNameError` | class | 0 | 0 | 1 |
| `EntityHurtAfterEventSignal` | class | 0 | 0 | 1 |
| `EntityType` | class | 1 | 0 | 0 |
| `GameRules` | class | 1 | 1 | 0 |
| `InvalidEntityError` | class | 0 | 0 | 2 |
| `InvalidItemStackError` | class | 0 | 0 | 1 |
| `ItemDurabilityComponent` | class | 1 | 0 | 0 |
| `ItemType` | class | 1 | 0 | 0 |
| `LootItem` | class | 2 | 0 | 0 |
| `LootPool` | class | 1 | 0 | 0 |
| `NamespaceNameError` | class | 0 | 0 | 1 |
| `PackSettingChangeAfterEvent` | class | 0 | 0 | 1 |
| `PlayerSwingStartAfterEvent` | class | 1 | 0 | 0 |
| `StartupEvent` | class | 2 | 0 | 0 |
| `StructureManager` | class | 1 | 0 | 0 |

### 7.1 含移除或签名变更的类型（潜在破坏性）

#### `AimAssistPreset`

移除:

- `getExcludedTargets(): string[];`

新增:

- `getExcludedBlockTagTargets(): string[];`
- `getExcludedBlockTargets(): string[];`
- `getExcludedEntityTargets(): string[];`
- `getExcludedEntityTypeFamilyTargets(): string[];`

#### `AimAssistPresetSettings`

移除:

- `getExcludedTargets(): string[] | undefined;`
- `setExcludedTargets( targets?: ( | keyof typeof minecraftvanilladata.MinecraftBlockTypes | keyof typeof minecraftvanilladata.MinecraftEntityTypes | string )[], ): void;`

新增:

- `getExcludedBlockTagTargets(): string[] | undefined;`
- `getExcludedBlockTargets(): string[] | undefined;`
- `getExcludedEntityTargets(): string[] | undefined;`
- `getExcludedEntityTypeFamilyTargets(): string[] | undefined;`
- `setExcludedBlockTagTargets(targets?: string[]): void;`
- `setExcludedBlockTargets(targets?: (keyof typeof minecraftvanilladata.MinecraftBlockTypes | string)[]): void;`
- `setExcludedEntityTargets(targets?: (keyof typeof minecraftvanilladata.MinecraftEntityTypes | string)[]): void;`
- `setExcludedEntityTypeFamilyTargets(targets?: string[]): void;`

#### `BookError`

签名变更:

- **`reason`**
  - 旧: `reason: BookErrorReason;`
  - 新: `readonly reason: BookErrorReason;`

#### `BookPageContentError`

签名变更:

- **`pageIndex`**
  - 旧: `pageIndex: number;`
  - 新: `readonly pageIndex: number;`
- **`reason`**
  - 旧: `reason: BookErrorReason;`
  - 新: `readonly reason: BookErrorReason;`

#### `ContainerRulesError`

签名变更:

- **`reason`**
  - 旧: `reason: ContainerRulesErrorReason;`
  - 新: `readonly reason: ContainerRulesErrorReason;`

#### `ContainerSlot`

签名变更:

- **`setDynamicProperties`**
  - 旧: `setDynamicProperties(values: Record<string, boolean | number | string | Vector3>): void;`
  - 新: `setDynamicProperties(values: Record<string, boolean | number | string | Vector3 | undefined>): void;`

#### `CustomCommandError`

签名变更:

- **`reason`**
  - 旧: `reason: CustomCommandErrorReason;`
  - 新: `readonly reason: CustomCommandErrorReason;`

#### `CustomComponentNameError`

签名变更:

- **`reason`**
  - 旧: `reason: CustomComponentNameErrorReason;`
  - 新: `readonly reason: CustomComponentNameErrorReason;`

#### `EntityHurtAfterEventSignal`

签名变更:

- **`subscribe`**
  - 旧: `subscribe( callback: (arg0: EntityHurtAfterEvent) => void, options?: EntityEventOptions, ): (arg0: EntityHurtAfterEvent) => void;`
  - 新: `subscribe( callback: (arg0: EntityHurtAfterEvent) => void, options?: EntityHurtAfterEventOptions, ): (arg0: EntityHurtAfterEvent) => void;`

#### `GameRules`

移除:

- `locatorBar: boolean;`

新增:

- `playerWaypoints: PlayerWaypointsMode;`

#### `InvalidEntityError`

签名变更:

- **`id`**
  - 旧: `id: string;`
  - 新: `readonly id: string;`
- **`type`**
  - 旧: `type: string;`
  - 新: `readonly type: string;`

#### `InvalidItemStackError`

签名变更:

- **`itemType`**
  - 旧: `itemType: ItemType;`
  - 新: `readonly itemType: ItemType;`

#### `NamespaceNameError`

签名变更:

- **`reason`**
  - 旧: `reason: NamespaceNameErrorReason;`
  - 新: `readonly reason: NamespaceNameErrorReason;`

#### `PackSettingChangeAfterEvent`

签名变更:

- **`settingValue`**
  - 旧: `readonly settingValue: boolean | number | string;`
  - 新: `readonly settingValue: string[] | boolean | number | string;`

## 8. 升级注意点（通用）

1. 优先处理 **移除成员** 与 **签名变更**（第 3、7.1 节），再考虑采用新 API。
2. 本仓库当前几乎不用 AimAssist / CompoundBlockVolume；移除的 4 个 CompoundBlockVolume* 与 GameRules.`locatorBar` → `playerWaypoints` 对现有代码影响小。
3. `WorldAfterEvents` / `WorldBeforeEvents` 新增信号较多，订阅处注意 Options 类型专用化（如 `EntityHurtAfterEventOptions`）。
4. `Player.playSound` / `Dimension.playSound` 返回值变为 `SoundInstance`；`Dimension.findClosestBiome` 更名为 `calculateClosestBiomeFromSeed`，`getBlocks` 参数改为 `BlockQueryOptions`——若项目有直接调用需改。
5. Locator/Waypoint、WorldClock、POI、Fog/ControlScheme 等可按玩法需要择机引入，不必与核心升级绑死。

---

## 9. 对本项目（TouHouLittleMaidBE）的改进建议

> 对照现状：`@minecraft/server@2.3.0-beta.1.21.111-stable`（`TouHouLittleMaid_BP/typescripts/package.json`）。架构以 **data-driven 实体触发 + Dynamic Property + `system.run*`** 为主，事件入口在 `src/events/`，女仆逻辑在 `src/maid/`。

### 9.1 建议优先级总览

| 优先级 | 方向 | 预期收益 |
| --- | --- | --- |
| P0 | 修 `Backpack.removeItem*` 扣减 bug；升级前盘点破坏性签名 | 正确性 / 可升级 |
| P1 | 升到 2.11 后采用 `Entity.addItem`、typed `EntityComponentTypes`、补 `isValid` | 稳定性 / 可维护性 |
| P2 | 用 heal / hurt before / tamed / itemPickup 等事件减轮询与 JSON 耦合 | 性能 / 逻辑清晰 |
| P3 | Waypoint 回家指引、容器开闭替代 nameTag 检查模式、方块组件新事件 | 体验增强 |

### 9.2 P0 — 与版本无关、应先修

1. **`Backpack.removeItem` / `removeItem_type` 部分堆叠扣减错误**  
   文件：`src/maid/facets/Backpack.ts`（约 119、149 行）在 `item.amount > left` 分支写了 `left -= count`，应为按实际移除量扣减。影响农场消耗种子等路径。

2. **升级前做一次编译与调用点扫描**  
   - 确认未使用已移除的 `CompoundBlockVolume*`。  
   - 若启用 `entityHurt` 订阅（`main.ts` 中曾有 debug），options 需改为 `EntityHurtAfterEventOptions`。  
   - 搜索 `playSound` / `getBlocks` / `findClosestBiome` / `fillBlocks` / `setDynamicProperties` 封装是否依赖旧签名。

### 9.3 P1 — 升级 2.11 后立刻可做的替换

3. **`Entity.addItem` 替换库存入包路径**  
   - 现状：`Backpack.addItem` → `inventory.container.addItem`（`Backpack.ts`）；磁力拾取 `Pick.ts` 同类逻辑。  
   - 建议：热路径改为 `maid.addItem(itemStack)`，统一剩余堆叠与 `InvalidEntityComponentError` 处理。

4. **组件 ID 字符串 → `EntityComponentTypes` / `ItemComponentTypes`**  
   - 现状：`"health"` / `"inventory"` / `"rideable"` / `"minecraft:variant"` 混用前缀（`Health.ts`、`Backpack.ts`、`MaidInteractEvents.ts`、`ScarletToolKit.js` 等）。  
   - 建议：女仆热路径先改（health / inventory / tameable / rideable / equippable），减少静默 `undefined`。

5. **关键路径补 `entity.isValid`**  
   - 已有：部分生命周期 / 交互。  
   - 缺失风险：`Pick` 磁力、`MaidScheduleEvents` 定时回血、拥抱相关 `getComponent(...)!`。无效实体上强制解包易炸脚本。

6. **`setDynamicProperties(..., undefined)`**  
   - 项目已有 `DynamicPropertyInterface` 与批量读写；升级后可用 `undefined` 批量清除，简化迁移/重置女仆状态。

### 9.4 P2 — 用新事件削弱轮询与 data-driven 负担

7. **驯服：`entityTamed`（before/after）**  
   - 现状：`thlmm:f` → `onTamed`，`Level.ts` / 交互里再查 `minecraft:is_tamed`。  
   - 建议：after 统一设 Owner / 初始化；before 可做校验或取消。减少组件轮询。

8. **弹幕伤害 ↔ `entityHurt` before**  
   - 现状：`DanmakuDamageDispatcher.ts` 自管无敌与延迟伤害。  
   - 建议：评估 before-hurt 是否能简化取消/改伤；至少用过滤后的 after-hurt 做统计，避免全局无过滤订阅。

9. **回血：`entityHeal` 或保留脚本回血但可观测**  
   - 现状：`MaidScheduleEvents.onTimer` 直接 `Health.setCurrentValue`，且有空 `catch`。  
   - 建议：保留定时策略亦可，但补日志/校验；若有其他治疗来源，用 heal 事件对齐行为。

10. **磁力拾取：评估 `entityItemPickup`**  
    - 现状：`Pick.ts` 周期性 `getEntities({ type: item })` + `container.addItem`。  
    - 建议：在自定义拾取规则下优先事件驱动；保留扫描作兜底。

11. **潜行 / 背包检查模式**  
    - 现状：依赖 JSON sit/sneak + `nameTag` + DP（`Backpack.checkMode` / inventoryMode）。  
    - 建议：结合 `entityStart/StopSneaking` 与 `entityContainerOpened/Closed`，降低 nameTag 副作用。

12. **削减 `ScheduleEvents` 固定间隔**  
    - 现状：每 15/20/80 tick 扫主手 HUD、P 点、创造破坏等（`ScheduleEvents.ts`）。  
    - 建议：能换成 `itemUse` / 方块事件 / 脚本事件的尽量换；必须 tick 的合并为单一调度器并按活跃对象降频。

### 9.5 P3 — 体验向（可选）

13. **`Entity.getAABB()`**  
    拥抱交互体、农场目标、弹幕瞄准目前多用固定偏移 / `getHeadLocation`；AABB 可提升命中与交互稳定性。

14. **`EntityWaypoint` / `Player.locatorBar`**  
    回家 / 跟随主人可用 Locator 航点做 UI 指引，与回家调度逻辑解耦（纯展示）。

15. **方块容器 / 自定义方块组件事件**  
    祭坛、骨架、底座等若继续走 custom component（`WorlldEvents.ts` startup 注册），可跟进 `BlockComponent*` 新事件与 `BlockDynamicPropertiesComponent`。

16. **`Player.persistentId` / `chatDisplayName`**  
    Owner 绑定若仍用 name/uuid 混用，可评估更稳的持久 ID（需确认存档语义后再用）。

### 9.6 不建议优先投入

- **战利品 Loot Condition/Function 全家桶**：与当前女仆掉落/背包设计耦合弱。  
- **AimAssist 拆分 API**：项目未使用。  
- **全面重写 Dimension/command 层**：`runCommand`（title/give/setblock/playanimation）可逐步 native API 化，但应排在事件与库存稳定性之后。

### 9.7 建议落地顺序（可执行）

```text
1. 修 Backpack.removeItem* 扣减
2. 升 @minecraft/server → 2.11.x-beta（并对齐 server-ui / 游戏版本）
3. tsc + 修签名破坏点（hurt options / playSound / Dimension.getBlocks 等）
4. Backpack/Pick → Entity.addItem；Health/Inventory 等改 EntityComponentTypes
5. 订阅 entityTamed / entityHurt before（弹幕）/ 评估 itemPickup
6. 收敛 ScheduleEvents 轮询；可选 Waypoint 回家指引
```

### 9.8 与现有文档关系

- Entity 细项：[minecraft-server-Entity-API变更.md](./minecraft-server-Entity-API变更.md)
- 本文亦复制到 `接口升级评估/` 目录便于集中查阅。

---

生成说明：自动对比 `2.3.0-beta.1.21.111-stable` → `2.11.0-beta.1.26.51-stable` 的全部 export 与核心/共性类型成员；第 9 节结合本仓库 `typescripts/src` 用法整理。
