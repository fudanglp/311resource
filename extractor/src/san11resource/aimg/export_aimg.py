#!/usr/bin/env python3
"""
Experimental AIMG0001 metadata exporter.

AIMG0001 appears near the horse/action texture group in san11pkres.bin. The
observed layout is:

- 0x00 magic `AIMG0001`
- 0x08 uint32 group count, observed 11
- 0x0c uint32 frame count, observed 6
- 0x10 group_count * frame_count pairs of uint32 offset + uint32 record_count
- record payload: 28 bytes, interpreted as float + three integer x/y points

The exact semantics are still unknown, but the record shape is useful enough to
export tables and simple triangle previews.
"""

from __future__ import annotations

import argparse
import csv
import json
import mmap
import struct
from dataclasses import asdict, dataclass
from pathlib import Path

from PIL import Image, ImageDraw


LINK_MAGIC = b"LINK"
AIMG_MAGIC = b"AIMG0001"
AIMG_RECORD_SIZE = 28


@dataclass(frozen=True)
class AimgSlot:
    source: str
    entry: int
    offset: int
    size: int
    group: int
    frame: int
    record_count: int
    record_offset: int
    preview: str


@dataclass(frozen=True)
class AimgRecord:
    source: str
    entry: int
    group: int
    frame: int
    record_index: int
    value: float
    x0: int
    y0: int
    x1: int
    y1: int
    x2: int
    y2: int


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def read_link_table(buf: mmap.mmap) -> list[tuple[int, int]]:
    if len(buf) < 16 or buf[:4] != LINK_MAGIC:
        raise ValueError("input is not a LINK container")
    _, count, _, _ = struct.unpack_from("<4sIII", buf, 0)
    table_end = 16 + count * 8
    if table_end > len(buf):
        raise ValueError("invalid LINK table")
    return [struct.unpack_from("<II", buf, 16 + index * 8) for index in range(count)]


def parse_aimg(data: bytes) -> tuple[int, int, list[tuple[int, int]], list[list[tuple[float, int, int, int, int, int, int]]]]:
    if not data.startswith(AIMG_MAGIC):
        raise ValueError("not an AIMG0001 block")
    if len(data) < 0x10:
        raise ValueError("AIMG block too small")

    group_count, frame_count = struct.unpack_from("<II", data, 0x08)
    slot_count = group_count * frame_count
    table_end = 0x10 + slot_count * 8
    if table_end > len(data):
        raise ValueError("AIMG slot table exceeds block")

    slots = [struct.unpack_from("<II", data, 0x10 + index * 8) for index in range(slot_count)]
    records_by_slot: list[list[tuple[float, int, int, int, int, int, int]]] = []
    for record_offset, record_count in slots:
        if record_count == 0:
            records_by_slot.append([])
            continue
        end = record_offset + record_count * AIMG_RECORD_SIZE
        if record_offset < table_end or end > len(data):
            raise ValueError(
                f"invalid record span: offset={record_offset:#x}, count={record_count}, size={len(data):#x}"
            )

        records = []
        for record_index in range(record_count):
            base = record_offset + record_index * AIMG_RECORD_SIZE
            records.append(struct.unpack_from("<fiiiiii", data, base))
        records_by_slot.append(records)

    return group_count, frame_count, slots, records_by_slot


def draw_slot_preview(
    output_path: Path,
    records: list[tuple[float, int, int, int, int, int, int]],
    *,
    canvas_size: int,
) -> None:
    image = Image.new("RGBA", (canvas_size, canvas_size), (20, 22, 26, 255))
    draw = ImageDraw.Draw(image, "RGBA")
    grid_color = (70, 76, 86, 120)
    for pos in range(0, canvas_size + 1, 64):
        draw.line((pos, 0, pos, canvas_size), fill=grid_color)
        draw.line((0, pos, canvas_size, pos), fill=grid_color)

    colors = [
        (220, 75, 75, 110),
        (70, 165, 225, 110),
        (95, 195, 125, 110),
        (235, 185, 75, 110),
        (185, 115, 230, 110),
    ]
    for index, (_value, x0, y0, x1, y1, x2, y2) in enumerate(records):
        fill = colors[index % len(colors)]
        outline = fill[:3] + (230,)
        points = [(x0, y0), (x1, y1), (x2, y2)]
        draw.polygon(points, fill=fill, outline=outline)
        for x, y in points:
            draw.ellipse((x - 2, y - 2, x + 2, y + 2), fill=outline)

    ensure_dir(output_path.parent)
    image.save(output_path)


def draw_contact_sheet(
    output_path: Path,
    records_by_slot: list[list[tuple[float, int, int, int, int, int, int]]],
    *,
    group_count: int,
    frame_count: int,
    canvas_size: int,
    cell_size: int = 128,
) -> None:
    sheet = Image.new("RGBA", (frame_count * cell_size, group_count * cell_size), (20, 22, 26, 255))
    colors = [
        (220, 75, 75, 100),
        (70, 165, 225, 100),
        (95, 195, 125, 100),
        (235, 185, 75, 100),
        (185, 115, 230, 100),
    ]
    scale = cell_size / canvas_size
    draw = ImageDraw.Draw(sheet, "RGBA")
    for group in range(group_count):
        for frame in range(frame_count):
            x0 = frame * cell_size
            y0 = group * cell_size
            draw.rectangle((x0, y0, x0 + cell_size - 1, y0 + cell_size - 1), outline=(72, 78, 88, 180))
            draw.text((x0 + 4, y0 + 3), f"{group:02d}/{frame:02d}", fill=(180, 186, 196, 220))
            records = records_by_slot[group * frame_count + frame]
            for index, (_value, ax, ay, bx, by, cx, cy) in enumerate(records):
                fill = colors[index % len(colors)]
                outline = fill[:3] + (230,)
                points = [
                    (x0 + ax * scale, y0 + ay * scale),
                    (x0 + bx * scale, y0 + by * scale),
                    (x0 + cx * scale, y0 + cy * scale),
                ]
                draw.polygon(points, fill=fill, outline=outline)

    ensure_dir(output_path.parent)
    sheet.save(output_path)


def export_entry(
    source: Path,
    data: bytes,
    entry: int,
    offset: int,
    output_root: Path,
    *,
    canvas_size: int,
) -> tuple[list[AimgSlot], list[AimgRecord]]:
    group_count, frame_count, slots, records_by_slot = parse_aimg(data)
    stem = source.stem
    entry_name = f"entry_{entry:05d}_{offset:08x}"
    raw_path = output_root / stem / "aimg" / f"{entry_name}.aimg"
    meta_path = output_root / stem / "meta" / f"{entry_name}.json"
    preview_dir = output_root / stem / "preview" / entry_name
    sheet_path = output_root / stem / "sheet" / f"{entry_name}.png"

    ensure_dir(raw_path.parent)
    raw_path.write_bytes(data)
    draw_contact_sheet(
        sheet_path,
        records_by_slot,
        group_count=group_count,
        frame_count=frame_count,
        canvas_size=canvas_size,
    )

    slot_rows: list[AimgSlot] = []
    record_rows: list[AimgRecord] = []
    for slot_index, ((record_offset, record_count), records) in enumerate(zip(slots, records_by_slot)):
        group = slot_index // frame_count
        frame = slot_index % frame_count
        preview_path = ""
        if records:
            output_path = preview_dir / f"group_{group:02d}_frame_{frame:02d}.png"
            draw_slot_preview(output_path, records, canvas_size=canvas_size)
            preview_path = str(output_path.relative_to(output_root))

        slot_rows.append(
            AimgSlot(
                source=str(source),
                entry=entry,
                offset=offset,
                size=len(data),
                group=group,
                frame=frame,
                record_count=record_count,
                record_offset=record_offset,
                preview=preview_path,
            )
        )
        for record_index, (value, x0, y0, x1, y1, x2, y2) in enumerate(records):
            record_rows.append(
                AimgRecord(
                    source=str(source),
                    entry=entry,
                    group=group,
                    frame=frame,
                    record_index=record_index,
                    value=value,
                    x0=x0,
                    y0=y0,
                    x1=x1,
                    y1=y1,
                    x2=x2,
                    y2=y2,
                )
            )

    ensure_dir(meta_path.parent)
    meta_path.write_text(
        json.dumps(
            {
                "entry": entry,
                "offset": offset,
                "size": len(data),
                "group_count": group_count,
                "frame_count": frame_count,
                "slot_count": len(slots),
                "record_count": len(record_rows),
                "raw": str(raw_path.relative_to(output_root)),
                "sheet": str(sheet_path.relative_to(output_root)),
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return slot_rows, record_rows


def write_csv(path: Path, rows: list[object], fields: list[str]) -> None:
    ensure_dir(path.parent)
    with path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow(asdict(row))


def write_json(path: Path, rows: list[object]) -> None:
    ensure_dir(path.parent)
    path.write_text(
        json.dumps([asdict(row) for row in rows], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


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


def export_link_aimg(
    input_path: Path,
    output_root: Path,
    *,
    entries_filter: set[int] | None,
    canvas_size: int,
) -> tuple[list[AimgSlot], list[AimgRecord]]:
    all_slots: list[AimgSlot] = []
    all_records: list[AimgRecord] = []
    with input_path.open("rb") as file:
        with mmap.mmap(file.fileno(), 0, access=mmap.ACCESS_READ) as buf:
            entries = read_link_table(buf)
            for entry, (offset, size) in enumerate(entries):
                if entries_filter is not None and entry not in entries_filter:
                    continue
                payload = bytes(buf[offset : offset + size])
                if not payload.startswith(AIMG_MAGIC):
                    continue
                try:
                    slots, records = export_entry(
                        input_path,
                        payload,
                        entry,
                        offset,
                        output_root,
                        canvas_size=canvas_size,
                    )
                except Exception as exc:
                    print(f"Skipping entry {entry}: {exc}")
                    continue
                all_slots.extend(slots)
                all_records.extend(records)
    return all_slots, all_records


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Experimental AIMG0001 exporter")
    parser.add_argument(
        "input",
        nargs="?",
        default="../game/San11WPK/media/san11pkres.bin",
        help="LINK container containing AIMG0001 entries",
    )
    parser.add_argument("-o", "--output", default="../extracted/aimg/output", help="Output directory")
    parser.add_argument(
        "--entry",
        action="append",
        help="Only export selected LINK entry index, accepts decimal/hex and comma lists",
    )
    parser.add_argument("--canvas-size", type=int, default=512, help="Debug preview canvas size")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    input_path = Path(args.input)
    output_root = Path(args.output)
    if not input_path.is_file():
        parser.error(f"input file does not exist: {input_path}")

    slots, records = export_link_aimg(
        input_path,
        output_root,
        entries_filter=parse_entry_filter(args.entry),
        canvas_size=args.canvas_size,
    )
    write_csv(output_root / "aimg_slots.csv", slots, list(AimgSlot.__dataclass_fields__.keys()))
    write_csv(output_root / "aimg_records.csv", records, list(AimgRecord.__dataclass_fields__.keys()))
    write_json(output_root / "aimg_slots.json", slots)
    write_json(output_root / "aimg_records.json", records)

    entries = sorted({slot.entry for slot in slots})
    print(f"Exported {len(entries)} AIMG block(s), {len(slots)} slot(s), {len(records)} record(s) to {output_root}")
    for entry in entries:
        entry_slots = [slot for slot in slots if slot.entry == entry]
        entry_records = [record for record in records if record.entry == entry]
        non_empty = sum(1 for slot in entry_slots if slot.record_count)
        print(f"  entry {entry}: slots={len(entry_slots)}, non_empty={non_empty}, records={len(entry_records)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
