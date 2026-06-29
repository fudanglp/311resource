#!/usr/bin/env python3
"""
Export resources from Sangokushi XI / San11 WPK media files.

Supported extraction paths:

- LINK containers (`san11pkres.bin`, `san11res1.bin`): reads the entry table
  and exports recognized entries.
- WFTX0010 image blocks: exports 24-bit BGR and 32-bit BGRA images as PNG.
- BMP entries: writes BMP files when an entry starts with a valid BMP header.
- RIFF entries: writes RIFF files as raw `.riff` payloads.

Unknown LINK entries are recorded in manifests. They are not dumped by default
to avoid duplicating hundreds of MB of proprietary payloads; use `--dump-raw`
when byte-for-byte entry dumps are needed for reverse engineering.
"""

from __future__ import annotations

import argparse
import csv
import json
import mmap
import struct
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image


WFTX_MAGIC = b"WFTX0010"
LINK_MAGIC = b"LINK"
SUPPORTED_WFTX_BPP = {8, 24, 32}
WFTX_CONTAINER_HEADER_SIZE = 16
WFTX_IMAGE_HEADER_SIZE = 8


@dataclass(frozen=True)
class LinkEntry:
    index: int
    offset: int
    size: int
    kind: str
    output: str = ""
    note: str = ""


@dataclass(frozen=True)
class WftxRecord:
    source: str
    source_kind: str
    index: int
    offset: int
    declared_size: int
    unknown: int
    width: int
    height: int
    bpp: int
    layer_count: int
    layer_index: int
    exact_size: bool
    output: str
    note: str = ""


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def rel_output(path: Path, root: Path) -> str:
    return str(path.relative_to(root))


def write_csv(path: Path, rows: Iterable[object], fieldnames: list[str]) -> None:
    ensure_dir(path.parent)
    with path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(asdict(row))


def write_json(path: Path, rows: Iterable[object]) -> None:
    ensure_dir(path.parent)
    path.write_text(
        json.dumps([asdict(row) for row in rows], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def read_link_entries(buf: mmap.mmap) -> tuple[int, int, list[tuple[int, int]]]:
    if len(buf) < 16 or buf[:4] != LINK_MAGIC:
        raise ValueError("not a LINK container")

    _, count, unknown_1, unknown_2 = struct.unpack_from("<4sIII", buf, 0)
    table_end = 16 + count * 8
    if table_end > len(buf):
        raise ValueError(f"invalid LINK table: count={count} exceeds file size")

    entries = []
    for index in range(count):
        offset, size = struct.unpack_from("<II", buf, 16 + index * 8)
        if offset + size > len(buf):
            raise ValueError(
                f"invalid LINK entry {index}: offset={offset:#x}, size={size:#x}, file={len(buf):#x}"
            )
        entries.append((offset, size))

    return unknown_1, unknown_2, entries


def sniff_payload(payload: bytes) -> str:
    if payload.startswith(WFTX_MAGIC):
        return "wftx"
    if payload.startswith(b"BM") and len(payload) >= 14:
        declared_size = struct.unpack_from("<I", payload, 2)[0]
        if 14 <= declared_size <= len(payload):
            return "bmp"
    if payload.startswith(b"RIFF") and len(payload) >= 12:
        return "riff"
    if payload.startswith(LINK_MAGIC):
        return "link"
    if payload.startswith(b"LS11"):
        return "ls11"
    return "raw"


def wftx_level_layout(width: int, height: int, bpp: int, level: int) -> tuple[int, int, int, int]:
    level_width = max(1, width >> level)
    level_height = max(1, height >> level)
    row_stride = (((level_width * bpp + 7) // 8) + 3) & ~3
    return level_width, level_height, row_stride, row_stride * level_height


def parse_wftx_header(buf: bytes | mmap.mmap, offset: int = 0) -> dict[str, object] | None:
    if offset + WFTX_CONTAINER_HEADER_SIZE > len(buf):
        return None
    if bytes(buf[offset : offset + 8]) != WFTX_MAGIC:
        return None

    declared_size, image_count = struct.unpack_from("<II", buf, offset + 8)
    if declared_size < WFTX_CONTAINER_HEADER_SIZE or image_count == 0:
        return None
    if offset + declared_size > len(buf):
        return None

    cursor = offset + WFTX_CONTAINER_HEADER_SIZE
    images: list[dict[str, int]] = []
    for image_index in range(image_count):
        if cursor + WFTX_IMAGE_HEADER_SIZE > offset + declared_size:
            return None

        width, height, bpp, extra_blocks, mip_count, flags = struct.unpack_from("<HHBBBB", buf, cursor)
        if width <= 0 or height <= 0 or bpp not in SUPPORTED_WFTX_BPP:
            return None

        pixel_start = cursor + WFTX_IMAGE_HEADER_SIZE
        pixel_size = 0
        for level in range(mip_count + 1):
            _level_width, _level_height, _row_stride, level_size = wftx_level_layout(width, height, bpp, level)
            pixel_size += level_size

        extra_start = pixel_start + pixel_size
        extra_size = extra_blocks * 1024
        next_cursor = extra_start + extra_size
        if next_cursor > offset + declared_size:
            return None

        images.append(
            {
                "image_index": image_index,
                "header_offset": cursor,
                "width": width,
                "height": height,
                "bpp": bpp,
                "extra_blocks": extra_blocks,
                "mip_count": mip_count,
                "flags": flags,
                "pixel_start": pixel_start,
                "pixel_size": pixel_size,
                "extra_start": extra_start,
                "extra_size": extra_size,
                "next_offset": next_cursor,
            }
        )
        cursor = next_cursor

    if cursor != offset + declared_size:
        return None

    return {
        "declared_size": declared_size,
        "image_count": image_count,
        "images": images,
        "exact_size": int(cursor == offset + declared_size),
    }


def decode_wftx_pixels(
    raw: bytes,
    width: int,
    height: int,
    bpp: int,
    *,
    row_stride: int | None = None,
    palette: bytes = b"",
) -> Image.Image:
    bytes_per_row = (width * bpp + 7) // 8
    if row_stride is not None and row_stride != bytes_per_row:
        raw = b"".join(raw[y * row_stride : y * row_stride + bytes_per_row] for y in range(height))
    if bpp == 8:
        image = Image.frombytes("L", (width, height), raw)
        if len(palette) >= 1024:
            rgba = []
            for index in range(256):
                b, g, r, a = palette[index * 4 : index * 4 + 4]
                rgba.extend((r, g, b, a))
            image.putpalette(rgba, rawmode="RGBA")
            return image.convert("RGBA")
        return image
    if bpp == 24:
        return Image.frombytes("RGB", (width, height), raw, "raw", "BGR")
    if bpp == 32:
        return Image.frombytes("RGBA", (width, height), raw, "raw", "BGRA")
    raise ValueError(f"unsupported bpp: {bpp}")


def save_wftx_png(
    buf: bytes | mmap.mmap,
    offset: int,
    output_path: Path,
    *,
    image_index: int = 0,
    mip_level: int = 0,
) -> tuple[dict[str, object], str]:
    header = parse_wftx_header(buf, offset)
    if header is None:
        raise ValueError("invalid or unsupported WFTX block")
    images = header["images"]
    if not isinstance(images, list) or image_index >= len(images):
        raise ValueError(f"image index out of range: {image_index}")
    image_info = images[image_index]
    if mip_level > image_info["mip_count"]:
        raise ValueError(f"mip level out of range: {mip_level}")

    level_start = image_info["pixel_start"]
    for level in range(mip_level):
        _width, _height, _row_stride, level_size = wftx_level_layout(
            image_info["width"], image_info["height"], image_info["bpp"], level
        )
        level_start += level_size

    width, height, row_stride, level_size = wftx_level_layout(
        image_info["width"], image_info["height"], image_info["bpp"], mip_level
    )
    pixel_start = level_start
    pixel_end = pixel_start + level_size
    raw = bytes(buf[pixel_start:pixel_end])
    palette = bytes(buf[image_info["extra_start"] : image_info["extra_start"] + image_info["extra_size"]])
    image = decode_wftx_pixels(raw, width, height, image_info["bpp"], row_stride=row_stride, palette=palette)
    ensure_dir(output_path.parent)
    image.save(output_path)

    note = (
        f"image {image_index + 1}/{header['image_count']}; "
        f"mip {mip_level}/{image_info['mip_count']}; "
        f"extra_blocks={image_info['extra_blocks']}"
    )
    return header, note


def iter_wftx_offsets(buf: bytes | mmap.mmap) -> Iterable[int]:
    pos = 0
    while True:
        offset = buf.find(WFTX_MAGIC, pos)
        if offset == -1:
            return
        yield offset
        pos = offset + 1


def export_wftx_scan(input_path: Path, output_root: Path, *, limit: int | None = None) -> list[WftxRecord]:
    source_root = output_root / input_path.stem
    source_dir = source_root / "wftx"
    records: list[WftxRecord] = []

    with input_path.open("rb") as file:
        with mmap.mmap(file.fileno(), 0, access=mmap.ACCESS_READ) as buf:
            for offset in iter_wftx_offsets(buf):
                header = parse_wftx_header(buf, offset)
                if header is None:
                    continue

                index = len(records)
                images = header["images"]
                if not isinstance(images, list):
                    continue
                for image_info in images:
                    image_index = image_info["image_index"]
                    size_dir = f"{image_info['width']}x{image_info['height']}_{image_info['bpp']}bpp"
                    suffix = f"_img{image_index:02d}" if header["image_count"] > 1 else ""
                    output_path = source_dir / size_dir / f"{index:05d}_{offset:08x}{suffix}.png"
                    header, note = save_wftx_png(buf, offset, output_path, image_index=image_index)

                    records.append(
                        WftxRecord(
                            source=str(input_path),
                            source_kind="scan",
                            index=index,
                            offset=offset,
                            declared_size=header["declared_size"],
                            unknown=header["image_count"],
                            width=image_info["width"],
                            height=image_info["height"],
                            bpp=image_info["bpp"],
                            layer_count=header["image_count"],
                            layer_index=image_index,
                            exact_size=bool(header["exact_size"]),
                            output=rel_output(output_path, output_root),
                            note=note,
                        )
                    )

                if limit is not None and len(records) >= limit:
                    break

    return records


def export_link(
    input_path: Path,
    output_root: Path,
    *,
    dump_raw: bool = False,
    limit: int | None = None,
) -> tuple[list[LinkEntry], list[WftxRecord]]:
    source_dir = output_root / input_path.stem
    link_records: list[LinkEntry] = []
    wftx_records: list[WftxRecord] = []

    with input_path.open("rb") as file:
        with mmap.mmap(file.fileno(), 0, access=mmap.ACCESS_READ) as buf:
            unknown_1, unknown_2, entries = read_link_entries(buf)
            (source_dir / "link_header.json").parent.mkdir(parents=True, exist_ok=True)
            (source_dir / "link_header.json").write_text(
                json.dumps(
                    {
                        "magic": "LINK",
                        "entry_count": len(entries),
                        "unknown_1": unknown_1,
                        "unknown_2": unknown_2,
                    },
                    ensure_ascii=False,
                    indent=2,
                )
                + "\n",
                encoding="utf-8",
            )

            for entry_index, (entry_offset, entry_size) in enumerate(entries):
                if limit is not None and entry_index >= limit:
                    break

                payload = buf[entry_offset : entry_offset + entry_size]
                kind = sniff_payload(payload[: min(len(payload), 64)])
                output = ""
                note = ""

                if kind == "wftx":
                    try:
                        header = parse_wftx_header(payload, 0)
                        if header is None:
                            raise ValueError("unsupported WFTX header")

                        outputs = []
                        images = header["images"]
                        if not isinstance(images, list):
                            raise ValueError("unsupported WFTX image table")
                        for image_info in images:
                            image_index = image_info["image_index"]
                            size_dir = f"{image_info['width']}x{image_info['height']}_{image_info['bpp']}bpp"
                            suffix = f"_img{image_index:02d}" if header["image_count"] > 1 else ""
                            output_path = (
                                source_dir
                                / "wftx"
                                / size_dir
                                / f"entry_{entry_index:05d}_{entry_offset:08x}{suffix}.png"
                            )
                            header, note = save_wftx_png(payload, 0, output_path, image_index=image_index)
                            layer_output = rel_output(output_path, output_root)
                            outputs.append(layer_output)

                            wftx_records.append(
                                WftxRecord(
                                    source=str(input_path),
                                    source_kind="link_entry",
                                    index=entry_index,
                                    offset=entry_offset,
                                    declared_size=header["declared_size"],
                                    unknown=header["image_count"],
                                    width=image_info["width"],
                                    height=image_info["height"],
                                    bpp=image_info["bpp"],
                                    layer_count=header["image_count"],
                                    layer_index=image_index,
                                    exact_size=bool(header["exact_size"]),
                                    output=layer_output,
                                    note=note,
                                )
                            )
                        output = ";".join(outputs)
                        if header["image_count"] > 1:
                            note = f"{header['image_count']} WFTX images exported"
                        else:
                            note = ""
                    except Exception as exc:
                        kind = "raw"
                        note = f"wftx export failed: {exc}"

                elif kind == "bmp":
                    bmp_size = struct.unpack_from("<I", payload, 2)[0]
                    output_path = source_dir / "bmp" / f"entry_{entry_index:05d}_{entry_offset:08x}.bmp"
                    ensure_dir(output_path.parent)
                    output_path.write_bytes(bytes(payload[:bmp_size]))
                    output = rel_output(output_path, output_root)

                elif kind == "riff":
                    riff_size = struct.unpack_from("<I", payload, 4)[0] + 8
                    riff_size = min(riff_size, len(payload))
                    output_path = source_dir / "riff" / f"entry_{entry_index:05d}_{entry_offset:08x}.riff"
                    ensure_dir(output_path.parent)
                    output_path.write_bytes(bytes(payload[:riff_size]))
                    output = rel_output(output_path, output_root)

                if (kind == "raw" or kind == "ls11" or kind == "link") and dump_raw:
                    output_path = source_dir / kind / f"entry_{entry_index:05d}_{entry_offset:08x}.bin"
                    ensure_dir(output_path.parent)
                    output_path.write_bytes(bytes(payload))
                    output = rel_output(output_path, output_root)

                link_records.append(
                    LinkEntry(
                        index=entry_index,
                        offset=entry_offset,
                        size=entry_size,
                        kind=kind,
                        output=output,
                        note=note,
                    )
                )

    return link_records, wftx_records


def default_media_inputs(media_dir: Path) -> list[Path]:
    candidates = [
        media_dir / "face" / "San11Face00.fce",
        media_dir / "ui" / "Common.wft",
        media_dir / "ui" / "DEB.wft",
        media_dir / "ui" / "DUE.wft",
        media_dir / "ui" / "INI.wft",
        media_dir / "san11pkres.bin",
        media_dir / "san11res1.bin",
    ]
    return [path for path in candidates if path.is_file()]


def process_input(
    input_path: Path,
    output_root: Path,
    *,
    dump_raw: bool,
    limit: int | None,
) -> tuple[list[LinkEntry], list[WftxRecord]]:
    if input_path.is_dir():
        link_records: list[LinkEntry] = []
        wftx_records: list[WftxRecord] = []
        for path in default_media_inputs(input_path):
            links, wftx = process_input(path, output_root, dump_raw=dump_raw, limit=limit)
            link_records.extend(links)
            wftx_records.extend(wftx)
        return link_records, wftx_records

    with input_path.open("rb") as file:
        magic = file.read(8)

    if magic.startswith(LINK_MAGIC):
        return export_link(input_path, output_root, dump_raw=dump_raw, limit=limit)

    if magic == WFTX_MAGIC or input_path.suffix.lower() in {".fce", ".wft"}:
        return [], export_wftx_scan(input_path, output_root, limit=limit)

    return [], []


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Export San11 WPK media resources")
    parser.add_argument(
        "input",
        nargs="?",
        default="../game/San11WPK/media",
        help="Input media directory, LINK .bin, .fce, or .wft file",
    )
    parser.add_argument(
        "-o",
        "--output",
        default="../extracted/resources/output",
        help="Output directory",
    )
    parser.add_argument(
        "--dump-raw",
        action="store_true",
        help="Dump unknown LINK entries as raw .bin files",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit entries/images per processed input, useful for tests",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    input_path = Path(args.input)
    output_root = Path(args.output)
    if not input_path.exists():
        parser.error(f"input path does not exist: {input_path}")

    ensure_dir(output_root)
    link_records, wftx_records = process_input(
        input_path,
        output_root,
        dump_raw=args.dump_raw,
        limit=args.limit,
    )

    write_csv(
        output_root / "link_entries.csv",
        link_records,
        ["index", "offset", "size", "kind", "output", "note"],
    )
    write_csv(
        output_root / "wftx_images.csv",
        wftx_records,
        [
            "source",
            "source_kind",
            "index",
            "offset",
            "declared_size",
            "unknown",
            "width",
            "height",
            "bpp",
            "layer_count",
            "layer_index",
            "exact_size",
            "output",
            "note",
        ],
    )
    write_json(output_root / "link_entries.json", link_records)
    write_json(output_root / "wftx_images.json", wftx_records)

    kind_counts: dict[str, int] = {}
    for record in link_records:
        kind_counts[record.kind] = kind_counts.get(record.kind, 0) + 1

    image_counts: dict[str, int] = {}
    for record in wftx_records:
        key = f"{record.width}x{record.height}x{record.bpp}"
        image_counts[key] = image_counts.get(key, 0) + 1

    print(f"Output: {output_root}")
    print(f"LINK entries recorded: {len(link_records)}")
    for key, count in sorted(kind_counts.items()):
        print(f"  {key}: {count}")
    print(f"WFTX images exported: {len(wftx_records)}")
    for key, count in sorted(image_counts.items()):
        print(f"  {key}: {count}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
