# IDA 资源解析线索

本文记录 `san11pk_dump.exe.idb` 对资源解码的辅助信息。IDB 本体只作为本地输入保存，已从 git 排除；可提交的是 `python-idb` 导出的轻量 CSV 以及从这些 CSV 生成的 resource hints。

运行：

```bash
cd extractor
uv sync --group ida
uv run python -m san11resource.ida.export_python_idb
uv run python -m san11resource.ida.build_resource_hints
```

主要输出：

```text
extractor/ida/data/python_idb/
extractor/ida/data/resource_hints/
```

当前 `resource_hints` 摘要：

```text
shadow_names: 82
objs_object_types: 178
objs_object_types_with_shadow_candidate: 74
map_grid_runtime_members: 5
map_grid_related_symbols: 134
person_catalog_fields: 67
skill_catalog_fields: 6
```

## 对剩余格式的直接帮助

IDA 导出的函数名、命名地址和结构体中，当前没有直接命中这些资源 magic：

```text
KOVS
FCVD0022
KSEF0131
TOD20053
SHEX0008
GCOL0001
K3ST0006
OBJS0004
AIMG0001
```

直接扫描 IDB 字符串时，`NUNO0220` 和 `CDEF0120` 有命中，但上下文更像资源字符串或标签，还不足以解释字段布局。`WFTX0010`、`WKMD0010` 也有命中，但这两个格式已经有可复现 parser。

因此，IDA 当前不能直接解决 `KOVS` body、`FCVD0022`、`KSEF0131`、`TOD20053` 的字段语义。要继续追这些格式，下一步需要导出字符串引用、函数 xref、反汇编或伪代码上下文，而不仅是函数名和结构体表。

## OBJS0004 与 shadow 名称

`OBJS0004` active record 中的 `object_type` 有 178 个不同值。IDB 中能提取到 82 个 `shadowNN_*` 字符串，例如：

```text
shadow00_castle_KAHOKU
shadow06_gate
shadow07_port
shadow08_base
shadow23_market
shadow24_farm
shadow25_barrack
shadow26_blacksmith
shadow32_stable
shadow45_tree00 .. shadow60_tree15
```

`build_resource_hints` 按 `object_type == shadowNN` 生成候选映射。当前 178 个 `object_type` 中有 74 个能按编号匹配到 shadow 名称。输出见：

```text
extractor/ida/data/resource_hints/shadow_names.csv
extractor/ida/data/resource_hints/objs_shadow_candidates.csv
```

这个映射目前仍是候选，不能直接改字段名为 `shadow_id`。需要用 `OBJS0004` 的坐标散点图验证：城、关、港、市场、农场、锻造、马厩、树木等候选是否落在合理地理位置。

## SHEX0008 与运行时 map grid

IDA 中存在运行时地图格子相关符号：

```text
0x6fb0e68  struct_map_grid_ARRAY
0x483a50   GetAdjacentCoordinateInDirection
0x483b00   GetFacilityIDFromMapGridData
0x483b20   GetFacilityPtrFromCoordinate
0x483c80   GetAllAccessibleCoordinatesInRange
0x483db0   AreCoordinatesAdjacent
```

运行时结构 `struc_map_grid` 有 5 个 4-byte 字段，总大小 20 bytes：

```text
0x00 field_0
0x04 field_4
0x08 field_8
0x0c field_C
0x10 field_10
```

`SHEX0008` 的磁盘结构是 `200 * 200` 条记录，每条 11 bytes，所以它不是运行时 `struc_map_grid` 的直接 dump。当前推断：

- `SHEX0008` 仍是地图格子源数据或运行时格子的压缩/预处理输入之一。
- IDB 注释显示运行时坐标打包使用 low 16 bits = x、high 16 bits = y。
- `struct_map_grid_ARRAY` 以 200x200 cell 和 5 DWORD/cell 访问。
- IDB 注释提到从某个 runtime grid DWORD 右移 5 位再 `& 0x7f` 可得到 city/facility 相关 ID；需要进 IDA/反编译器确认对应 `field_0` 还是 `field_4`。
- `SHEX b00`、`b04` 仍是 terrain/movement class 候选；`b01` 仍是 region/height/index 候选。

输出见：

```text
extractor/ida/data/resource_hints/map_grid_shex_notes.md
extractor/ida/data/resource_hints/map_grid_runtime_members.csv
extractor/ida/data/resource_hints/map_grid_related_symbols.csv
```

## person / skill catalog

IDA 中 `struct_person` 和 `struct_skill` 对资源浏览器和 manifest 语义层很有用。已导出的稳定字段包括：

```text
struct_person.fld_3C_PortraitID
struct_person.fld_E8_SpecialSkill
struct_person.fld_114_3DModel
struct_skill.fld_4_SkillName
struct_skill.fld_1C_SkillDescription
struct_skill.fld_60_SkillLevel
struct_skill.fld_64_SkillType
```

输出见：

```text
extractor/ida/data/resource_hints/person_struct_catalog.csv
extractor/ida/data/resource_hints/skill_struct_catalog.csv
```

这些 catalog 不直接解析 `.bin` 资源格式，但能把头像、模型、特技等资源 ID 与运行时语义关联起来，后续适合给 viewer 或 manifest enrichment 使用。

## 后续优先级

1. 用 `objs_shadow_candidates.csv` 给 `OBJS0004` 生成带名称的散点图，验证 `object_type == shadowNN` 是否成立。
2. 针对 `GetFacilityIDFromMapGridData` 导出反编译或指令片段，确认 `struc_map_grid` 的 bitfield，再反推 `SHEX0008` 字段语义。
3. 为 `struct_person` / `struct_skill` 生成 viewer 可读的 schema 或 manifest enrichment。
4. 若继续追 `KOVS`、`FCVD0022`、`KSEF0131`、`TOD20053`，需要从 IDA 导出 xref/decompiler 上下文，而不是只看名称表。
