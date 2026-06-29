# 文档索引

这里记录 San11 资源格式逆向的分析文档、原始文件版本和格式状态。当前文档仍以分析记录为主；等某个格式足够稳定，再单独沉淀到 `formats/` 下。

## 分析文档

分析文档中的提取命令默认在 `extractor/` 目录内执行，因此示例路径通常使用 `../game/` 和 `../extracted/`。

- `analysis/resource_bin_analysis.md`：`san11pkres.bin`、`san11res1.bin` 的 LINK 拆包、WFTX 导出、覆盖率和 raw/recognized 状态。
- `analysis/fce_face_analysis.md`：`San11Face00.fce` 人脸包导出，包含 BGR 通道顺序说明。
- `analysis/model_wkmd_analysis.md`：`WKMD0010` 模型块、OBJ 导出、part/submesh、贴图绑定和蒙皮权重观察。
- `analysis/aimg_analysis.md`：`AIMG0001` 图集/精灵元数据、slot/record 结构和 overlay 观察。
- `analysis/map_analysis.md`：`SHEX0008`、`GCOL0001`、`K3ST0006`、`OBJS0004` 地图资源簇、200x200 格子和半格错位坐标。
- `analysis/recognized_formats_analysis.md`：`KOVS*`、`FCVD0022`、`KSEF0131`、`TOD20053`、`NUNO0220` 等已识别但仍需继续逆向的格式。
- `analysis/ida_resource_hints.md`：从 `san11pk_dump.exe.idb` 导出的函数、结构体、shadow 名称、地图格子和人物/特技 catalog 线索。

## 本地原始文件

原始游戏文件保存在 `game/` 下，并且刻意排除在 git 之外。下面的 SHA1 用于标识当前提取结果和分析文档对应的本地文件副本：

```text
130200107d0b89e2c9ac1344a0dfd805bf3aeee8  game/San11WPK/media/san11pkres.bin
bebdf98d8c2efe16efe6d1f4a342a6e8249a5282  game/San11WPK/media/san11res1.bin
95b551a70eb8629ff375c783c4ec7bcb73428e20  game/San11WPK/media/face/San11Face00.fce
```

## 格式状态索引

| 格式 | 当前状态 | 主要文档 |
| --- | --- | --- |
| `LINK` | `confirmed` | `analysis/resource_bin_analysis.md` |
| `WFTX0010` | `confirmed` | `analysis/resource_bin_analysis.md` |
| `FCE` | `confirmed` | `analysis/fce_face_analysis.md` |
| `WKMD0010` | `structurally parsed` | `analysis/model_wkmd_analysis.md` |
| `AIMG0001` | `structurally parsed` | `analysis/aimg_analysis.md` |
| `SHEX0008` | `confirmed` | `analysis/map_analysis.md` |
| `GCOL0001` | `structurally parsed` | `analysis/map_analysis.md` |
| `K3ST0006` | `structurally parsed` | `analysis/map_analysis.md` |
| `OBJS0004` | `structurally parsed` | `analysis/map_analysis.md` |
| data-buffer/descriptor pair | `structurally parsed` | `analysis/resource_bin_analysis.md`, `analysis/map_analysis.md` |
| `FCVD0022` | `structurally parsed` | `analysis/recognized_formats_analysis.md` |
| `KSEF0131` | `structurally parsed` | `analysis/recognized_formats_analysis.md` |
| `TOD20053` | `structurally parsed` | `analysis/recognized_formats_analysis.md` |
| `NUNO0220` | `structurally parsed` | `analysis/recognized_formats_analysis.md` |
| `KOVS*` | `recognized only` | `analysis/recognized_formats_analysis.md` |
| 25 字节 `0/1` 小表 | `guess` | `analysis/resource_bin_analysis.md` |
| IDA resource hints | `supporting evidence` | `analysis/ida_resource_hints.md` |

## 文档约定

格式说明中使用以下可信度标签：

- `confirmed`：结构可复现，导出结果正确。
- `structurally parsed`：字节布局大体已知，但字段语义还不完整。
- `recognized only`：已识别签名或格式家族，但载荷尚未解码。
- `guess`：有用的工作假设，尚未验证。

`formats/` 目录暂时只作为稳定格式规格的预留位置。当前优先维护 `analysis/` 中的证据链和复现方法，避免把仍在变化的推测过早写成规格。
