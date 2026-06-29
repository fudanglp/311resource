#!/usr/bin/env python3
"""
Experimental WKMD0010 model extractor for San11 WPK resources.

This script focuses on the LINK entries that start with `WKMD0010`. The WKMD
format is not fully mapped yet, but the common mesh payload has enough structure
to export a useful OBJ preview:

- WKMD header starts with `WKMD0010`
- 0x08 uint32 declared block size
- 0x0c uint32 header size, observed as 0x50
- 0x18..0x2f float[6] bounding box: min xyz, max xyz
- 0x30..0x4f several count/offset pairs for transforms and other tables
- 0x50 mesh descriptor, observed fields:
  - 0x54 vertex stride, commonly 0x2c
  - 0x58 vertex count
  - 0x5c vertex offset
  - 0x74 triangle-strip index count
  - 0x78 triangle-strip index offset

The OBJ export decodes position, normal, and UV for common vertex layouts and
converts the index strip into triangles while skipping degenerate triangles.
"""

from __future__ import annotations

import argparse
import csv
import json
import mmap
import os
import struct
from dataclasses import asdict, dataclass
from pathlib import Path

from PIL import Image


LINK_MAGIC = b"LINK"
WFTX_MAGIC = b"WFTX0010"
WKMD_MAGIC = b"WKMD0010"
WFTX_HEADER_SIZE = 24
SUPPORTED_WFTX_BPP = {24, 32}


@dataclass(frozen=True)
class WkmdRecord:
    source: str
    entry: int
    offset: int
    size: int
    vertex_count: int
    vertex_stride: int
    vertex_offset: int
    index_count: int
    index_offset: int
    triangle_count: int
    bbox_min_x: float
    bbox_min_y: float
    bbox_min_z: float
    bbox_max_x: float
    bbox_max_y: float
    bbox_max_z: float
    obj: str
    mtl: str
    texture_entry: int
    texture: str
    raw: str
    note: str = ""


@dataclass(frozen=True)
class TextureExport:
    entry: int
    offset: int
    path: Path
    width: int
    height: int
    bpp: int
    layer_count: int


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def read_link_table(buf: mmap.mmap) -> list[tuple[int, int]]:
    if len(buf) < 16 or buf[:4] != LINK_MAGIC:
        raise ValueError("input is not a LINK container")
    _, count, _, _ = struct.unpack_from("<4sIII", buf, 0)
    table_end = 16 + count * 8
    if table_end > len(buf):
        raise ValueError("invalid LINK table")
    return [struct.unpack_from("<II", buf, 16 + i * 8) for i in range(count)]


def as_obj_path(path: str | os.PathLike[str]) -> str:
    return os.fspath(path).replace(os.sep, "/")


def parse_wftx_header(data: bytes) -> dict[str, int]:
    if len(data) < WFTX_HEADER_SIZE or not data.startswith(WFTX_MAGIC):
        raise ValueError("not a WFTX0010 block")

    declared_size, unknown, width, height, packed_bpp = struct.unpack_from("<IIHHI", data, 0x08)
    bpp = packed_bpp & 0xFFFF
    layer_count = packed_bpp >> 16
    if layer_count == 0:
        layer_count = 1
    if width <= 0 or height <= 0 or bpp not in SUPPORTED_WFTX_BPP:
        raise ValueError(f"unsupported WFTX shape: {width}x{height}x{bpp}")

    bytes_per_pixel = bpp // 8
    pixel_size = width * height * bytes_per_pixel
    header_size = declared_size - pixel_size * layer_count
    if header_size < WFTX_HEADER_SIZE:
        raise ValueError("invalid WFTX header size")
    if header_size + pixel_size * layer_count > len(data):
        raise ValueError("WFTX pixel data exceeds block")

    return {
        "declared_size": declared_size,
        "unknown": unknown,
        "width": width,
        "height": height,
        "bpp": bpp,
        "layer_count": layer_count,
        "header_size": header_size,
        "pixel_size": pixel_size,
    }


def decode_wftx_pixels(raw: bytes, width: int, height: int, bpp: int) -> Image.Image:
    if bpp == 24:
        return Image.frombytes("RGB", (width, height), raw, "raw", "BGR")
    if bpp == 32:
        return Image.frombytes("RGBA", (width, height), raw, "raw", "BGRA")
    raise ValueError(f"unsupported WFTX bpp: {bpp}")


def export_texture_entry(
    source: Path,
    data: bytes,
    entry: int,
    offset: int,
    output_root: Path,
    *,
    layer_index: int = 0,
) -> TextureExport:
    header = parse_wftx_header(data)
    if layer_index >= header["layer_count"]:
        raise ValueError(f"texture layer out of range: {layer_index}")

    pixel_start = header["header_size"] + layer_index * header["pixel_size"]
    pixel_end = pixel_start + header["pixel_size"]
    image = decode_wftx_pixels(
        data[pixel_start:pixel_end],
        header["width"],
        header["height"],
        header["bpp"],
    )

    stem = source.stem
    suffix = "" if header["layer_count"] == 1 else f"_layer{layer_index:02d}"
    texture_path = output_root / stem / "textures" / f"entry_{entry:05d}_{offset:08x}{suffix}.png"
    ensure_dir(texture_path.parent)
    image.save(texture_path)
    return TextureExport(
        entry=entry,
        offset=offset,
        path=texture_path,
        width=header["width"],
        height=header["height"],
        bpp=header["bpp"],
        layer_count=header["layer_count"],
    )


def parse_wkmd(data: bytes) -> dict:
    if not data.startswith(WKMD_MAGIC):
        raise ValueError("not a WKMD0010 block")
    if len(data) < 0x80:
        raise ValueError("WKMD block too small")

    declared_size, header_size, unknown_0, unknown_1 = struct.unpack_from("<IIII", data, 0x08)
    bbox = struct.unpack_from("<ffffff", data, 0x18)
    header_words = struct.unpack_from("<20I", data, 0x30)
    mesh_words = struct.unpack_from("<20I", data, 0x50)

    # Observed mesh descriptor layout for ordinary WKMD meshes.
    vertex_stride = mesh_words[1]
    vertex_count = mesh_words[2]
    vertex_offset = mesh_words[3]
    index_count = mesh_words[9]
    index_offset = mesh_words[10]

    if vertex_stride == 0 or vertex_stride > 0x100:
        raise ValueError(f"unsupported vertex stride: {vertex_stride}")
    if vertex_count <= 0 or vertex_offset <= 0:
        raise ValueError("missing vertex table")
    if vertex_offset + vertex_count * vertex_stride > len(data):
        raise ValueError("vertex table exceeds block")
    if index_count <= 0 or index_offset <= 0:
        raise ValueError("missing index table")
    if index_offset + index_count * 2 > len(data):
        raise ValueError("index table exceeds block")

    return {
        "declared_size": declared_size,
        "header_size": header_size,
        "unknown_0": unknown_0,
        "unknown_1": unknown_1,
        "bbox": bbox,
        "header_words": header_words,
        "mesh_words": mesh_words,
        "table0_count": struct.unpack_from("<I", data, 0x30)[0],
        "table0_offset": struct.unpack_from("<I", data, 0x34)[0],
        "table1_count": struct.unpack_from("<I", data, 0x38)[0],
        "table1_offset": struct.unpack_from("<I", data, 0x3C)[0],
        "part_count": struct.unpack_from("<I", data, 0x48)[0],
        "part_flags": struct.unpack_from("<I", data, 0x4C)[0],
        "vertex_stride": vertex_stride,
        "vertex_count": vertex_count,
        "vertex_offset": vertex_offset,
        "index_count": index_count,
        "index_offset": index_offset,
    }


def infer_record_size(start: int, end: int, count: int) -> int:
    if count <= 0 or start <= 0 or end <= start:
        return 0
    span = end - start
    if span % count == 0:
        return span // count
    # Some blocks have a small padding gap before the next table.
    for padding in range(1, 17):
        if span > padding and (span - padding) % count == 0:
            return (span - padding) // count
    return 0


def parse_part_records(data: bytes, meta: dict) -> list[dict]:
    part_record_count = meta["part_count"] + meta["part_flags"]
    if part_record_count <= 0:
        return []

    offset_table = 0xA0
    offset_table_end = offset_table + part_record_count * 4
    if offset_table_end > len(data):
        return []

    offsets = list(struct.unpack_from("<" + "I" * part_record_count, data, offset_table))
    if any(offset < offset_table_end or offset >= meta["table0_offset"] for offset in offsets):
        return []
    if offsets != sorted(offsets):
        return []
    records = []
    for index, part_offset in enumerate(offsets):
        next_offset = offsets[index + 1] if index + 1 < len(offsets) else meta["table0_offset"]
        if next_offset <= part_offset or next_offset > len(data):
            return []
        payload = data[part_offset:next_offset]
        if len(payload) != 44:
            return []
        record: dict[str, object] = {
            "index": index,
            "offset": part_offset,
            "size": len(payload),
            "words": [hex(value) for value in struct.unpack_from("<" + "I" * (len(payload) // 4), payload, 0)],
        }
        if len(payload) >= 44:
            record["value0"] = struct.unpack_from("<f", payload, 0)[0]
            record["u16_04"] = list(struct.unpack_from("<20H", payload, 4))
            record["u32_04"] = [hex(value) for value in struct.unpack_from("<10I", payload, 4)]
            record["bone_indices"] = [value for value in struct.unpack_from("<4H", payload, 8) if value != 0]
            vertex_start, vertex_count, index_start, index_count = struct.unpack_from("<4I", payload, 28)
            record["vertex_start"] = vertex_start
            record["vertex_count"] = vertex_count
            record["index_start"] = index_start
            record["index_count"] = index_count
        records.append(record)
    return records


def summarize_skin_weights(data: bytes, meta: dict) -> dict:
    if meta["vertex_stride"] < 44:
        return {}
    sums = []
    implicit_weights = []
    for index in range(meta["vertex_count"]):
        base = meta["vertex_offset"] + index * meta["vertex_stride"]
        w0, w1, w2 = struct.unpack_from("<fff", data, base + 12)
        weight_sum = w0 + w1 + w2
        sums.append(weight_sum)
        implicit_weights.append(1.0 - weight_sum)
    if not sums:
        return {}
    return {
        "layout": "stride 0x2c: position[3], skin_weight[3], normal[3], uv[2]; fourth weight is likely 1-sum(weights)",
        "sum_min": min(sums),
        "sum_max": max(sums),
        "sum_average": sum(sums) / len(sums),
        "implicit_min": min(implicit_weights),
        "implicit_max": max(implicit_weights),
        "near_one_ratio": sum(1 for value in sums if abs(value - 1.0) < 0.01) / len(sums),
    }


def describe_wkmd_tables(meta: dict) -> list[dict]:
    table0_end = meta["table1_offset"] if meta["table1_offset"] > meta["table0_offset"] else meta["vertex_offset"]
    table1_end = meta["vertex_offset"]
    return [
        {
            "name": "table0",
            "count": meta["table0_count"],
            "offset": meta["table0_offset"],
            "inferred_record_size": infer_record_size(meta["table0_offset"], table0_end, meta["table0_count"]),
        },
        {
            "name": "table1",
            "count": meta["table1_count"],
            "offset": meta["table1_offset"],
            "inferred_record_size": infer_record_size(meta["table1_offset"], table1_end, meta["table1_count"]),
        },
        {
            "name": "parts",
            "count": meta["part_count"] + meta["part_flags"],
            "offset": 0xA0 if meta["part_count"] else 0,
            "inferred_record_size": 44 if meta["part_count"] else 0,
            "base_count": meta["part_count"],
            "flags": meta["part_flags"],
        },
    ]


def parse_transform_records(data: bytes, meta: dict) -> list[dict]:
    if meta["table1_count"] <= 0 or meta["table1_offset"] <= 0:
        return []
    record_size = infer_record_size(meta["table1_offset"], meta["vertex_offset"], meta["table1_count"])
    if record_size != 40:
        return []

    records = []
    for record_index in range(meta["table1_count"]):
        base = meta["table1_offset"] + record_index * record_size
        if base + record_size > len(data):
            break
        packed_id = struct.unpack_from("<I", data, base)[0]
        node_index = packed_id & 0xFFFF
        parent_index = packed_id >> 16
        if parent_index == 0xFFFF:
            parent_index = -1
        scale = struct.unpack_from("<fff", data, base + 4)
        rotation = struct.unpack_from("<fff", data, base + 16)
        translation = struct.unpack_from("<fff", data, base + 28)
        records.append(
            {
                "record_index": record_index,
                "node_index": node_index,
                "parent_index": parent_index,
                "scale": scale,
                "rotation": rotation,
                "translation": translation,
            }
        )
    return records


def read_vertex_data(
    data: bytes,
    meta: dict,
    *,
    flip_v: bool,
) -> tuple[list[tuple[float, float, float]], list[tuple[float, float, float]], list[tuple[float, float]]]:
    positions = []
    normals = []
    uvs = []

    stride_float_count = meta["vertex_stride"] // 4
    if stride_float_count >= 11:
        normal_offset = 6
        uv_offset = 9
    elif stride_float_count >= 8:
        normal_offset = 3
        uv_offset = 6
    else:
        normal_offset = None
        uv_offset = None

    for index in range(meta["vertex_count"]):
        base = meta["vertex_offset"] + index * meta["vertex_stride"]
        values = struct.unpack_from("<" + "f" * stride_float_count, data, base)
        positions.append(values[0:3])

        if normal_offset is not None:
            normals.append(values[normal_offset : normal_offset + 3])
        else:
            normals.append((0.0, 1.0, 0.0))

        if uv_offset is not None:
            u, v = values[uv_offset : uv_offset + 2]
            if flip_v:
                v = 1.0 - v
            uvs.append((u, v))
        else:
            uvs.append((0.0, 0.0))

    return positions, normals, uvs


def read_strip_indices(data: bytes, meta: dict) -> list[int]:
    return [
        struct.unpack_from("<H", data, meta["index_offset"] + index * 2)[0]
        for index in range(meta["index_count"])
    ]


def strip_to_triangles(indices: list[int], vertex_count: int) -> list[tuple[int, int, int]]:
    triangles: list[tuple[int, int, int]] = []
    for index in range(len(indices) - 2):
        a, b, c = indices[index], indices[index + 1], indices[index + 2]
        if 0xFFFF in (a, b, c):
            continue
        if a >= vertex_count or b >= vertex_count or c >= vertex_count:
            continue
        if a == b or b == c or a == c:
            continue
        if index % 2 == 0:
            triangles.append((a, b, c))
        else:
            triangles.append((b, a, c))
    return triangles


def build_triangle_groups(
    indices: list[int],
    vertex_count: int,
    part_records: list[dict],
) -> list[tuple[str, list[tuple[int, int, int]]]]:
    full_triangles = strip_to_triangles(indices, vertex_count)
    groups: list[tuple[str, list[tuple[int, int, int]]]] = []
    for part in part_records:
        index_start = part.get("index_start")
        index_count = part.get("index_count")
        if not isinstance(index_start, int) or not isinstance(index_count, int):
            continue
        if index_start < 0 or index_count <= 0 or index_start + index_count > len(indices):
            continue
        part_indices = indices[index_start : index_start + index_count]
        triangles = strip_to_triangles(part_indices, vertex_count)
        if triangles:
            groups.append((f"part_{part['index']:02d}", triangles))
    grouped_triangle_count = sum(len(triangles) for _group_name, triangles in groups)
    if groups and grouped_triangle_count >= len(full_triangles) * 0.75:
        return groups
    return [("mesh", full_triangles)]


def write_obj(
    path: Path,
    vertices: list[tuple[float, float, float]],
    normals: list[tuple[float, float, float]],
    uvs: list[tuple[float, float]],
    triangle_groups: list[tuple[str, list[tuple[int, int, int]]]],
    *,
    mtl_path: Path | None = None,
) -> None:
    ensure_dir(path.parent)
    with path.open("w", encoding="utf-8", newline="\n") as file:
        file.write("# Experimental OBJ exported from WKMD0010\n")
        if mtl_path is not None:
            rel_mtl = os.path.relpath(mtl_path, path.parent)
            file.write(f"mtllib {as_obj_path(rel_mtl)}\n")
        for x, y, z in vertices:
            file.write(f"v {x:.8f} {y:.8f} {z:.8f}\n")
        for u, v in uvs:
            file.write(f"vt {u:.8f} {v:.8f}\n")
        for x, y, z in normals:
            file.write(f"vn {x:.8f} {y:.8f} {z:.8f}\n")
        if mtl_path is not None:
            file.write("usemtl san11_material\n")
        for group_name, triangles in triangle_groups:
            file.write(f"g {group_name}\n")
            for a, b, c in triangles:
                file.write(f"f {a + 1}/{a + 1}/{a + 1} {b + 1}/{b + 1}/{b + 1} {c + 1}/{c + 1}/{c + 1}\n")


def write_mtl(path: Path, texture_path: Path) -> None:
    ensure_dir(path.parent)
    rel_texture = os.path.relpath(texture_path, path.parent)
    with path.open("w", encoding="utf-8", newline="\n") as file:
        file.write("# Experimental material exported from WKMD0010/WFTX0010\n")
        file.write("newmtl san11_material\n")
        file.write("Ka 1.000000 1.000000 1.000000\n")
        file.write("Kd 1.000000 1.000000 1.000000\n")
        file.write("Ks 0.000000 0.000000 0.000000\n")
        file.write("d 1.000000\n")
        file.write("illum 1\n")
        file.write(f"map_Kd {as_obj_path(rel_texture)}\n")


def export_entry(
    source: Path,
    data: bytes,
    entry: int,
    offset: int,
    output_root: Path,
    *,
    flip_v: bool,
    texture: TextureExport | None = None,
) -> WkmdRecord:
    meta = parse_wkmd(data)
    table_descriptions = describe_wkmd_tables(meta)
    part_records = parse_part_records(data, meta)
    transform_records = parse_transform_records(data, meta)
    skin_weights = summarize_skin_weights(data, meta)
    vertices, normals, uvs = read_vertex_data(data, meta, flip_v=flip_v)
    indices = read_strip_indices(data, meta)
    triangle_groups = build_triangle_groups(indices, meta["vertex_count"], part_records)
    triangle_count = sum(len(triangles) for _group_name, triangles in triangle_groups)

    stem = source.stem
    base_name = f"entry_{entry:05d}_{offset:08x}"
    raw_path = output_root / stem / "wkmd" / f"{base_name}.wkmd"
    obj_path = output_root / stem / "obj" / f"{base_name}.obj"
    mtl_path = output_root / stem / "mtl" / f"{base_name}.mtl" if texture is not None else None
    meta_path = output_root / stem / "meta" / f"{base_name}.json"

    ensure_dir(raw_path.parent)
    raw_path.write_bytes(data)
    if texture is not None and mtl_path is not None:
        write_mtl(mtl_path, texture.path)
    write_obj(obj_path, vertices, normals, uvs, triangle_groups, mtl_path=mtl_path)
    ensure_dir(meta_path.parent)
    meta_path.write_text(
        json.dumps(
            {
                "entry": entry,
                "offset": offset,
                "size": len(data),
                "declared_size": meta["declared_size"],
                "header_size": meta["header_size"],
                "bbox": meta["bbox"],
                "header_words": [hex(x) for x in meta["header_words"]],
                "mesh_words": [hex(x) for x in meta["mesh_words"]],
                "tables": table_descriptions,
                "part_count": meta["part_count"],
                "part_flags": meta["part_flags"],
                "part_records": part_records,
                "transform_records": transform_records,
                "skin_weights": skin_weights,
                "vertex_count": meta["vertex_count"],
                "vertex_stride": meta["vertex_stride"],
                "vertex_offset": meta["vertex_offset"],
                "index_count": meta["index_count"],
                "index_offset": meta["index_offset"],
                "triangle_count": triangle_count,
                "triangle_groups": [
                    {"name": group_name, "triangle_count": len(triangles)}
                    for group_name, triangles in triangle_groups
                ],
                "texture_entry": texture.entry if texture is not None else -1,
                "texture": str(texture.path.relative_to(output_root)) if texture is not None else "",
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    bbox = meta["bbox"]
    note = ""
    if triangle_count == 0:
        note = "no triangles exported"

    return WkmdRecord(
        source=str(source),
        entry=entry,
        offset=offset,
        size=len(data),
        vertex_count=meta["vertex_count"],
        vertex_stride=meta["vertex_stride"],
        vertex_offset=meta["vertex_offset"],
        index_count=meta["index_count"],
        index_offset=meta["index_offset"],
        triangle_count=triangle_count,
        bbox_min_x=bbox[0],
        bbox_min_y=bbox[1],
        bbox_min_z=bbox[2],
        bbox_max_x=bbox[3],
        bbox_max_y=bbox[4],
        bbox_max_z=bbox[5],
        obj=str(obj_path.relative_to(output_root)),
        mtl=str(mtl_path.relative_to(output_root)) if mtl_path is not None else "",
        texture_entry=texture.entry if texture is not None else -1,
        texture=str(texture.path.relative_to(output_root)) if texture is not None else "",
        raw=str(raw_path.relative_to(output_root)),
        note=note,
    )


def export_link_wkmd(
    input_path: Path,
    output_root: Path,
    *,
    entries_filter: set[int] | None,
    flip_v: bool,
    auto_texture_previous: bool,
    texture_entry: int | None,
    texture_layer: int,
) -> list[WkmdRecord]:
    records: list[WkmdRecord] = []
    texture_cache: dict[tuple[int, int], TextureExport | None] = {}

    def texture_for_entry(buf: mmap.mmap, entries: list[tuple[int, int]], model_entry: int) -> TextureExport | None:
        candidate_entry = texture_entry
        if candidate_entry is None and auto_texture_previous and model_entry > 0:
            prev_offset, prev_size = entries[model_entry - 1]
            if bytes(buf[prev_offset : prev_offset + min(prev_size, 8)]) == WFTX_MAGIC:
                candidate_entry = model_entry - 1
        if candidate_entry is None:
            return None

        cache_key = (candidate_entry, texture_layer)
        if cache_key in texture_cache:
            return texture_cache[cache_key]
        if candidate_entry < 0 or candidate_entry >= len(entries):
            print(f"Texture entry {candidate_entry} is out of range")
            texture_cache[cache_key] = None
            return None

        candidate_offset, candidate_size = entries[candidate_entry]
        payload = bytes(buf[candidate_offset : candidate_offset + candidate_size])
        if not payload.startswith(WFTX_MAGIC):
            print(f"Texture entry {candidate_entry} is not WFTX0010")
            texture_cache[cache_key] = None
            return None

        try:
            texture_cache[cache_key] = export_texture_entry(
                input_path,
                payload,
                candidate_entry,
                candidate_offset,
                output_root,
                layer_index=texture_layer,
            )
        except Exception as exc:
            print(f"Skipping texture entry {candidate_entry}: {exc}")
            texture_cache[cache_key] = None
        return texture_cache[cache_key]

    with input_path.open("rb") as file:
        with mmap.mmap(file.fileno(), 0, access=mmap.ACCESS_READ) as buf:
            entries = read_link_table(buf)
            for entry, (offset, size) in enumerate(entries):
                if entries_filter is not None and entry not in entries_filter:
                    continue
                payload = bytes(buf[offset : offset + size])
                if not payload.startswith(WKMD_MAGIC):
                    continue
                try:
                    records.append(
                        export_entry(
                            input_path,
                            payload,
                            entry,
                            offset,
                            output_root,
                            flip_v=flip_v,
                            texture=texture_for_entry(buf, entries, entry),
                        )
                    )
                except Exception as exc:
                    print(f"Skipping entry {entry}: {exc}")
    return records


def write_manifest(output_root: Path, records: list[WkmdRecord]) -> None:
    fields = list(WkmdRecord.__dataclass_fields__.keys())
    csv_path = output_root / "wkmd_models.csv"
    json_path = output_root / "wkmd_models.json"
    ensure_dir(output_root)
    with csv_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        for record in records:
            writer.writerow(asdict(record))
    json_path.write_text(
        json.dumps([asdict(record) for record in records], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def parse_entry_filter(values: list[str] | None) -> set[int] | None:
    if not values:
        return None
    result = set()
    for value in values:
        for part in value.split(","):
            part = part.strip()
            if not part:
                continue
            result.add(int(part, 0))
    return result


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Experimental WKMD0010 to OBJ exporter")
    parser.add_argument(
        "input",
        nargs="?",
        default="../game/San11WPK/media/san11pkres.bin",
        help="LINK container containing WKMD0010 entries",
    )
    parser.add_argument("-o", "--output", default="../extracted/models/output", help="Output directory")
    parser.add_argument(
        "--entry",
        action="append",
        help="Only export selected LINK entry index, accepts decimal/hex and comma lists",
    )
    parser.add_argument(
        "--no-flip-v",
        action="store_true",
        help="Do not flip the V texture coordinate when writing OBJ vt records",
    )
    parser.add_argument(
        "--no-auto-texture",
        action="store_true",
        help="Do not auto-bind the immediately previous WFTX0010 entry as a texture",
    )
    parser.add_argument(
        "--texture-entry",
        type=lambda value: int(value, 0),
        help="Bind all exported models to this WFTX0010 LINK entry instead of auto-detecting",
    )
    parser.add_argument(
        "--texture-layer",
        type=int,
        default=0,
        help="WFTX layer index to export when binding a multi-layer texture",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    input_path = Path(args.input)
    output_root = Path(args.output)
    if not input_path.is_file():
        parser.error(f"input file does not exist: {input_path}")

    records = export_link_wkmd(
        input_path,
        output_root,
        entries_filter=parse_entry_filter(args.entry),
        flip_v=not args.no_flip_v,
        auto_texture_previous=not args.no_auto_texture,
        texture_entry=args.texture_entry,
        texture_layer=args.texture_layer,
    )
    write_manifest(output_root, records)

    print(f"Exported {len(records)} WKMD model(s) to {output_root}")
    for record in records[:20]:
        print(
            f"  entry {record.entry}: vertices={record.vertex_count}, "
            f"indices={record.index_count}, triangles={record.triangle_count}, "
            f"texture_entry={record.texture_entry}, obj={record.obj}"
        )
    if len(records) > 20:
        print(f"  ... {len(records) - 20} more")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
