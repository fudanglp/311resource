# WKMD 模型试验性导出

`WKMD0010` entry 看起来是 San11 WPK 的 3D 模型块。`san11resource.model.export_wkmd` 会从 LINK 容器中提取这些块，并写出试验性的 OBJ 预览。

导出单个模型：

```bash
uv run python -m san11resource.model.export_wkmd --entry 2207 -o ../extracted/models/sample
```

如果贴图是前一个 WFTX entry，可以直接导出带材质的样例：

```bash
uv run python -m san11resource.model.export_wkmd --entry 2215 -o ../extracted/models/textured_sample
```

也可以强制指定某个 WFTX entry 作为贴图：

```bash
uv run python -m san11resource.model.export_wkmd --entry 2215 --texture-entry 2214 -o ../extracted/models/textured_sample
```

导出 `san11pkres.bin` 中的全部 WKMD：

```bash
uv run python -m san11resource.model.export_wkmd
```

输出内容：

- `*.wkmd`：原始模型块
- `*.obj`：用解析出的顶点、UV、法线和三角形带索引写出的预览网格
- `*.mtl`：绑定候选贴图时生成的材质文件
- `textures/*.png`：绑定候选贴图时导出的 WFTX 贴图
- `*.json`：每个 entry 的解析元数据
- `wkmd_models.csv/json`：模型清单

当前状态：

- header magic、声明大小、包围盒、顶点表、索引带已部分定位。
- 常见 WKMD entry 的 OBJ 几何预览可用；常见顶点 stride `0x20` 和 `0x2c` 会写出 UV/法线。
- header 中的 count/offset 表已部分解码：
  - `0x30/0x34`：table0 count/offset，通常是 68 字节记录，可能是矩阵或绑定姿态数据。
  - `0x38/0x3c`：table1 count/offset，存在时是 40 字节记录。第一个 u32 像是打包的 `parent_index/node_index`，后面是缩放、旋转、平移三组三维 float。
  - `0x48`：part/submesh 数量。偏移从 `0xa0` 开始；观察到的 part 记录为 44 字节，并引用 table0 index。
- OBJ 导出在 part 记录验证通过时写出 `g part_XX` 分组。part 记录暴露出疑似 `vertex_start`、`vertex_count`、`index_start`、`index_count` 字段。
- 对于 stride `0x2c` 的顶点，float 3-5 表现为三个蒙皮权重；第四个权重可能是 `1 - (w0 + w1 + w2)`。这些权重和每个 part 的骨骼 index 列表对应。
- 贴图绑定目前使用简单启发式：如果紧邻的前一个 LINK entry 是 `WFTX0010`，则导出 PNG 贴图并写 OBJ/MTL 绑定。可以用 `--no-auto-texture` 关闭，或用 `--texture-entry` 强制指定。
- 完整材质表和动画尚未完全定位。

当前完整导出结果：

```text
san11pkres.bin: 653 个 WKMD entry，当前 parser 可导出 650 个
san11res1.bin:  54 个 WKMD entry，当前 parser 可导出 54 个
auto-texture binding: 55 个 pkres 模型，7 个 res1 模型
validated part groups: 478 个 pkres 模型，54 个 res1 模型
skin-weight summaries: 37 个 pkres 模型
```

有用样例：

```text
entry 2207       -> T-pose 人物模型
entry 2215/2217  -> 同一资源区域内的骑乘/马上模型候选
```

`entry 2215` 的表摘要示例：

```text
table0: count=51 offset=0x280 inferred_record_size=68
table1: count=27 offset=0x1010 inferred_record_size=40
parts:  count=9  offset=0xa0 inferred_record_size=44
validated part records: 10, because part_flags=1 contributes one extra record
stride 0x2c skin weights: sum_min=0.0 sum_max=1.0 near_one_ratio=0.882
```

马匹贴图附近的资源模式：

```text
2189-2194  WFTX0010  256x512x32 textures
2195       WFTX0010  8-layer 256x512x32 texture payload
2196-2205  AIMG0001  likely animation/image metadata
2206       WFTX0010  128x256x24 texture
2207       WKMD0010  model
```
