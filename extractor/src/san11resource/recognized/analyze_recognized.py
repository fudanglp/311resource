#!/usr/bin/env python3
"""
Analyze recognized-but-not-fully-semantic San11 resource families.

The goal is to promote entries from "signature only" to reproducible structural
parsing when their size/count rules can be validated.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import mmap
import struct
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path


LINK_MAGIC = b"LINK"
KOVS_MAGIC = b"KOVS"
FCVD_MAGIC = b"FCVD0022"
KSEF_MAGIC = b"KSEF0131"
TOD_MAGIC = b"TOD20053"
NUNO_MAGIC = b"NUNO0220"
CDEF_MAGIC = b"CDEF0120"


@dataclass(frozen=True)
class RecognizedBlock:
    source: str
    entry: int
    offset: int
    size: int
    family: str
    sha1: str
    structure: str
    record_count: int | None
    declared_size: int | None
    exact_size: bool
    notes: str = ""


@dataclass(frozen=True)
class FcvdSampleRecord:
    source: str
    entry: int
    record_index: int
    tag: int
    key: int
    x: float
    y: float
    z: float
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
    return [struct.unpack_from("<II", buf, 16 + index * 8) for index in range(count)]


def signature_family(data: bytes) -> str | None:
    if data.startswith(KOVS_MAGIC):
        return "KOVS"
    for magic in (FCVD_MAGIC, KSEF_MAGIC, TOD_MAGIC, NUNO_MAGIC):
        if data.startswith(magic):
            return magic.decode("ascii")
    return None


def parse_fcvd(source: Path, entry: int, offset: int, data: bytes) -> tuple[RecognizedBlock, list[FcvdSampleRecord]]:
    record_count = (len(data) - 0x60) // 16 if len(data) >= 0x60 else -1
    declared_count = struct.unpack_from("<I", data, 8)[0] if len(data) >= 12 else None
    # Two header variants are present. Both use the same 0x60-byte header and
    # 16-byte record array; the first header count is record_count + 6 or + 8.
    exact_size = (
        len(data) >= 0x60
        and (len(data) - 0x60) % 16 == 0
        and declared_count is not None
        and declared_count - record_count in {6, 8}
    )

    samples: list[FcvdSampleRecord] = []
    if exact_size:
        for record_index in range(min(record_count, 32)):
            record_offset = 0x60 + record_index * 16
            tag, key = struct.unpack_from("<HH", data, record_offset)
            x, y, z = struct.unpack_from("<fff", data, record_offset + 4)
            samples.append(
                FcvdSampleRecord(
                    source=str(source),
                    entry=entry,
                    record_index=record_index,
                    tag=tag,
                    key=key,
                    x=x,
                    y=y,
                    z=z,
                    raw_hex=data[record_offset : record_offset + 16].hex(),
                )
            )

    header_words = [struct.unpack_from("<I", data, pos)[0] for pos in range(8, min(len(data), 0x40), 4)]
    block = RecognizedBlock(
        source=str(source),
        entry=entry,
        offset=offset,
        size=len(data),
        family="FCVD0022",
        sha1=hashlib.sha1(data).hexdigest(),
        structure="0x60-byte header + 16-byte records",
        record_count=record_count if record_count >= 0 else None,
        declared_size=declared_count,
        exact_size=exact_size,
        notes="header_u32=" + json.dumps(header_words, ensure_ascii=False),
    )
    return block, samples


def parse_ksef(source: Path, entry: int, offset: int, data: bytes) -> RecognizedBlock:
    declared_size = struct.unpack_from("<I", data, 8)[0] if len(data) >= 12 else None
    record_count = (len(data) - 12) // 16 if len(data) >= 12 else -1
    exact_size = declared_size == len(data) and len(data) >= 12 and (len(data) - 12) % 16 == 0
    first_record = data[12:28].hex() if len(data) >= 28 else ""
    matrix_floats = []
    if len(data) >= 0x54:
        matrix_floats = [struct.unpack_from("<f", data, pos)[0] for pos in range(0x14, 0x54, 4)]
    return RecognizedBlock(
        source=str(source),
        entry=entry,
        offset=offset,
        size=len(data),
        family="KSEF0131",
        sha1=hashlib.sha1(data).hexdigest(),
        structure="8-byte magic + u32 size + 16-byte records",
        record_count=record_count if record_count >= 0 else None,
        declared_size=declared_size,
        exact_size=exact_size,
        notes=json.dumps({"first_record": first_record, "matrix_floats_0x14": matrix_floats}, ensure_ascii=False),
    )


def parse_16_count_family(source: Path, entry: int, offset: int, data: bytes, family: str) -> RecognizedBlock:
    declared_count = struct.unpack_from("<I", data, 8)[0] if len(data) >= 12 else None
    exact_size = declared_count is not None and declared_count * 16 == len(data)
    notes: dict[str, object] = {}
    if family == "NUNO0220":
        cdef_offset = data.find(CDEF_MAGIC)
        notes["cdef_offset"] = cdef_offset if cdef_offset >= 0 else None
    if family == "TOD20053" and len(data) >= 0x20:
        notes["secondary_count_u32_0c"] = struct.unpack_from("<I", data, 0x0C)[0]
        notes["table_start_u32_1c"] = struct.unpack_from("<I", data, 0x1C)[0]
    return RecognizedBlock(
        source=str(source),
        entry=entry,
        offset=offset,
        size=len(data),
        family=family,
        sha1=hashlib.sha1(data).hexdigest(),
        structure="u32@0x08 count; entry size == count * 16",
        record_count=declared_count,
        declared_size=None,
        exact_size=exact_size,
        notes=json.dumps(notes, ensure_ascii=False),
    )


def parse_kovs(source: Path, entry: int, offset: int, data: bytes) -> RecognizedBlock:
    body_size = struct.unpack_from("<I", data, 4)[0] if len(data) >= 8 else None
    secondary = struct.unpack_from("<I", data, 8)[0] if len(data) >= 12 else None
    body = data[32:] if len(data) >= 32 else b""
    exact_size = body_size == len(body)
    byte_counts = Counter(body[: min(len(body), 65536)])
    top_bytes = byte_counts.most_common(12)
    notes = {
        "secondary_u32_08": secondary,
        "body_offset": 32,
        "body_head_hex": body[:64].hex(),
        "top_body_bytes_sample": top_bytes,
    }
    return RecognizedBlock(
        source=str(source),
        entry=entry,
        offset=offset,
        size=len(data),
        family="KOVS",
        sha1=hashlib.sha1(data).hexdigest(),
        structure="32-byte header + opaque body",
        record_count=None,
        declared_size=body_size,
        exact_size=exact_size,
        notes=json.dumps(notes, ensure_ascii=False),
    )


def analyze_file(path: Path) -> tuple[list[RecognizedBlock], list[FcvdSampleRecord]]:
    blocks: list[RecognizedBlock] = []
    fcvd_samples: list[FcvdSampleRecord] = []
    with path.open("rb") as file:
        with mmap.mmap(file.fileno(), 0, access=mmap.ACCESS_READ) as buf:
            entries = read_link_entries(buf)
            for entry, (offset, size) in enumerate(entries):
                data = bytes(buf[offset : offset + size])
                family = signature_family(data)
                if family is None:
                    continue
                if family == "FCVD0022":
                    block, samples = parse_fcvd(path, entry, offset, data)
                    blocks.append(block)
                    fcvd_samples.extend(samples)
                elif family == "KSEF0131":
                    blocks.append(parse_ksef(path, entry, offset, data))
                elif family in {"TOD20053", "NUNO0220"}:
                    blocks.append(parse_16_count_family(path, entry, offset, data, family))
                elif family == "KOVS":
                    blocks.append(parse_kovs(path, entry, offset, data))
    return blocks, fcvd_samples


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Analyze recognized San11 resource families")
    parser.add_argument(
        "inputs",
        nargs="*",
        default=[
            "../game/San11WPK/media/san11pkres.bin",
            "../game/San11WPK/media/san11res1.bin",
        ],
    )
    parser.add_argument("-o", "--output", default="../extracted/recognized/output")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    output_root = Path(args.output)
    blocks: list[RecognizedBlock] = []
    fcvd_samples: list[FcvdSampleRecord] = []
    for value in args.inputs:
        file_blocks, file_samples = analyze_file(Path(value))
        blocks.extend(file_blocks)
        fcvd_samples.extend(file_samples)

    write_csv(output_root / "recognized_blocks.csv", blocks, list(RecognizedBlock.__dataclass_fields__.keys()))
    write_json(output_root / "recognized_blocks.json", blocks)
    write_csv(output_root / "fcvd_sample_records.csv", fcvd_samples, list(FcvdSampleRecord.__dataclass_fields__.keys()))
    write_json(output_root / "fcvd_sample_records.json", fcvd_samples)

    families = Counter(block.family for block in blocks)
    print(f"Analyzed {len(blocks)} recognized block(s) into {output_root}")
    for family, count in families.most_common():
        exact = sum(1 for block in blocks if block.family == family and block.exact_size)
        print(f"  {family}: {count} block(s), {exact} exact structural match(es)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
