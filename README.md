# 311resource

KOEI 三国志11资源研究工程。这个仓库按价值边界分成四部分：格式分析文档、资源提取器、网页可视化工具和已提取资料。

## 工程结构

```text
docs/       资源格式分析文档和证据链
extractor/  独立 Python 提取器工程，使用 uv 管理
viewer/     Web based 可视化工具，当前为占位目录
extracted/  已提取资料，当前本地保存，未来考虑 Git LFS 或独立制品管理
game/       本地游戏文件，已被 .gitignore 忽略
scratch/    临时实验区，已被 .gitignore 忽略
```

## 四个部分

`docs/` 是当前最重要的知识库，记录格式结构、字段猜测、证据、覆盖率和分析方法。格式还没稳定时优先写在 `docs/analysis/`，稳定后再沉淀到 `docs/formats/`。

`extractor/` 是独立完整的 Python 工程。它包含 `pyproject.toml`、`uv.lock`、命令行入口、提取脚本和后续测试。所有 Python 依赖和命令都在这个目录内管理。

`viewer/` 预留给后续网页浏览器。它应该读取 `extracted/manifests/*.json` 和提取出的图片/模型/地图，不直接解析原始游戏二进制。

`extracted/` 保存当前提取结果。目录较大，暂时不进 git；后续可以按需要迁移到 Git LFS、release artifact 或单独对象存储。

## 本地数据

`game/` 和 `extracted/` 不进 git：

- `game/` 保存本地复制的 San11WPK 游戏文件，包括 `media/san11pkres.bin`、`media/san11res1.bin`、`.fce` 等原始资源。
- `extracted/` 保存从资源文件导出的图片、模型、地图、清单和分析报告。

关键清单会汇总到：

```text
extracted/manifests/
```

## 提取器快速使用

```bash
cd extractor
uv sync
uv run san11res paths
uv run san11res list-modules
```

完整提取：

```bash
cd extractor
uv run san11res extract-all
```

基础检查：

```bash
cd extractor
uv run python -m compileall src/san11resource
```
