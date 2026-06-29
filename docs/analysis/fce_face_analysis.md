# San11 FCE 人脸导出

`san11resource.face.export_fce` 用于从 `San11Face00.fce` 中导出内嵌的 `WFTX0010` 图片。

默认输入路径是当前仓库的本地游戏副本：

```bash
uv run python -m san11resource.face.export_fce
```

输出内容：

- `extracted/faces/output/240x240/*.png`
- `extracted/faces/output/64x80/*.png`
- `extracted/faces/output/manifest.csv`
- `extracted/faces/output/manifest.json`
- `extracted/faces/output/face_header.json`

快速测试：

```bash
uv run python -m san11resource.face.export_fce --limit 10 -o ../extracted/faces/sample
```

`San11Face00.fce` 的 24-bit 像素按 BGR 顺序保存，所以默认使用：

```text
--channel-order bgr
```

如果需要按原始 RGB 顺序检查通道，可以改用：

```bash
uv run python -m san11resource.face.export_fce --channel-order rgb
```

当前完整导出结果：

```text
240x240x24: 964
64x80x24:   1922
合计:       2886
```
