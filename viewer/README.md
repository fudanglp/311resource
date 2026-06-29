# 浏览器占位目录

这个目录预留给后续的 San11 资源 Web 浏览器。

浏览器应该读取已经生成的文件：

- `extracted/manifests/*.json`
- `extracted/faces/`
- `extracted/resources/`
- `extracted/models/`
- `extracted/maps/`
- `extracted/aimg/`
- `extracted/recognized/`

浏览器不应该直接解析原始游戏文件。二进制解析应放在 Python 提取层完成。
