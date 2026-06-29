#!/usr/bin/env python3
"""
Export Sangokushi XI / San11 WPK .fce portrait resources.

The Steam TC San11Face00.fce file contains a FACE header followed by embedded
WFTX0010 image blocks. A valid WFTX block layout is:

    0x00  char[8]  magic: "WFTX0010"
    0x08  uint32   block size, including this 24-byte header
    0x0c  uint32   unknown, observed as 1
    0x10  uint16   width
    0x12  uint16   height
    0x14  uint32   bits per pixel, observed as 24
    0x18  bytes    raw pixel bytes, width * height * (bpp / 8)

The exporter scans for WFTX0010 and validates the size fields, so accidental
matches inside pixel data are ignored.
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
WFTX_HEADER_SIZE = 24
SUPPORTED_BPP = {24}


@dataclass(frozen=True)
class WftxImage:
    index: int
    offset: int
    size: int
    unknown: int
    width: int
    height: int
    bpp: int
    output: str


def parse_face_header(buf: mmap.mmap) -> dict[str, int | str] | None:
    if len(buf) < 20 or buf[:4] != b"FACE":
        return None

    magic, header_size, unknown, value_1, value_2 = struct.unpack_from("<4sIIII", buf, 0)
    return {
        "magic": magic.decode("ascii"),
        "header_size": header_size,
        "unknown": unknown,
        "value_1": value_1,
        "value_2": value_2,
    }


def iter_wftx_offsets(buf: mmap.mmap) -> Iterable[int]:
    pos = 0
    while True:
        offset = buf.find(WFTX_MAGIC, pos)
        if offset == -1:
            return
        yield offset
        pos = offset + 1


def read_wftx_header(buf: mmap.mmap, offset: int) -> tuple[int, int, int, int, int] | None:
    if offset + WFTX_HEADER_SIZE > len(buf):
        return None

    size, unknown, width, height, bpp = struct.unpack_from("<IIHHI", buf, offset + 8)
    bytes_per_pixel = bpp // 8
    expected_size = WFTX_HEADER_SIZE + width * height * bytes_per_pixel

    if bpp not in SUPPORTED_BPP:
        return None
    if width <= 0 or height <= 0:
        return None
    if size != expected_size:
        return None
    if offset + size > len(buf):
        return None

    return size, unknown, width, height, bpp


def decode_pixels(raw: bytes, width: int, height: int, channel_order: str) -> Image.Image:
    mode = "RGB"
    image = Image.frombytes(mode, (width, height), raw)

    if channel_order == "bgr":
        r, g, b = image.split()
        image = Image.merge("RGB", (b, g, r))

    return image


def export_fce(
    input_path: Path,
    output_dir: Path,
    *,
    channel_order: str,
    limit: int | None,
) -> list[WftxImage]:
    output_dir.mkdir(parents=True, exist_ok=True)
    records: list[WftxImage] = []

    with input_path.open("rb") as file:
        with mmap.mmap(file.fileno(), 0, access=mmap.ACCESS_READ) as buf:
            face_header = parse_face_header(buf)
            if face_header:
                (output_dir / "face_header.json").write_text(
                    json.dumps(face_header, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8",
                )

            for offset in iter_wftx_offsets(buf):
                header = read_wftx_header(buf, offset)
                if header is None:
                    continue

                size, unknown, width, height, bpp = header
                image_index = len(records)
                image_dir = output_dir / f"{width}x{height}"
                image_dir.mkdir(exist_ok=True)
                output_path = image_dir / f"{image_index:04d}_{offset:08x}.png"

                pixel_start = offset + WFTX_HEADER_SIZE
                pixel_end = offset + size
                raw = buf[pixel_start:pixel_end]
                image = decode_pixels(raw, width, height, channel_order)
                image.save(output_path)

                records.append(
                    WftxImage(
                        index=image_index,
                        offset=offset,
                        size=size,
                        unknown=unknown,
                        width=width,
                        height=height,
                        bpp=bpp,
                        output=str(output_path.relative_to(output_dir)),
                    )
                )

                if limit is not None and len(records) >= limit:
                    break

    write_manifest(output_dir, records)
    return records


def write_manifest(output_dir: Path, records: list[WftxImage]) -> None:
    csv_path = output_dir / "manifest.csv"
    json_path = output_dir / "manifest.json"

    fields = list(asdict(records[0]).keys()) if records else [
        "index",
        "offset",
        "size",
        "unknown",
        "width",
        "height",
        "bpp",
        "output",
    ]

    with csv_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        for record in records:
            writer.writerow(asdict(record))

    json_path.write_text(
        json.dumps([asdict(record) for record in records], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Export images from San11Face00.fce")
    parser.add_argument(
        "input",
        nargs="?",
        default="../game/San11WPK/media/face/San11Face00.fce",
        help="Path to San11Face00.fce",
    )
    parser.add_argument(
        "-o",
        "--output",
        default="../extracted/faces/output",
        help="Output directory for PNG files and manifests",
    )
    parser.add_argument(
        "--channel-order",
        choices=("rgb", "bgr"),
        default="bgr",
        help="Raw 24-bit channel order. San11Face00.fce is BGR.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Export only the first N valid WFTX images.",
    )
    return parser


def main() -> int:
    parser = build_arg_parser()
    args = parser.parse_args()

    input_path = Path(args.input)
    output_dir = Path(args.output)

    if not input_path.is_file():
        parser.error(f"input file does not exist: {input_path}")

    records = export_fce(
        input_path,
        output_dir,
        channel_order=args.channel_order,
        limit=args.limit,
    )

    size_counts: dict[str, int] = {}
    for record in records:
        key = f"{record.width}x{record.height}x{record.bpp}"
        size_counts[key] = size_counts.get(key, 0) + 1

    print(f"Exported {len(records)} image(s) to {output_dir}")
    for key, count in sorted(size_counts.items()):
        print(f"  {key}: {count}")
    print(f"Manifest: {output_dir / 'manifest.csv'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
