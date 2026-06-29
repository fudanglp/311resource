# San11 资源提取器

这是 `311resource` 仓库中的独立 Python 工程，负责从本地游戏文件中提取和分析资源。

## 运行位置

默认从 `extractor/` 目录运行命令。脚本默认读取上一级目录的 `../game/`，并把结果写到 `../extracted/`。

```bash
cd extractor
uv sync
```

## 命令入口

```bash
uv run san11res paths
uv run san11res list-modules
```

`san11res` 目前只是轻量入口；提取逻辑已经统一放在 `src/san11resource/` 包内。

## 模块分组

```text
san11resource.resource/    LINK bin、WFTX、覆盖率分析
san11resource.face/        FCE 人脸包导出
san11resource.model/       WKMD 模型导出
san11resource.aimg/        AIMG 图集/精灵元数据
san11resource.map/         SHEX/GCOL/K3ST/OBJS 地图资源分析
san11resource.recognized/  KOVS/FCVD/KSEF/TOD/NUNO 等已识别格式继续逆向
```

## 常用命令

一键完整提取：

```bash
uv run san11res extract-all
```

需要先清空旧结果时：

```bash
uv run san11res extract-all --clean
```

也可以跳过 AIMG overlay 图片生成：

```bash
uv run san11res extract-all --skip-overlays
```

单独运行模块：

```bash
uv run python -m san11resource.resource.export_resources
uv run python -m san11resource.resource.analyze_coverage
uv run python -m san11resource.face.export_fce
uv run python -m san11resource.model.export_wkmd ../game/San11WPK/media/san11pkres.bin -o ../extracted/models/output_pkres
uv run python -m san11resource.model.export_wkmd ../game/San11WPK/media/san11res1.bin -o ../extracted/models/output_res1
uv run python -m san11resource.aimg.export_aimg
uv run python -m san11resource.aimg.overlay_aimg
uv run python -m san11resource.map.export_shex
uv run python -m san11resource.map.analyze_map_candidates
uv run python -m san11resource.recognized.analyze_recognized
```

## 验证

```bash
uv run python -m compileall src/san11resource
```
