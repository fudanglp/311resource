# AIMG 试验性导出

`AIMG0001` 目前只在 `san11pkres.bin` 的 `2196-2205` 号 LINK entry 中出现。它们紧跟在 `2189-2195` 的 `WFTX0010` 贴图组之后；这组贴图中包含之前观察到的马匹/装备相关纹理。

导出所有 AIMG 块：

```bash
uv run python -m san11resource.aimg.export_aimg -o ../extracted/aimg/output ../game/San11WPK/media/san11pkres.bin
```

把 AIMG 记录叠加到候选 WFTX 图集上：

```bash
uv run python -m san11resource.aimg.overlay_aimg -o ../extracted/aimg/overlays
```

只检查某一个 group/frame：

```bash
uv run python -m san11resource.aimg.overlay_aimg --entry 2196 --group 1 --frame 0 -o ../extracted/aimg/overlays_2196_g01_f00
```

已观察到的结构：

- `0x00`：magic `AIMG0001`
- `0x08`：group 数量，目前观察值为 `11`
- `0x0c`：frame 数量，目前观察值为 `6`
- `0x10`：`group_count * frame_count` 个 slot 表项
- slot 表项：`uint32 record_offset`、`uint32 record_count`
- record 大小：`28` 字节，目前解释为一个 `float` 值加三组整数 x/y 点

输出内容：

- `*.aimg`：原始 AIMG 块
- `meta/*.json`：每个 entry 的摘要
- `aimg_slots.csv/json`：每个 group/frame slot 一行
- `aimg_records.csv/json`：每条 28 字节记录一行
- `preview/*/*.png`：每个非空 slot 的调试图
- `sheet/*.png`：每个 AIMG entry 的 `11 x 6` 联系表
- `../overlays/*.png`：把 AIMG 记录画到候选 WFTX 图集上的叠加图

当前完整导出结果：

```text
10 个 AIMG block
660 个 slot
1751 条 record
210 张叠加图
```

解释笔记：

- `11 * 6` 的表结构很像方向/分组乘以动画帧。
- 每条 28 字节记录中的 6 个整数坐标落在 `512 x 512` 贴图坐标空间内，画出来像三角形片段。
- 叠加检查显示，这些记录和 `entry 2195` 的多层精灵图集对齐更明显；和 `2189-2194` 的马匹/装备贴图页不像普通 UV 对应关系。
- 因此当前更倾向于认为 `2195` 加 `2196-2205` 是一套 2D 动作/动画精灵系统，和从 `2207` 开始的 WKMD 3D 模型块分属相邻但不同的资源系统。
