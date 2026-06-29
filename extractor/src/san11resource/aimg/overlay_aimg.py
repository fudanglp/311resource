#!/usr/bin/env python3
"""
Overlay exported AIMG triangle-like records on candidate WFTX texture atlases.

This is a visual reverse-engineering helper. It consumes
`../extracted/aimg/output/aimg_records.csv` plus decoded PNG textures from
`../extracted/resources/output` and writes overlay images for likely atlas layouts.
"""

from __future__ import annotations

import argparse
import csv
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw


@dataclass(frozen=True)
class AimgTriangle:
    entry: int
    group: int
    frame: int
    record_index: int
    value: float
    points: tuple[tuple[int, int], tuple[int, int], tuple[int, int]]


@dataclass(frozen=True)
class Atlas:
    name: str
    image: Image.Image


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def load_records(path: Path) -> dict[int, list[AimgTriangle]]:
    rows: dict[int, list[AimgTriangle]] = defaultdict(list)
    with path.open("r", encoding="utf-8", newline="") as file:
        for row in csv.DictReader(file):
            entry = int(row["entry"])
            triangle = AimgTriangle(
                entry=entry,
                group=int(row["group"]),
                frame=int(row["frame"]),
                record_index=int(row["record_index"]),
                value=float(row["value"]),
                points=(
                    (int(row["x0"]), int(row["y0"])),
                    (int(row["x1"]), int(row["y1"])),
                    (int(row["x2"]), int(row["y2"])),
                ),
            )
            rows[entry].append(triangle)
    return rows


def texture_entry(path: Path) -> int:
    match = re.search(r"entry_(\d+)_", path.name)
    if not match:
        raise ValueError(f"cannot parse texture entry from {path}")
    return int(match.group(1))


def layer_index(path: Path) -> int:
    match = re.search(r"_layer(\d+)\.png$", path.name)
    return int(match.group(1)) if match else -1


def load_textures(texture_dir: Path) -> dict[int, list[Path]]:
    textures: dict[int, list[Path]] = defaultdict(list)
    for path in sorted(texture_dir.glob("entry_*.png")):
        entry = texture_entry(path)
        if 2189 <= entry <= 2195:
            textures[entry].append(path)
    for paths in textures.values():
        paths.sort(key=lambda path: (layer_index(path), path.name))
    return textures


def make_horizontal_pair(name: str, left_path: Path, right_path: Path) -> Atlas:
    left = Image.open(left_path).convert("RGBA")
    right = Image.open(right_path).convert("RGBA")
    width = left.width + right.width
    height = max(left.height, right.height)
    atlas = Image.new("RGBA", (width, height), (24, 26, 30, 255))
    atlas.alpha_composite(left, (0, 0))
    atlas.alpha_composite(right, (left.width, 0))
    return Atlas(name=name, image=atlas)


def make_single(name: str, path: Path) -> Atlas:
    return Atlas(name=name, image=Image.open(path).convert("RGBA"))


def build_atlases(textures: dict[int, list[Path]]) -> list[Atlas]:
    atlases: list[Atlas] = []
    for entry in range(2189, 2195):
        if textures.get(entry):
            atlases.append(make_single(f"{entry}", textures[entry][0]))

    for left, right in [(2189, 2190), (2191, 2192), (2193, 2194)]:
        if textures.get(left) and textures.get(right):
            atlases.append(make_horizontal_pair(f"{left}_{right}_h", textures[left][0], textures[right][0]))

    for path in textures.get(2195, []):
        idx = layer_index(path)
        atlases.append(make_single(f"2195_layer{idx:02d}", path))

    layer_paths = textures.get(2195, [])
    layers_by_index = {layer_index(path): path for path in layer_paths}
    for left, right in [(0, 1), (2, 3), (4, 5), (6, 7)]:
        if left in layers_by_index and right in layers_by_index:
            atlases.append(
                make_horizontal_pair(
                    f"2195_layer{left:02d}_{right:02d}_h",
                    layers_by_index[left],
                    layers_by_index[right],
                )
            )
    return atlases


def draw_overlay(
    atlas: Atlas,
    triangles: list[AimgTriangle],
    *,
    groups: set[int] | None,
    frames: set[int] | None,
) -> Image.Image:
    image = atlas.image.copy()
    tint = Image.new("RGBA", image.size, (0, 0, 0, 72))
    image.alpha_composite(tint)
    draw = ImageDraw.Draw(image, "RGBA")

    colors = [
        (255, 52, 52, 118),
        (0, 195, 255, 118),
        (44, 255, 128, 118),
        (255, 205, 40, 118),
        (210, 95, 255, 118),
        (255, 130, 50, 118),
    ]
    for tri in triangles:
        if groups is not None and tri.group not in groups:
            continue
        if frames is not None and tri.frame not in frames:
            continue
        fill = colors[(tri.group + tri.frame + tri.record_index) % len(colors)]
        outline = fill[:3] + (255,)
        draw.polygon(tri.points, fill=fill, outline=outline)
        for x, y in tri.points:
            draw.ellipse((x - 2, y - 2, x + 2, y + 2), fill=outline)
    return image


def parse_int_set(value: str | None) -> set[int] | None:
    if not value:
        return None
    result = set()
    for part in value.split(","):
        part = part.strip()
        if part:
            result.add(int(part, 0))
    return result


def export_overlays(
    records_csv: Path,
    texture_dir: Path,
    output_dir: Path,
    *,
    entries: set[int] | None,
    groups: set[int] | None,
    frames: set[int] | None,
) -> int:
    records = load_records(records_csv)
    atlases = build_atlases(load_textures(texture_dir))
    count = 0
    for entry, triangles in sorted(records.items()):
        if entries is not None and entry not in entries:
            continue
        for atlas in atlases:
            image = draw_overlay(atlas, triangles, groups=groups, frames=frames)
            out_path = output_dir / f"aimg_{entry:05d}_on_{atlas.name}.png"
            ensure_dir(out_path.parent)
            image.save(out_path)
            count += 1
    return count


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Overlay AIMG records on candidate texture atlases")
    parser.add_argument("--records", default="../extracted/aimg/output/aimg_records.csv")
    parser.add_argument(
        "--texture-dir",
        default="../extracted/resources/output/san11pkres/wftx/256x512_32bpp",
        help="Directory containing decoded entry_02189..entry_02195 PNG files",
    )
    parser.add_argument("-o", "--output", default="../extracted/aimg/overlays")
    parser.add_argument("--entry", help="Only export selected AIMG entry index list")
    parser.add_argument("--group", help="Only draw selected group list")
    parser.add_argument("--frame", help="Only draw selected frame list")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    records_csv = Path(args.records)
    texture_dir = Path(args.texture_dir)
    output_dir = Path(args.output)
    if not records_csv.is_file():
        parser.error(f"records CSV does not exist: {records_csv}")
    if not texture_dir.is_dir():
        parser.error(f"texture directory does not exist: {texture_dir}")

    count = export_overlays(
        records_csv,
        texture_dir,
        output_dir,
        entries=parse_int_set(args.entry),
        groups=parse_int_set(args.group),
        frames=parse_int_set(args.frame),
    )
    print(f"Wrote {count} overlay image(s) to {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
