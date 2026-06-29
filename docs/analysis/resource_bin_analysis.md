# San11 WPK 资源导出与覆盖率分析

`san11resource.resource.export_resources` 从本地复制的游戏目录导出资源：

```bash
uv run python -m san11resource.resource.export_resources
```

默认输入：

```text
../game/San11WPK/media
```

默认输出：

```text
../extracted/resources/output
```

当前支持：

- `LINK` 容器：`san11pkres.bin`、`san11res1.bin`
- `WFTX0010` 图片：24-bit BGR 和 32-bit BGRA 转 PNG
- 以有效 `BM` 文件头开始的 BMP entry
- RIFF entry，按原始 `.riff` 文件写出

未知 LINK entry 会记录在 `link_entries.csv/json` 中，默认不写出原始载荷。如需保留逐字节未知数据：

```bash
uv run python -m san11resource.resource.export_resources --dump-raw
```

快速测试：

```bash
uv run python -m san11resource.resource.export_resources ../game/San11WPK/media/san11res1.bin --limit 20 -o ../extracted/resources/sample
```

输出清单：

- `link_entries.csv/json`
- `wftx_images.csv/json`
- 每个容器目录下的 `link_header.json`

## LINK 布局

已观察到的 LINK 容器布局：

```text
0x00  char[4]  "LINK"
0x04  uint32   entry 数量
0x08  uint32   未知，目前观察值为 1
0x0c  uint32   未知，目前观察值为 0
0x10  entry 表，每项为 uint32 offset + uint32 size
```

当前从 `game/San11WPK/media` 完整导出的结果：

```text
LINK entries recorded: 6458
  link: 1
  raw: 5214
  wftx: 1243

WFTX images exported: 4140
```

## 覆盖率分析

运行：

```bash
uv run python -m san11resource.resource.analyze_coverage -o ../extracted/resources/coverage
```

覆盖率分两层：

- 容器覆盖率：LINK 表是否解释了整个文件的每一个字节，用于判断 `.bin` 是否已正确拆成 entry。
- 语义覆盖率：每个 entry 根据前 8 字节签名归类为 `parsed`、`recognized` 或 `raw`。

当前签名状态：

- `parsed`：已有结构化导出器或 parser 的格式，包括 `WFTX0010`、`WKMD0010`、`AIMG0001`、`SHEX0008`、`GCOL0001`、`K3ST0006`、`OBJS0004`、通用 data-buffer/descriptor pair，以及 `FCVD0022`、`KSEF0131`、`TOD20053`、`NUNO0220`。
- `recognized`：已经识别并跟踪，但载荷还没完全解码；目前主要是可变的 `KOVS*` 家族。
- `raw`：目前还没有分类 signature 的 entry。

当前字节覆盖率：

```text
san11pkres.bin
  container coverage: 100.000000%
  parsed:             89.902%
  recognized:         10.021%
  raw:                 0.077%

san11res1.bin
  container coverage: 100.000000%
  parsed:             87.758%
  recognized:         12.241%
  raw:                 0.000%
```

## 解释

- 两个 `.bin` 的 LINK 容器拆分已经完整：表区和 payload 区合计等于文件大小。
- WFTX 占据主要字节量，且 WFTX/WKMD/AIMG 已有可复现导出器，所以主要视觉资源已经覆盖较多。
- `san11pkres.bin` 中的地图资源簇已经有结构化分析：`SHEX0008`、`GCOL0001`、`K3ST0006`、`OBJS0004`。
- 一些无 ASCII signature 的 raw entry 现在可按通用 data-buffer/descriptor pair 解释。判断方式不是硬编码 entry 编号，而是要求小 descriptor entry 声明前一个 data entry 的精确大小，并包含内部 offset/byte count 有效的 40 字节 stream 记录。
- 剩余高价值候选包括地图/地形、碰撞、特效、对象元数据等，其中 `KOVS*` 仍是最大的 recognized 家族。
- `FCVD0022`、`KSEF0131`、`TOD20053`、`NUNO0220` 已由 `san11resource.recognized.analyze_recognized` 做结构化验证。字段语义尚未完全命名，但所有已观察 block 都满足可复现的固定记录大小规则。
- `KOVS*` 用 4 字节前缀识别，因为 `4..7` 字节随 entry 变化。当前共同头部为：`KOVS`、小端载荷大小等于 `entry_size - 32`、24 字节大多为 0 的 header，然后 body 从 offset `0x20` 开始。body 尚未解码，因此仍是 `recognized`，不是 `parsed`。
- `san11res1.bin` 剩余 raw 的 500 字节不是单个大未知块，而是文件末尾 20 个 LINK entry：`1562..1581`，每个 25 字节，位于 `0x07ad1555..0x07ad1749`，正好到 EOF。所有字节都是 `0` 或 `1`，当前暂存假设是 `5x5` boolean mask/table。`san11pkres.bin` 地图簇附近 `4780..4786` 也有类似 25 字节 `0/1` entry。这个假设留待后续验证，目前仍计为 `raw`。

## 分析方法

1. 先验证 LINK 表。如果 `table_bytes + payload_bytes` 等于文件大小，容器拆分可信，后续可以按 entry 分析。
2. 按前 8 字节 signature 分组，并按总字节数排序，优先处理高价值未知格式。
3. 用精确大小关系验证候选结构，例如：
   - `SHEX0008`：`8 + 40000 * 11`
   - `GCOL0001`：`8 + 1025 * 1025 * 3`
   - `K3ST0006`：`12 + 2049 * 2049 * 4`
   - `OBJS0004`：`8 + 65535 * 14`
4. 对无 signature 的数据，用跨 entry 的 size 和 stream bounds 验证 descriptor/data pair。
5. 字段命名前先导出中性预览：灰度通道图、RGB 组合图、坐标散点图。
6. 与运行时内存资料交叉验证维度。`SHEX0008` 的 `200 * 200` 格子数与 `struct_map_grid_ARRAY` 记录吻合。
7. 只有当脚本能稳定复现结构并写出清单/预览时，才把 signature 从 `recognized` 移到 `parsed`。

## 备注

- `.fce` 人脸图片是直接的 24-bit BGR WFTX 块。
- `.bin` 资源是 LINK 容器，很多 entry 是直接 WFTX。
- 有些 WFTX entry 打包了多层贴图。例如 `san11pkres.bin` entry `2195` 是 8 层 `256x512x32` 贴图 payload。
- `.wft` 文件包含 WFTX header 和额外 payload。当前 exporter 导出 header 描述的第一张贴图，并在 `wftx_images.csv` 记录额外 payload 说明。
- raw payload 内出现的 `BM` 字节经常只是像素数据，不一定是真 BMP。只有整个 entry 自身拥有有效 BMP header 时才导出 BMP。
