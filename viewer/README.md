# San11 Resource Viewer

本目录是本地资源浏览器。它按游戏内容组织页面，而不是按提取输出目录组织页面：

- 世界地图：SHEX 字段图层、组合预览、runtime grid 线索。
- 地图对象：object_type、shadow 候选名、对象坐标分布。
- 资产库：头像、WFTX 贴图、WKMD 模型、AIMG 覆盖层。
- 解析线索：覆盖率、签名、结构字段，仅作为辅助来源。

运行：

```bash
cd viewer
npm install
npm run dev -- --host 127.0.0.1
```

浏览器只读取已经生成的本地文件：

- `extracted/manifests/*.json`
- `extracted/faces/`
- `extracted/resources/`
- `extracted/models/`
- `extracted/maps/`
- `extracted/aimg/`
- `extractor/ida/data/resource_hints/`

它不直接解析原始游戏文件、IDB 或压缩包。二进制解析应放在 Python 提取层完成。
