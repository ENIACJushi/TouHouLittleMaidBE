
### 批量方块获取 使用指南

起猛了，基岩版出方块批量获取了，函数在维度里：

```
getBlocks(volume: BlockVolumeBase, filter: BlockFilter, 
          allowUnloadedChunks?: boolean): ListBlockVolume;
```

#### 参数1 - volume

这个参数用于指定待查方块的位置，有以下几个类型：

##### > 列表类型 ListBlockVolume

记录多个方块的坐标。
构造方法：传入一个三维向量：

```
var list = new ListBlockVolume({x:1, y:1, z:1});
```

后续使用 `add()` 和 `remove()` 增加和移除位置：

```
list.add({x:1, y:2, z:1});
list.remove({x:1, y:2, z:1});
```

##### > 选区类型 BlockVolume

选中一个长方体。

**构造方法**

```
var area = new BlockVolume({x:-1, y:-1, z:-1}, {x:1, y:1, z:1});
```

在这之后，可以用 `area.from` 和 `area.to` 查看对角两点的位置。

**doesLocationTouchFaces(pos: Vector3): boolean**
传入一个位置：
- 如果位置在选区内部（不包含边界），则返回 `false` 。
- 如果位置直接与选区的外表面接触，则返回 `true` 。

**doesVolumeTouchFaces(other: BlockVolume): boolean;**

检查两个块体是否直接相邻，两个面是否接触。

传入一个选区，如果和当前选区的外表面接触，并且在任何点直接相邻，则返回 `true` 。

**intersects(other: BlockVolume): BlockVolumeIntersection;**

传入一个 `选区B`，将它和当前 `选区A` 取交集并返回一个枚举类型。

可能的取值如下：

- `BlockVolumeIntersection.Disjoint` - `选区B` 与 `选区A` 没有交点
- `BlockVolumeIntersection.Contains` - `选区B` 完全位于 `选区A` 内部
- `BlockVolumeIntersection.Intersects` -  `选区B` 与 `选区A` 部分相交

**注意**

请注意，这些值与 `min` 和 `max` 值不同，因为矢量分量不能保证按任何顺序排列。

此外，这些向量位置不能与 `BlockLocation`（方块位置） 互换。

如果您希望将此卷表示为 `BlockLocations` 的范围，您可以使用 `getBoundingBox()` 函数。

这个卷类将维持角索引的初始设置顺序。想象一下，每个角都在编辑器中被分配——当您移动角时(可能颠倒边界的最小/最大关系)，您最初选择的上/左角传统上将成为下/右角。当手动编辑这些类型的卷时，您需要在编辑时保持角的身份：`BlockVolume` 函数可以做到这一点。

重要的是，这测量块大小(to/from) —— 一个正常的AABB(0,0,0)到(0,0,0)传统上的大小是(0,0,0)然而，因为我们测量的是块，一个BlockVolume的大小或跨度实际上是(1,1,1)


##### 公用函数



#### 参数2 - filter


#### 参数3 - allowUnloadedChunks



#### 返回值 - ListBlockVolume

