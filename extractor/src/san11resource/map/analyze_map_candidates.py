#!/usr/bin/env python3
"""
Analyze map-related resource candidates from San11 LINK containers.

This script intentionally keeps names conservative. It exports structural
evidence and preview images for the signatures that cluster around the confirmed
SHEX0008 map-grid block:

- GCOL0001: 8 + 1025 * 1025 * 3 bytes, exported as raw and map-oriented
  RGB/channel images.
- K3ST0006: parsed according to the IDB stage loader as an 8-byte header,
  1025 * 1025 * 8-byte control records, and a 1024 * 1024 * 8-byte auxiliary
  plane.
- OBJS0004: 8 + 65535 * 14 bytes, exported as active 14-byte object records.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import mmap
import struct
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path

from PIL import Image


LINK_MAGIC = b"LINK"
GCOL_MAGIC = b"GCOL0001"
K3ST_MAGIC = b"K3ST0006"
OBJS_MAGIC = b"OBJS0004"
SHEX_MAGIC = b"SHEX0008"
MAP_SIGNATURES = {GCOL_MAGIC, K3ST_MAGIC, OBJS_MAGIC, SHEX_MAGIC}

GCOL_SIZE = 8 + 1025 * 1025 * 3
K3ST_CONTROL_WIDTH = 1025
K3ST_CONTROL_HEIGHT = 1025
K3ST_CONTROL_STRIDE = 8
K3ST_AUX_WIDTH = 1024
K3ST_AUX_HEIGHT = 1024
K3ST_AUX_STRIDE = 8
K3ST_DERIVED_WIDTH = 256
K3ST_DERIVED_HEIGHT = 256
K3ST_DERIVED_STRIDE = 10
K3ST_CONTROL_SIZE = K3ST_CONTROL_WIDTH * K3ST_CONTROL_HEIGHT * K3ST_CONTROL_STRIDE
K3ST_AUX_SIZE = K3ST_AUX_WIDTH * K3ST_AUX_HEIGHT * K3ST_AUX_STRIDE
K3ST_SIZE = 8 + K3ST_CONTROL_SIZE + K3ST_AUX_SIZE
OBJS_RECORD_SIZE = 14
OBJS_RECORD_COUNT = 65535
OBJS_SIZE = 8 + OBJS_RECORD_COUNT * OBJS_RECORD_SIZE


@dataclass(frozen=True)
class CandidateBlock:
    source: str
    entry: int
    offset: int
    size: int
    signature: str
    sha1: str
    entropy_sample: float
    structure: str
    output_dir: str
    notes: str = ""


@dataclass(frozen=True)
class ObjsRecord:
    source: str
    entry: int
    record_index: int
    flag: int
    group: int
    unknown_02: int
    x: int
    y: int
    object_type: int
    rotation: float
    unknown_12: int
    raw_hex: str


@dataclass(frozen=True)
class BufferDescriptor:
    source: str
    descriptor_entry: int
    data_entry: int
    descriptor_offset: int
    data_offset: int
    descriptor_size: int
    data_size: int
    declared_size: int
    unknown_00: int
    stream_count: int
    stream_offsets: str


@dataclass(frozen=True)
class BufferStream:
    source: str
    descriptor_entry: int
    data_entry: int
    stream_index: int
    record_offset: int
    unknown_00: int
    unknown_04: int
    format_flags: int
    count: int
    data_offset: int
    byte_size: int
    bytes_per_item: int
    exact_size: bool
    in_bounds: bool
    raw_hex: str


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


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


def read_link_entries(buf: mmap.mmap) -> list[tuple[int, int]]:
    if len(buf) < 16 or buf[:4] != LINK_MAGIC:
        raise ValueError("input is not a LINK container")
    count = struct.unpack_from("<I", buf, 4)[0]
    table_end = 16 + count * 8
    if table_end > len(buf):
        raise ValueError("invalid LINK table")
    entries = []
    for index in range(count):
        offset, size = struct.unpack_from("<II", buf, 16 + index * 8)
        if offset + size > len(buf):
            raise ValueError(f"entry {index} exceeds file size")
        entries.append((offset, size))
    return entries


def entropy(data: bytes) -> float:
    if not data:
        return 0.0
    counts = Counter(data)
    total = len(data)
    value = 0.0
    for count in counts.values():
        probability = count / total
        value -= probability * math.log2(probability)
    return value


def color_for(value: int) -> tuple[int, int, int]:
    # Deterministic, high-contrast color without external palettes.
    mixed = (value * 0x45D9F3B) & 0xFFFFFFFF
    return (
        64 + (mixed & 0x7F),
        64 + ((mixed >> 8) & 0x7F),
        64 + ((mixed >> 16) & 0x7F),
    )


def save_rgb_and_channels(data: bytes, width: int, height: int, output_dir: Path, stem: str) -> list[str]:
    ensure_dir(output_dir)
    rgb_path = output_dir / f"{stem}_rgb.png"
    rgb_image = Image.frombytes("RGB", (width, height), data)
    rgb_image.save(rgb_path)

    map_rgb_path = output_dir / f"{stem}_map_rgb.png"
    rgb_image.transpose(Image.Transpose.TRANSPOSE).save(map_rgb_path)

    paths = [str(rgb_path), str(map_rgb_path)]
    channel_names = ("r", "g", "b")
    for channel, name in enumerate(channel_names):
        channel_bytes = bytes(data[index] for index in range(channel, len(data), 3))
        channel_path = output_dir / f"{stem}_{name}.png"
        channel_image = Image.frombytes("L", (width, height), channel_bytes)
        channel_image.save(channel_path)
        map_channel_path = output_dir / f"{stem}_map_{name}.png"
        channel_image.transpose(Image.Transpose.TRANSPOSE).save(map_channel_path)
        paths.append(str(channel_path))
        paths.append(str(map_channel_path))
    return paths


def save_grayscale_and_map(data: bytes, width: int, height: int, output_dir: Path, stem: str) -> list[str]:
    ensure_dir(output_dir)
    path = output_dir / f"{stem}.png"
    image = Image.frombytes("L", (width, height), data)
    image.save(path)
    map_path = output_dir / f"{stem}_map.png"
    image.transpose(Image.Transpose.TRANSPOSE).save(map_path)
    return [str(path), str(map_path)]


def expand_k3st_idb_ground_height_byte(control: bytes) -> bytes:
    """Recreate the ordinary-ground byte read by the IDB height helpers.

    `sub_418fb0` expands each 8-byte K3ST control record at `this+0x800008`.
    The vertex helpers read from `this+0x800000 + index*10`, so this is not the
    same record's byte 0. For normal ground it effectively reads the previous
    expanded record's byte 2. Water/river terrain takes a different branch.
    """
    runtime = bytearray(K3ST_CONTROL_WIDTH * K3ST_CONTROL_HEIGHT * 10 + 16)
    for record_index in range(K3ST_CONTROL_WIDTH * K3ST_CONTROL_HEIGHT):
        source_start = record_index * K3ST_CONTROL_STRIDE
        source = control[source_start : source_start + K3ST_CONTROL_STRIDE]
        target_start = 8 + record_index * 10
        runtime[target_start : target_start + 8] = source
        runtime[target_start + 8] = source[0]

    height = bytearray(K3ST_CONTROL_WIDTH * K3ST_CONTROL_HEIGHT)
    for record_index in range(K3ST_CONTROL_WIDTH * K3ST_CONTROL_HEIGHT):
        height[record_index] = runtime[record_index * 10]
    return bytes(height)


def get_k3st_control_b00(control: bytes, x: int, y: int) -> int:
    x = max(0, min(K3ST_CONTROL_WIDTH - 1, x))
    y = max(0, min(K3ST_CONTROL_HEIGHT - 1, y))
    return control[(y * K3ST_CONTROL_WIDTH + x) * K3ST_CONTROL_STRIDE]


def derive_k3st_water_table(control: bytes, aux: bytes) -> bytes:
    derived = bytearray(K3ST_DERIVED_WIDTH * K3ST_DERIVED_HEIGHT * K3ST_DERIVED_STRIDE)
    for y in range(K3ST_DERIVED_HEIGHT):
        for x in range(K3ST_DERIVED_WIDTH):
            derived_offset = (y * K3ST_DERIVED_WIDTH + x) * K3ST_DERIVED_STRIDE
            height = 0
            flags = 0
            for dy in range(4):
                for dx in range(4):
                    aux_index = ((y * 4 + dy) * K3ST_AUX_WIDTH + (x * 4 + dx)) * K3ST_AUX_STRIDE
                    value = struct.unpack_from("<Q", aux, aux_index)[0]
                    candidate_height = (value >> 44) & 0xFF
                    if candidate_height:
                        height = candidate_height
                        flags = ((value >> 52) & 0x03) | 0x04
                        break
                if height:
                    break

            derived[derived_offset + 7] = height
            derived[derived_offset + 9] = flags

            if height:
                mask = 0
                if get_k3st_control_b00(control, x * 4, y * 4) < height:
                    mask |= 0x01
                if get_k3st_control_b00(control, x * 4, y * 4 + 4) < height:
                    mask |= 0x02
                if get_k3st_control_b00(control, x * 4 + 4, y * 4) < height:
                    mask |= 0x04
                if get_k3st_control_b00(control, x * 4 + 4, y * 4 + 4) < height:
                    mask |= 0x08
                derived[derived_offset + 8] = mask

    return bytes(derived)


def save_k3st_channels(data: bytes, output_dir: Path, stem: str) -> list[str]:
    ensure_dir(output_dir)
    control = data[8 : 8 + K3ST_CONTROL_SIZE]
    aux = data[8 + K3ST_CONTROL_SIZE :]
    paths: list[str] = []

    for channel in range(K3ST_CONTROL_STRIDE):
        channel_bytes = bytes(control[index] for index in range(channel, len(control), K3ST_CONTROL_STRIDE))
        paths.extend(
            save_grayscale_and_map(
                channel_bytes,
                K3ST_CONTROL_WIDTH,
                K3ST_CONTROL_HEIGHT,
                output_dir,
                f"{stem}_control_b{channel:02d}",
            )
        )

    idb_ground_height = expand_k3st_idb_ground_height_byte(control)
    paths.extend(
        save_grayscale_and_map(
            idb_ground_height,
            K3ST_CONTROL_WIDTH,
            K3ST_CONTROL_HEIGHT,
            output_dir,
            f"{stem}_idb_ground_height_byte",
        )
    )

    for channel in range(K3ST_AUX_STRIDE):
        channel_bytes = bytes(aux[index] for index in range(channel, len(aux), K3ST_AUX_STRIDE))
        paths.extend(
            save_grayscale_and_map(
                channel_bytes,
                K3ST_AUX_WIDTH,
                K3ST_AUX_HEIGHT,
                output_dir,
                f"{stem}_aux_qword_b{channel:02d}",
            )
        )

    derived = derive_k3st_water_table(control, aux)
    for channel in range(K3ST_DERIVED_STRIDE):
        channel_bytes = bytes(derived[index] for index in range(channel, len(derived), K3ST_DERIVED_STRIDE))
        paths.extend(
            save_grayscale_and_map(
                channel_bytes,
                K3ST_DERIVED_WIDTH,
                K3ST_DERIVED_HEIGHT,
                output_dir,
                f"{stem}_derived_b{channel:02d}",
            )
        )
    return paths


def parse_objs_records(data: bytes, source: Path, entry: int) -> list[ObjsRecord]:
    payload = data[8:]
    rows: list[ObjsRecord] = []
    for record_index in range(OBJS_RECORD_COUNT):
        start = record_index * OBJS_RECORD_SIZE
        record = payload[start : start + OBJS_RECORD_SIZE]
        if not any(record):
            continue

        # The 14-byte stride is exact. The most plausible coordinate fields are
        # little-endian u16 at byte offsets 3 and 5: all active records land in
        # a compact 512-ish map-space range.
        rows.append(
            ObjsRecord(
                source=str(source),
                entry=entry,
                record_index=record_index,
                flag=record[0],
                group=record[1],
                unknown_02=record[2],
                x=struct.unpack_from("<H", record, 3)[0],
                y=struct.unpack_from("<H", record, 5)[0],
                object_type=record[7],
                rotation=struct.unpack_from("<f", record, 8)[0],
                unknown_12=struct.unpack_from("<H", record, 12)[0],
                raw_hex=record.hex(),
            )
        )
    return rows


def save_objs_scatter(rows: list[ObjsRecord], output_dir: Path, stem: str, field: str) -> str:
    ensure_dir(output_dir)
    image = Image.new("RGB", (512, 512), (16, 16, 16))
    pixels = image.load()
    for row in rows:
        if 0 <= row.x < 512 and 0 <= row.y < 512:
            value = getattr(row, field)
            pixels[row.x, row.y] = color_for(int(value))
    path = output_dir / f"{stem}_by_{field}.png"
    image.save(path)
    return str(path)


def analyze_payload(source: Path, entry: int, offset: int, payload: bytes, output_root: Path) -> tuple[CandidateBlock, list[ObjsRecord]]:
    signature = payload[:8]
    stem = f"entry_{entry:05d}_{offset:08x}_{signature.decode('ascii')}"
    output_dir = output_root / source.stem / stem
    ensure_dir(output_dir)

    notes: list[str] = []
    structure = "signature only"
    objs_rows: list[ObjsRecord] = []

    if signature == GCOL_MAGIC and len(payload) == GCOL_SIZE:
        structure = "8-byte magic + 1025*1025*3 bytes"
        image_paths = save_rgb_and_channels(payload[8:], 1025, 1025, output_dir, stem)
        notes.append("images=" + ",".join(Path(path).name for path in image_paths))

    elif signature == K3ST_MAGIC and len(payload) == K3ST_SIZE:
        structure = "8-byte magic + 1025*1025*8 byte control records + 1024*1024*8 byte aux qword plane"
        image_paths = save_k3st_channels(payload, output_dir, stem)
        notes.append("parsed_using_idb_stage_loader=sub_418fb0")
        notes.append("idb_ground_height_byte_matches_0x4176b0/0x417770 ordinary-ground sampling")
        notes.append("derived_b07_matches_water/river auxiliary height byte built by sub_415e20")
        notes.append("derived_b08_matches_control_b00_corner_comparison mask built by sub_415d80")
        notes.append("images=" + ",".join(Path(path).name for path in image_paths))

    elif signature == OBJS_MAGIC and len(payload) == OBJS_SIZE:
        structure = "8-byte magic + 65535*14 byte records"
        objs_rows = parse_objs_records(payload, source, entry)
        active_csv = output_dir / f"{stem}_active_records.csv"
        write_csv(active_csv, objs_rows, list(ObjsRecord.__dataclass_fields__.keys()))
        save_objs_scatter(objs_rows, output_dir, stem, "group")
        save_objs_scatter(objs_rows, output_dir, stem, "object_type")

        groups = Counter(row.group for row in objs_rows).most_common(12)
        rotations = Counter(round(row.rotation, 6) for row in objs_rows).most_common()
        notes.append(f"active_records={len(objs_rows)}")
        notes.append("top_groups=" + json.dumps(groups, ensure_ascii=False))
        notes.append("rotations=" + json.dumps(rotations, ensure_ascii=False))

    elif signature == SHEX_MAGIC:
        structure = "handled by export_shex.py"

    block = CandidateBlock(
        source=str(source),
        entry=entry,
        offset=offset,
        size=len(payload),
        signature=signature.decode("ascii", errors="replace"),
        sha1=hashlib.sha1(payload).hexdigest(),
        entropy_sample=entropy(payload[8 : 8 + min(len(payload) - 8, 200000)]),
        structure=structure,
        output_dir=str(output_dir.relative_to(output_root)),
        notes="; ".join(notes),
    )
    return block, objs_rows


def analyze_file(path: Path, output_root: Path) -> tuple[list[CandidateBlock], list[ObjsRecord]]:
    blocks: list[CandidateBlock] = []
    objs_records: list[ObjsRecord] = []
    with path.open("rb") as file:
        with mmap.mmap(file.fileno(), 0, access=mmap.ACCESS_READ) as buf:
            entries = read_link_entries(buf)
            for entry, (offset, size) in enumerate(entries):
                signature = bytes(buf[offset : offset + min(size, 8)])
                if signature not in MAP_SIGNATURES:
                    continue
                payload = bytes(buf[offset : offset + size])
                block, rows = analyze_payload(path, entry, offset, payload, output_root)
                blocks.append(block)
                objs_records.extend(rows)
    return blocks, objs_records


def parse_descriptor_offsets(data: bytes) -> list[int] | None:
    if len(data) < 48 or len(data) % 4 != 0:
        return None
    values = [struct.unpack_from("<I", data, offset)[0] for offset in range(8, len(data), 4)]
    nonzero_offsets = [value for value in values if 0 < value <= len(data) - 40 and value % 4 == 0]
    if not nonzero_offsets:
        return None
    table_end = min(nonzero_offsets)
    if table_end < 12 or table_end > len(data):
        return None
    offsets = [struct.unpack_from("<I", data, offset)[0] for offset in range(8, table_end, 4)]
    record_offsets = [offset for offset in offsets if offset != 0]
    if not record_offsets:
        return None
    if any(offset + 40 > len(data) for offset in record_offsets):
        return None
    return offsets


def analyze_buffer_descriptors(path: Path) -> tuple[list[BufferDescriptor], list[BufferStream]]:
    descriptors: list[BufferDescriptor] = []
    streams: list[BufferStream] = []
    with path.open("rb") as file:
        with mmap.mmap(file.fileno(), 0, access=mmap.ACCESS_READ) as buf:
            entries = read_link_entries(buf)
            for entry in range(1, len(entries)):
                descriptor_offset, descriptor_size = entries[entry]
                if descriptor_size > 4096:
                    continue
                descriptor_data = bytes(buf[descriptor_offset : descriptor_offset + descriptor_size])
                if len(descriptor_data) < 48 or len(descriptor_data) % 4 != 0:
                    continue

                data_entry = entry - 1
                data_offset, data_size = entries[data_entry]
                unknown_00, declared_size = struct.unpack_from("<II", descriptor_data, 0)
                if declared_size != data_size:
                    continue

                offsets = parse_descriptor_offsets(descriptor_data)
                if offsets is None:
                    continue

                active_offsets = [offset for offset in offsets if offset != 0]
                descriptors.append(
                    BufferDescriptor(
                        source=str(path),
                        descriptor_entry=entry,
                        data_entry=data_entry,
                        descriptor_offset=descriptor_offset,
                        data_offset=data_offset,
                        descriptor_size=descriptor_size,
                        data_size=data_size,
                        declared_size=declared_size,
                        unknown_00=unknown_00,
                        stream_count=len(active_offsets),
                        stream_offsets=json.dumps(active_offsets, ensure_ascii=False),
                    )
                )

                for stream_index, record_offset in enumerate(active_offsets):
                    words = struct.unpack_from("<10I", descriptor_data, record_offset)
                    bytes_per_item = words[2] & 0xFF
                    byte_size = words[6]
                    count = words[4]
                    stream_data_offset = words[5]
                    streams.append(
                        BufferStream(
                            source=str(path),
                            descriptor_entry=entry,
                            data_entry=data_entry,
                            stream_index=stream_index,
                            record_offset=record_offset,
                            unknown_00=words[0],
                            unknown_04=words[1],
                            format_flags=words[2],
                            count=count,
                            data_offset=stream_data_offset,
                            byte_size=byte_size,
                            bytes_per_item=bytes_per_item,
                            exact_size=bool(bytes_per_item and count * bytes_per_item == byte_size),
                            in_bounds=stream_data_offset + byte_size <= data_size,
                            raw_hex=descriptor_data[record_offset : record_offset + 40].hex(),
                        )
                    )
    return descriptors, streams


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Analyze map-related San11 LINK resource candidates")
    parser.add_argument(
        "inputs",
        nargs="*",
        default=[
            "../game/San11WPK/media/san11pkres.bin",
            "../game/San11WPK/media/san11res1.bin",
        ],
    )
    parser.add_argument("-o", "--output", default="../extracted/maps/candidates")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    output_root = Path(args.output)
    blocks: list[CandidateBlock] = []
    objs_records: list[ObjsRecord] = []
    descriptors: list[BufferDescriptor] = []
    streams: list[BufferStream] = []

    for value in args.inputs:
        input_path = Path(value)
        file_blocks, file_objs = analyze_file(input_path, output_root)
        file_descriptors, file_streams = analyze_buffer_descriptors(input_path)
        blocks.extend(file_blocks)
        objs_records.extend(file_objs)
        descriptors.extend(file_descriptors)
        streams.extend(file_streams)

    write_csv(output_root / "map_candidates.csv", blocks, list(CandidateBlock.__dataclass_fields__.keys()))
    write_json(output_root / "map_candidates.json", blocks)
    write_csv(output_root / "objs_active_records.csv", objs_records, list(ObjsRecord.__dataclass_fields__.keys()))
    write_json(output_root / "objs_active_records.json", objs_records)
    write_csv(output_root / "buffer_descriptors.csv", descriptors, list(BufferDescriptor.__dataclass_fields__.keys()))
    write_json(output_root / "buffer_descriptors.json", descriptors)
    write_csv(output_root / "buffer_streams.csv", streams, list(BufferStream.__dataclass_fields__.keys()))
    write_json(output_root / "buffer_streams.json", streams)

    print(f"Analyzed {len(blocks)} map candidate block(s) into {output_root}")
    for block in blocks:
        print(f"  {Path(block.source).name} entry {block.entry}: {block.signature} {block.structure}")
    if objs_records:
        print(f"  OBJS active records: {len(objs_records)}")
    if descriptors:
        print(f"  Buffer descriptors: {len(descriptors)}")
        for descriptor in descriptors:
            print(
                f"    {Path(descriptor.source).name} entry {descriptor.descriptor_entry} "
                f"describes data entry {descriptor.data_entry}: {descriptor.stream_count} stream(s)"
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
