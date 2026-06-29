# 地图资源试验性导出

这个目录的脚本用于分析 `san11pkres.bin` 中地图相关的资源簇。

导出全部 `SHEX0008` 块：

```bash
uv run python -m san11resource.map.export_shex -o ../extracted/maps/output
```

分析更大的地图候选资源：

```bash
uv run python -m san11resource.map.analyze_map_candidates -o ../extracted/maps/candidates
```

## 已确认的逻辑格子：SHEX0008

`SHEX0008` 是目前第一个确认度较高的 `.bin` 地图格子资源格式。

判断依据：

- 运行时资料 `SireCustomizedPackageDev/material/结构体汇总.md` 记录内存地图格子为 `200 * 200` 个 cell，每个运行时 cell 为 `0x14` 字节。
- `SHEX0008` entry 大小精确等于 `8 + 40000 * 11`：
  - 8 字节 magic：`SHEX0008`
  - 40000 条记录
  - 每条记录 11 字节
- 字段预览图能显示完整的地图形状，包括陆地/水域轮廓。

已观察 entry：

```text
san11pkres.bin entry 4791: 440008 bytes
san11pkres.bin entry 4863: 440008 bytes
san11res1.bin  entry 3:    440008 bytes
```

`san11pkres.bin` entry `4791` 与 `san11res1.bin` entry `3` 逐字节相同。`san11pkres.bin` entry `4863` 分布相同，只在 `b01` 字段的 41 个 cell 上有差异，并集中在一个小区域。

输出内容：

- `entry_*/cells.csv`：每个 `x,y` cell 一行，包含 `row_parity`、`staggered_x` 和 `b00..b10`
- `entry_*/field_XX.png`：每个字节字段一张灰度图
- `entry_*/preview_b00_b01_b04.png`：用三个疑似重要字段组合的 RGB 预览
- `entry_*/preview_b00_b04_b09.png`：另一组三字段 RGB 预览
- `entry_*/preview_staggered_b00_b01_b04.png`：按半格错位投影的预览
- `shex_blocks.csv/json`：block 清单
- `shex_fields.csv/json`：字段统计

entry `4791` 的字段观察：

```text
b00: 0..19，20 个不同值。可能是 terrain/type class。
b01: 0..92，91 个不同值。可能是高度、区域或视觉地图 index。
b02: 总是 0。
b03: 0..2，几乎总是 0。
b04: 0..6，大多为 6。可能是大类 movement/surface class。
b05-b08: 稀疏 0/1 flag。
b09: 0..15，16 个不同值。可能是方向、变体或区域 nibble。
b10: 稀疏 0/1 flag。
```

字段语义仍需和运行时 `struct_map_grid`、移动/地形函数继续关联，但尺寸和视觉预览已经使 `SHEX0008` 成为强地图格子候选。

## 已知游戏地图拓扑

游戏侧信息提供了一个重要约束：San11 使用一整块大战术地图，而不是分散小地图。逻辑地形网格是 `200 x 200` 个正方形 cell，和 `SHEX0008` 的记录数吻合。美术上则是一张连续的水墨风大地图。

虽然逻辑 cell 是正方形，但行与行之间有半格错位，因此邻接行为接近六边形网格。简化坐标示意：

```text
row 0: 1   2   3   4
row 1:   1.5 2.5 3.5 4.5
row 2: 1   2   3   4
```

在这个模型中，row 1 的 `2.5` cell 与上方的 `2`、`3`，下方的 `2`、`3`，以及同一行的左右邻居相邻。导出器因此同时记录整数格子坐标和显示坐标：

```text
row_parity = y & 1
staggered_x = x + 0.5 * row_parity
```

这对后续关联很重要：原始 `200 x 200` 字段图适合字节级检查，但移动、寻路、地形边缘过渡和对象摆放应使用半格错位坐标系统检查。

## 更大的地图资源簇

`san11pkres.bin` 的 `4787..4805` 附近形成了连续的地图资源簇：

```text
4787-4790  GCOL0001  4 blocks, each 8 + 1025*1025*3 bytes
4791       SHEX0008  8 + 40000*11 bytes
4793       K3ST0006  8 + 1025*1025*8 + 1024*1024*8 bytes
4794-4804  WFTX/DIST/SENV terrain-related texture/environment blocks
4805       OBJS0004  8 + 65535*14 bytes
```

已观察结构：

- `GCOL0001`：8 字节 magic 后的 payload 精确等于 `1025 * 1025 * 3`。直接按 RGB 解释会得到完整的 `1025 x 1025` 世界地图地形预览。导出器也会写出独立的 `r/g/b` 通道图。外部 San11 全地图预览 `https://xgodgame.blogspot.com/2018/05/11.html` 与 `GCOL0001` 预览在 `x/y` 转置后最匹配，所以导出器保留 raw 图，同时写出 `_map_*` 转置图用于地图方向查看。
- `K3ST0006`：IDB 中 `default.stg` loader 会把它交给 `sub_418fb0` 解析。结构不是旧假设的 `u32 + 2049*2049*4 RGBA`，而是：

```text
8 bytes             magic/version: K3ST0006
1025*1025*8 bytes  control records
1024*1024*8 bytes  auxiliary qword bitfield plane
```

  导出器现在输出 `control_b00..b07`、按 IDB 普通地面采样 offset 复原的 `idb_ground_height_byte`、`aux_qword_b00..b07`，以及按 `0x415e20/0x415d80` 复原的 `derived_b00..b09`。需要注意：`idb_ground_height_byte` 只对应普通地面分支；水/河等特殊地形会改读派生表，见下文。
- `OBJS0004`：8 字节 magic 后的 payload 精确等于 `65535 * 14`。非零记录只有 1195 条。当前最佳字段拆分：

```text
byte 0      flag，active record 中总是 1
byte 1      group/category 候选
byte 2      未知，active record 中目前为 0
byte 3..4   little-endian x 坐标，观察范围 57..439
byte 5..6   little-endian y 坐标，观察范围 58..460
byte 7      object type/variant 候选
byte 8..11  little-endian float rotation，观察值为 0, pi/2, pi, 3*pi/2
byte 12..13 未知，active record 中目前为 0
```

`OBJS0004` 按 group/type 画出的散点图形成地图形状，因此很可能是地图对象摆放表。group/type 名称还需要和 exe 字符串继续关联，例如 `shadow*_castle`、`stable`、`blacksmith`、树木和设施名等。

## 3D 世界地图约束

游戏实际渲染中的世界地图是 3D 场景：西北方向有明显高山，东南方向有大片海面。这使地图资源不能只按 2D 预览图理解。当前更合理的模型是：

- `SHEX0008` 提供 `200 x 200` 逻辑格子、地形/移动分类和若干低分辨率索引字段；
- `K3ST0006` 是 `default.stg` 的强候选，承载 3D stage 地形控制数据。`control_b00` 在视觉上更像水低、山高的地形代理层；IDB 普通地面高度采样则读 `this+0x800000 + index*10`，对应展开后前一条 control record 的 `b02`。这两者不能混为一谈；
- K3ST 后半 8MB 在 IDB 中按 `1024x1024` 个 qword bitfield 使用，而不是按 `2048x2048` u16 高度图使用。`0x415e20` 从每个 `4x4` qword block 中提取派生表，`derived_b07` 是水/河高度分支读取的 byte，`derived_b08` 是 `0x415d80` 对四角 `control_b00` 与该高度比较得到的 4-bit mask；
- `aux_qword_b05` 视觉上非常像水域 mask：水/河/海区域值高，其他区域接近 0。按 `0x415e20` 的 qword bit extraction，它不是独立二值 mask，而是 qword bitfield 的一部分；`derived_b07 = (qword >> 44) & 0xff` 会使用到 `b05` 的高 nibble 和 `b06` 的低 nibble。因此它应命名为水域相关 bitfield byte，而不是最终水面 mask；
- `GCOL0001` 更像季节/颜色预览或颜色层，不适合作为权威 grid 数据；
- `default.stg` 附近的 data-buffer/descriptor pair 目前只暴露 `2`/`4` 字节 stream，形态更像分批索引、短属性或渲染辅助流，而不是 `default.stg` 本体。`default.stg` 现在应优先绑定到 `K3ST0006`。

游戏截图约束补充：

- 曹操教程场景截图中，底部状态栏显示当前格为 `地形：河（濮陽）`、`坐标：125,65`。
- 真实画面里 `125,65` 附近是黄河/港口/河谷区域，水面是连续低洼面，山体主要表现为局部坡面、山脊和地表贴图变化；白色雾/水汽沿河谷和低地区域出现，不是全图均匀云层。
- `SHEX0008` 在 `(125,65)` 的字段为 `b00=0,b01=30,b04=6,b09=14`，相邻河/陆过渡格会在 `b00` 和 `b01` 上变化，例如 `(120,65)` 为 `b00=15,b01=29`、`(130,65)` 为 `b00=5,b01=30`。这说明低分辨率逻辑格子能直接标出“河”及其相邻过渡。
- 按 IDB 的 `0x417770` 坐标换算，逻辑格 `(125,65)` 映射到 K3ST control 坐标约 `(614,376)`。该点附近 `control_b00=0`，符合河/水低洼的视觉直觉；普通地面路径读到的 `idb_ground_height_byte=136`，但截图显示该格为“河”，而 IDB 在 `0x417770` 对 runtime 地形类型 `6..8` 有特殊分支：不取普通高度 byte，而是取另一个派生表的 byte+7，再乘 `0.5`。因此河/水高度不能用普通地面高度图直接判断。

当前结论：K3ST 不再只是“通道诊断图”，而是 `default.stg` 的核心 stage 数据。`control_b00` 更适合作为当前 viewer 的视觉高度代理；`idb_ground_height_byte` 是普通地面分支的 IDB 诊断层；`derived_b07` 是水/河分支高度来源。剩余问题是 control record 其他 byte 的语义、qword bitfield 的完整 bit layout，以及 terrain mesh 分块/材质生成过程。

新的 IDB loader 约束：

- `media/stage/default.hex` 在 `sub_5a1fe0` 中加载后，紧接着调用 `struct_map_grid_ARRAY` 相关函数 `0x484350`；另一个 `default.hex` 使用点 `sub_4a4f30` 也把资源送入 `0x6fb0e68 struct_map_grid_ARRAY`。这强化了 `default.hex/SHEX0008` 是逻辑格子层的判断。
- `media/stage/default.stg` 在同一个 `sub_5a1fe0` 中加载，随后进入 `0x3260860` 的 `sub_41af90`。该函数会按 payload 类型分发：`K3ST` 进入 `sub_418fb0`，`GCOL` 进入 `sub_4191f0`，`OBJS` 进入 `sub_419280`。
- `sub_418fb0` 对 `K3ST0006` 的读取大小与 `san11pkres.bin` entry `4793` 完全吻合：`8 + 1025*1025*8 + 1024*1024*8 = 16793616` 字节。因此 `media/stage/default.stg -> entry 4793 K3ST0006` 现在是高置信绑定。
- `0x4176b0/0x417770` 是地形顶点坐标采样线索：X/Z 坐标乘 `5.0`，普通地面高度 byte 乘 `0.5`。普通分支读的是 K3ST expanded runtime 区的 shifted `b02`，不是 `control_b00`。当 runtime map grid 的地形低 5 bit 在 `6..8` 时，函数改读派生表 byte+7，也就是导出器的 `derived_b07`，并先加 `0.0025` 再乘 `0.5`。

exe 字符串中存在 `ShowGroundWireframe`、`ShowGroundPolygon`、`ShowWater`、`ShowDistantView`、`ViewHeight`、`WaterAnimTime`、`WaterRepetition` 等 stage/debug 配置名，进一步说明世界地图渲染层包含 ground polygon、水面和 distant view。后续需要用 IDA xref 确认这些配置读写的具体渲染函数，再反推 `default.stg`、`K3ST0006` 和 ground/water 贴图的绑定关系。

IDA 线索补充：

- `san11pk_dump.exe.idb` 中可提取 82 个 `shadowNN_*` 字符串，覆盖城、关、港、市场、农场、锻造、马厩、树木等对象影子名。
- `OBJS0004` active record 的 `object_type` 有 178 个不同值，其中 74 个能按 `object_type == shadowNN` 匹配到 shadow 名称候选。
- 候选映射见 `extractor/ida/data/resource_hints/objs_shadow_candidates.csv`。这仍需用散点图验证，暂不能直接把 `byte 7` 定名为 `shadow_id`。
- 运行时 `struc_map_grid` 是 5 个 4-byte 字段，总大小 20 bytes；`SHEX0008` 是每格 11 bytes，因此不是运行时格子的直接 dump。
- `struct_map_grid_ARRAY`、`GetFacilityIDFromMapGridData`、`GetFacilityPtrFromCoordinate`、`GetAdjacentCoordinateInDirection` 等 IDA 符号已整理到 `extractor/ida/data/resource_hints/map_grid_related_symbols.csv`。
- 详细结论见 `docs/analysis/ida_resource_hints.md` 和 `extractor/ida/data/resource_hints/map_grid_shex_notes.md`。

`analyze_map_candidates.py` 输出：

- `map_candidates.csv/json`：每个 block 的 signature、offset、size、hash、entropy、检测结构和生成输出
- `objs_active_records.csv/json`：全部 active `OBJS0004` 记录
- `buffer_descriptors.csv/json`：声明前一个 data entry 精确大小的小 descriptor entry
- `buffer_streams.csv/json`：descriptor 中的 40 字节 stream 记录
- `entry_*_GCOL0001/*_rgb.png`、`*_map_rgb.png` 和通道图
- `entry_*_K3ST0006/*_control_b*.png`、`*_aux_qword_b*.png`、`*_derived_b*.png`
- `entry_*_OBJS0004/*_by_group.png`、`*_by_object_type.png` 散点图

## Data-buffer descriptor pair

一些没有 ASCII 签名的 entry 仍可结构化解析。它们通常表现为一个大 data entry 后接一个小 descriptor entry：

```text
san11pkres.bin 4864 data, 4865 descriptor
san11pkres.bin 4866 data, 4867 descriptor
san11pkres.bin 4868 data, 4869 descriptor
```

同样模式也出现在文件更早的位置和 `san11res1.bin` 中，所以它可能是通用 renderer buffer 格式，而不是地图专用 signature。当前检测条件：

- descriptor 小于 4096 字节，并且按 u32 对齐
- descriptor 的 `u32[1]` 精确等于前一个 entry 的大小
- offset 表指向 40 字节 stream record
- 每个 stream record 的 `count`、`data_offset`、`byte_size` 内部有效，通常有 `byte_size = count * 2` 或 `count * 4`
- 每个 stream 范围都落在前一个 data entry 内

这些地图附近 descriptor 很重要，因为它们解释了第二个 `SHEX0008` 之后很多过去计为 raw 的数据。字段名仍需和渲染代码继续关联，但 pair 结构和 stream 字节范围已经可复现。

## 分析流程

地图分析使用和顶层资源覆盖率分析相同的基本方法：

1. 从 LINK 表开始逐 entry 分析，避免在像素数据中误扫 signature。
2. 按相邻 entry 和 8 字节 signature 聚类。地图 signature 在资源顺序和 exe 字符串中都集中出现。
3. 先用精确大小关系验证，再赋予含义。例如 `1025*1025*3`、`1025*1025*8 + 1024*1024*8`、`40000*11`、`65535*14`。
4. 对无 signature 的 descriptor/data pair，用跨 entry size 和 stream bounds 验证，再计入 parsed。
5. 先导出视觉证据。全图预览和坐标散点图比仅凭几个字节命名字段更可靠。
6. 有外部截图或地图时做对照。XGodGame 的 San11 地图缩略图确认了 `GCOL0001` 的正确地图方向是 raw 字节序图的 `x/y` 转置。
7. 字段名在与运行时结构、exe 引用或已知游戏对象关联之前，保持临时状态。
