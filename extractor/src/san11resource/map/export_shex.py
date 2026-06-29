#!/usr/bin/env python3
"""
Experimental SHEX0008 map-grid exporter.

SHEX0008 entries are exactly 8 + 40000 * 11 bytes:

- 8-byte magic: `SHEX0008`
- 40000 records
- 11 bytes per record

This matches the known runtime map grid dimensions: 200 * 200 cells. In-game
movement uses a staggered square grid: odd/even rows are offset by half a tile,
giving each cell hex-like adjacency. The field semantics are still being
mapped, so the exporter writes raw field images and manifests for visual
comparison.
"""

from __future__ import annotations

import argparse
import csv
import json
import mmap
import struct
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path

from PIL import Image, ImageDraw


LINK_MAGIC = b"LINK"
SHEX_MAGIC = b"SHEX0008"
MAP_WIDTH = 200
MAP_HEIGHT = 200
RECORD_SIZE = 11
RECORD_COUNT = MAP_WIDTH * MAP_HEIGHT
PAYLOAD_SIZE = RECORD_COUNT * RECORD_SIZE
STAGGERED_PREVIEW_SCALE = 4


@dataclass(frozen=True)
class ShexBlock:
    source: str
    entry: int
    offset: int
    size: int
    width: int
    height: int
    record_size: int
    output_dir: str


@dataclass(frozen=True)
class ShexField:
    source: str
    entry: int
    field: int
    min_value: int
    max_value: int
    unique_values: int
    top_values: str
    image: str


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def read_link_entries(buf: mmap.mmap) -> list[tuple[int, int]]:
    if len(buf) < 16 or buf[:4] != LINK_MAGIC:
        raise ValueError("input is not a LINK container")
    _, count, _, _ = struct.unpack_from("<4sIII", buf, 0)
    table_end = 16 + count * 8
    if table_end > len(buf):
        raise ValueError("invalid LINK table")
    return [struct.unpack_from("<II", buf, 16 + index * 8) for index in range(count)]


def parse_shex(data: bytes) -> list[bytes]:
    if not data.startswith(SHEX_MAGIC):
        raise ValueError("not a SHEX0008 block")
    payload = data[8:]
    if len(payload) != PAYLOAD_SIZE:
        raise ValueError(f"unexpected SHEX payload size: {len(payload)}")
    return [payload[index * RECORD_SIZE : (index + 1) * RECORD_SIZE] for index in range(RECORD_COUNT)]


def save_field_image(path: Path, records: list[bytes], field: int) -> None:
    values = bytes(record[field] for record in records)
    image = Image.frombytes("L", (MAP_WIDTH, MAP_HEIGHT), values)
    ensure_dir(path.parent)
    image.save(path)


def save_color_preview(path: Path, records: list[bytes], fields: tuple[int, int, int]) -> None:
    rgb = bytearray()
    channels = [[record[field] for record in records] for field in fields]
    scaled_channels = []
    for channel in channels:
        min_value = min(channel)
        max_value = max(channel)
        if max_value == min_value:
            scaled_channels.append([0 for _value in channel])
        else:
            scaled_channels.append([round((value - min_value) * 255 / (max_value - min_value)) for value in channel])
    for index in range(RECORD_COUNT):
        rgb.extend((scaled_channels[0][index], scaled_channels[1][index], scaled_channels[2][index]))
    image = Image.frombytes("RGB", (MAP_WIDTH, MAP_HEIGHT), bytes(rgb))
    ensure_dir(path.parent)
    image.save(path)


def staggered_x(x: int, y: int) -> float:
    return x + 0.5 * (y & 1)


def save_staggered_color_preview(path: Path, records: list[bytes], fields: tuple[int, int, int]) -> None:
    channels = [[record[field] for record in records] for field in fields]
    scaled_channels = []
    for channel in channels:
        min_value = min(channel)
        max_value = max(channel)
        if max_value == min_value:
            scaled_channels.append([0 for _value in channel])
        else:
            scaled_channels.append([round((value - min_value) * 255 / (max_value - min_value)) for value in channel])

    scale = STAGGERED_PREVIEW_SCALE
    half = scale // 2
    image = Image.new("RGB", (MAP_WIDTH * scale + half, MAP_HEIGHT * scale), (0, 0, 0))
    draw = ImageDraw.Draw(image)
    for index in range(RECORD_COUNT):
        x = index % MAP_WIDTH
        y = index // MAP_WIDTH
        left = x * scale + (half if y & 1 else 0)
        top = y * scale
        color = (scaled_channels[0][index], scaled_channels[1][index], scaled_channels[2][index])
        draw.rectangle((left, top, left + scale - 1, top + scale - 1), fill=color)
    ensure_dir(path.parent)
    image.save(path)


def export_entry(
    source: Path,
    data: bytes,
    entry: int,
    offset: int,
    output_root: Path,
) -> tuple[ShexBlock, list[ShexField]]:
    records = parse_shex(data)
    stem = source.stem
    entry_name = f"entry_{entry:05d}_{offset:08x}"
    output_dir = output_root / stem / entry_name
    ensure_dir(output_dir)

    raw_path = output_dir / f"{entry_name}.shex"
    raw_path.write_bytes(data)

    # A compact cell table is useful for comparing against runtime map-grid
    # dumps, but it is still small enough to write directly.
    csv_path = output_dir / "cells.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["x", "y", "row_parity", "staggered_x"] + [f"b{index:02d}" for index in range(RECORD_SIZE)])
        for index, record in enumerate(records):
            x = index % MAP_WIDTH
            y = index // MAP_WIDTH
            writer.writerow([x, y, y & 1, staggered_x(x, y), *record])

    field_rows: list[ShexField] = []
    for field in range(RECORD_SIZE):
        image_path = output_dir / f"field_{field:02d}.png"
        save_field_image(image_path, records, field)
        values = [record[field] for record in records]
        counter = Counter(values)
        field_rows.append(
            ShexField(
                source=str(source),
                entry=entry,
                field=field,
                min_value=min(values),
                max_value=max(values),
                unique_values=len(counter),
                top_values=json.dumps(counter.most_common(12), ensure_ascii=False),
                image=str(image_path.relative_to(output_root)),
            )
        )

    save_color_preview(output_dir / "preview_b00_b01_b04.png", records, (0, 1, 4))
    save_color_preview(output_dir / "preview_b00_b04_b09.png", records, (0, 4, 9))
    save_staggered_color_preview(output_dir / "preview_staggered_b00_b01_b04.png", records, (0, 1, 4))

    block = ShexBlock(
        source=str(source),
        entry=entry,
        offset=offset,
        size=len(data),
        width=MAP_WIDTH,
        height=MAP_HEIGHT,
        record_size=RECORD_SIZE,
        output_dir=str(output_dir.relative_to(output_root)),
    )
    return block, field_rows


def write_csv(path: Path, rows: list[object], fields: list[str]) -> None:
    ensure_dir(path.parent)
    with path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow(asdict(row))


def write_json(path: Path, rows: list[object]) -> None:
    ensure_dir(path.parent)
    path.write_text(json.dumps([asdict(row) for row in rows], ensure_ascii=False, indent=2) + "\n")


def parse_entry_filter(values: list[str] | None) -> set[int] | None:
    if not values:
        return None
    result = set()
    for value in values:
        for part in value.split(","):
            part = part.strip()
            if part:
                result.add(int(part, 0))
    return result


def export_link_shex(input_path: Path, output_root: Path, entries_filter: set[int] | None) -> tuple[list[ShexBlock], list[ShexField]]:
    blocks: list[ShexBlock] = []
    fields: list[ShexField] = []
    with input_path.open("rb") as file:
        with mmap.mmap(file.fileno(), 0, access=mmap.ACCESS_READ) as buf:
            entries = read_link_entries(buf)
            for entry, (offset, size) in enumerate(entries):
                if entries_filter is not None and entry not in entries_filter:
                    continue
                payload = bytes(buf[offset : offset + size])
                if not payload.startswith(SHEX_MAGIC):
                    continue
                try:
                    block, field_rows = export_entry(input_path, payload, entry, offset, output_root)
                except Exception as exc:
                    print(f"Skipping entry {entry}: {exc}")
                    continue
                blocks.append(block)
                fields.extend(field_rows)
    return blocks, fields


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Experimental SHEX0008 map-grid exporter")
    parser.add_argument(
        "inputs",
        nargs="*",
        default=[
            "../game/San11WPK/media/san11pkres.bin",
            "../game/San11WPK/media/san11res1.bin",
        ],
    )
    parser.add_argument("-o", "--output", default="../extracted/maps/output")
    parser.add_argument("--entry", action="append", help="Only export selected LINK entry indexes")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    output_root = Path(args.output)
    entry_filter = parse_entry_filter(args.entry)
    all_blocks: list[ShexBlock] = []
    all_fields: list[ShexField] = []
    for value in args.inputs:
        blocks, fields = export_link_shex(Path(value), output_root, entry_filter)
        all_blocks.extend(blocks)
        all_fields.extend(fields)

    write_csv(output_root / "shex_blocks.csv", all_blocks, list(ShexBlock.__dataclass_fields__.keys()))
    write_json(output_root / "shex_blocks.json", all_blocks)
    write_csv(output_root / "shex_fields.csv", all_fields, list(ShexField.__dataclass_fields__.keys()))
    write_json(output_root / "shex_fields.json", all_fields)

    print(f"Exported {len(all_blocks)} SHEX block(s) to {output_root}")
    for block in all_blocks:
        print(f"  {block.source} entry {block.entry}: {block.width}x{block.height}x{block.record_size}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
