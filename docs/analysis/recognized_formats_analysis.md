# 已识别资源格式分析

这个文档记录之前只按签名识别、现在正在继续逆向的资源家族。

运行：

```bash
uv run python -m san11resource.recognized.analyze_recognized -o ../extracted/recognized/output
```

输出：

- `recognized_blocks.csv/json`：每个已识别 entry 一行，包含结构验证结果。
- `fcvd_sample_records.csv/json`：每个 `FCVD0022` entry 取前 32 条解码记录，方便快速检查。

当前结构匹配结果：

```text
KOVS      3293 blocks, 3293 exact 32-byte-header matches
FCVD0022   717 blocks,  717 exact 0x60 + 16*N matches
KSEF0131   282 blocks,  282 exact 12 + 16*N matches
TOD20053    38 blocks,   38 exact count*16 matches
NUNO0220     8 blocks,    8 exact count*16 matches
```

## IDA 线索现状

`san11pk_dump.exe.idb` 已通过 `python-idb` 导出函数名、命名地址、结构体和结构成员，并进一步生成 `extractor/ida/data/resource_hints/`。当前结论是：

- 函数名、命名地址和结构体表中没有直接命中 `KOVS`、`FCVD0022`、`KSEF0131`、`TOD20053`、`SHEX0008`、`GCOL0001`、`K3ST0006`、`OBJS0004`、`AIMG0001`。
- 直接扫描 IDB 字符串时，`NUNO0220` 和 `CDEF0120` 有命中，但上下文更像资源字符串或标签，还不足以解释字段布局。
- `WFTX0010` 和 `WKMD0010` 有命中，但这两个格式已有 parser，当前收益有限。

因此，下面这些格式的字段语义暂时不能靠现有 IDA CSV 直接解决。下一步若要继续利用 IDA，需要导出字符串引用、函数 xref、反汇编或伪代码上下文。更完整说明见 `analysis/ida_resource_hints.md`。

## FCVD0022

当前结构：

```text
0x00  char[8]  "FCVD0022"
0x08  u32      声明数量或近似数量
0x0c  u32      packed flags/count 候选
0x10  ...      header 值
0x60  records, 每条 16 字节
```

所有已观察 `FCVD0022` 都满足：

```text
size = 0x60 + record_count * 16
u32@0x08 - record_count 为 6 或 8
```

16 字节 record 目前可较合理地解码为：

```text
u16 tag
u16 key/frame/control index
float x
float y
float z
```

它看起来像曲线、向量或控制点数据。准确语义还需要和使用这些 entry 的模型/特效代码关联。

## KSEF0131

当前结构：

```text
0x00  char[8]  "KSEF0131"
0x08  u32      声明大小，等于 entry size
0x0c  records, 每条 16 字节
```

所有已观察 entry 都满足：

```text
size = 12 + record_count * 16
```

前几条 record 包含稳定的类似变换矩阵的值。常见情况下，`0x14..0x53` 是 4x4 单位 float 矩阵。它很可能是面向特效、骨架或变换的格式，但字段名仍是临时判断。

## TOD20053

当前结构：

```text
0x00  char[8]  "TOD20053"
0x08  u32      record count
```

所有已观察 entry 都满足：

```text
size = record_count * 16
```

目前在 `san11pkres.bin` 中观察到 38 个 block，均为 31216 字节，并且 `u32@0x08 = 1951`。

## NUNO0220

当前结构：

```text
0x00  char[8]  "NUNO0220"
0x08  u32      record count
```

所有已观察 entry 都满足：

```text
size = record_count * 16
```

`NUNO0220` 内含嵌入的 `CDEF0120` 标记，通常靠近 block 前部。这说明它可能是复合资源，至少包含一个嵌套定义表。

## KOVS

当前结构：

```text
0x00  char[4]  "KOVS"
0x04  u32      body size，等于 entry size - 32
0x08  u32      secondary value，通常为 0
0x0c  ...      大多为 0 的 header 字节
0x20  bytes    尚未解码的 body
```

所有已观察 `KOVS*` entry 都满足 32 字节 header 规则。body 仍未解码，因此在覆盖率中 `KOVS` 仍是 `recognized`，不是 `parsed`。

补充观察：

- `u32@0x08` 在 3293 个 entry 中有 3290 个为 0。三个非零值是 `6297309`、`3050875`、`2124500`。
- body 内尚未找到可靠的嵌套资源 magic。偶尔出现 `BM` 字节对，但不是有效的独立 BMP header。
- body 开头在多个 entry 中高度稳定：

```text
4f 66 65 50 04 07 06 07 08 09 0a 0b 0c 0d
```

许多 entry 的 body 前 `0x100` 字节存在大段固定或近似固定内容，所以 body 更像带有共同表/header 的自定义编码或压缩流，而不像任意 raw data。
