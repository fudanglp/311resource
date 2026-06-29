#!/usr/bin/env python3
"""
Measure byte coverage for San11 LINK resource containers.

Coverage is reported in two layers:

- container coverage: whether the LINK table accounts for every byte in the
  file.
- semantic coverage: whether an entry starts with a format signature that our
  current tools parse structurally, only recognize, or still treat as raw.
"""

from __future__ import annotations

import argparse
import csv
import json
import mmap
import struct
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path


LINK_MAGIC = b"LINK"

PARSED_SIGNATURES = {
    b"WFTX0010": "WFTX image parsed/exported",
    b"WKMD0010": "WKMD model parsed/exported",
    b"AIMG0001": "AIMG metadata parsed/exported",
    b"SHEX0008": "SHEX map-grid parsed/exported",
    b"GCOL0001": "GCOL map texture/grid parsed/exported",
    b"K3ST0006": "K3ST large map channel data parsed/exported",
    b"OBJS0004": "OBJS map object records parsed/exported",
}

RECOGNIZED_SIGNATURES = {
}


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
    for record_offset in record_offsets:
        words = struct.unpack_from("<10I", data, record_offset)
        bytes_per_item = words[2] & 0xFF
        count = words[4]
        data_offset = words[5]
        byte_size = words[6]
        if bytes_per_item not in {1, 2, 4, 8, 12, 16}:
            return None
        if count and count * bytes_per_item != byte_size:
            return None
        if data_offset % 4 != 0 or byte_size % bytes_per_item != 0:
            return None
    return offsets


def detect_buffer_descriptor_entries(buf: mmap.mmap, entries: list[tuple[int, int]]) -> set[int]:
    parsed_entries: set[int] = set()
    for entry in range(1, len(entries)):
        descriptor_offset, descriptor_size = entries[entry]
        if descriptor_size > 4096:
            continue
        if descriptor_size < 48 or descriptor_size % 4 != 0:
            continue
        data_entry = entry - 1
        _data_offset, data_size = entries[data_entry]
        descriptor_data = bytes(buf[descriptor_offset : descriptor_offset + descriptor_size])
        _unknown_00, declared_size = struct.unpack_from("<II", descriptor_data, 0)
        if declared_size != data_size:
            continue
        offsets = parse_descriptor_offsets(descriptor_data)
        if offsets is None:
            continue
        active_offsets = [offset for offset in offsets if offset != 0]
        if not active_offsets:
            continue
        in_bounds = True
        for record_offset in active_offsets:
            words = struct.unpack_from("<10I", descriptor_data, record_offset)
            data_offset = words[5]
            byte_size = words[6]
            if data_offset + byte_size > data_size:
                in_bounds = False
                break
        if in_bounds:
            parsed_entries.update({data_entry, entry})
    return parsed_entries


@dataclass(frozen=True)
class CoverageSummary:
    source: str
    file_size: int
    entry_count: int
    table_bytes: int
    payload_bytes: int
    gap_bytes: int
    container_coverage: float
    parsed_entries: int
    parsed_bytes: int
    parsed_payload_ratio: float
    recognized_entries: int
    recognized_bytes: int
    recognized_payload_ratio: float
    raw_entries: int
    raw_bytes: int
    raw_payload_ratio: float


@dataclass(frozen=True)
class SignatureSummary:
    source: str
    signature_hex: str
    signature_text: str
    status: str
    entry_count: int
    total_bytes: int
    payload_ratio: float
    examples: str


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def read_link_entries(buf: mmap.mmap) -> list[tuple[int, int]]:
    if len(buf) < 16 or buf[:4] != LINK_MAGIC:
        raise ValueError("input is not a LINK container")
    _, count, _, _ = struct.unpack_from("<4sIII", buf, 0)
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


def signature_label(signature: bytes) -> str:
    return "".join(chr(value) if 32 <= value < 127 else "." for value in signature)


def signature_status(signature: bytes) -> str:
    if signature in PARSED_SIGNATURES:
        return "parsed"
    if signature in RECOGNIZED_SIGNATURES:
        return "recognized"
    if signature.startswith(b"KOVS"):
        return "recognized"
    return "raw"


def validates_recognized_structure(buf: mmap.mmap, offset: int, size: int, signature: bytes) -> bool:
    if signature == b"FCVD0022":
        if size < 0x60 or (size - 0x60) % 16 != 0:
            return False
        declared_count = struct.unpack_from("<I", buf, offset + 8)[0]
        record_count = (size - 0x60) // 16
        return declared_count - record_count in {6, 8}
    if signature == b"KSEF0131":
        if size < 12 or (size - 12) % 16 != 0:
            return False
        declared_size = struct.unpack_from("<I", buf, offset + 8)[0]
        return declared_size == size
    if signature in {b"TOD20053", b"NUNO0220"}:
        if size < 16:
            return False
        declared_count = struct.unpack_from("<I", buf, offset + 8)[0]
        return declared_count * 16 == size
    return False


def entry_status(
    index: int,
    signature: bytes,
    parsed_entry_overrides: set[int],
    buf: mmap.mmap,
    offset: int,
    size: int,
) -> str:
    if index in parsed_entry_overrides:
        return "parsed"
    if validates_recognized_structure(buf, offset, size, signature):
        return "parsed"
    return signature_status(signature)


def analyze_file(path: Path) -> tuple[CoverageSummary, list[SignatureSummary]]:
    with path.open("rb") as file:
        with mmap.mmap(file.fileno(), 0, access=mmap.ACCESS_READ) as buf:
            entries = read_link_entries(buf)
            parsed_entry_overrides = detect_buffer_descriptor_entries(buf, entries)
            table_bytes = 16 + len(entries) * 8
            payload_bytes = sum(size for _offset, size in entries)
            gap_bytes = len(buf) - table_bytes - payload_bytes

            signature_counts: Counter[tuple[bytes, str]] = Counter()
            signature_bytes: Counter[tuple[bytes, str]] = Counter()
            examples: dict[tuple[bytes, str], list[tuple[int, int, int]]] = defaultdict(list)
            status_counts: Counter[str] = Counter()
            status_bytes: Counter[str] = Counter()

            for index, (offset, size) in enumerate(entries):
                signature = bytes(buf[offset : offset + min(size, 8)])
                status = entry_status(index, signature, parsed_entry_overrides, buf, offset, size)
                key = (signature, status)
                signature_counts[key] += 1
                signature_bytes[key] += size
                status_counts[status] += 1
                status_bytes[status] += size
                if len(examples[key]) < 5:
                    examples[key].append((index, offset, size))

    parsed_bytes = status_bytes["parsed"]
    recognized_bytes = status_bytes["recognized"]
    raw_bytes = status_bytes["raw"]
    summary = CoverageSummary(
        source=str(path),
        file_size=path.stat().st_size,
        entry_count=len(entries),
        table_bytes=table_bytes,
        payload_bytes=payload_bytes,
        gap_bytes=gap_bytes,
        container_coverage=(table_bytes + payload_bytes) / path.stat().st_size,
        parsed_entries=status_counts["parsed"],
        parsed_bytes=parsed_bytes,
        parsed_payload_ratio=parsed_bytes / payload_bytes,
        recognized_entries=status_counts["recognized"],
        recognized_bytes=recognized_bytes,
        recognized_payload_ratio=recognized_bytes / payload_bytes,
        raw_entries=status_counts["raw"],
        raw_bytes=raw_bytes,
        raw_payload_ratio=raw_bytes / payload_bytes,
    )

    signatures = []
    for (signature, status), total_bytes in signature_bytes.most_common():
        ex = [
            {"entry": entry, "offset": hex(offset), "size": size}
            for entry, offset, size in examples[(signature, status)]
        ]
        signatures.append(
            SignatureSummary(
                source=str(path),
                signature_hex=signature.hex(),
                signature_text=signature_label(signature),
                status=status,
                entry_count=signature_counts[(signature, status)],
                total_bytes=total_bytes,
                payload_ratio=total_bytes / payload_bytes,
                examples=json.dumps(ex, ensure_ascii=False),
            )
        )
    return summary, signatures


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


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Analyze LINK resource byte coverage")
    parser.add_argument(
        "inputs",
        nargs="*",
        default=[
            "../game/San11WPK/media/san11pkres.bin",
            "../game/San11WPK/media/san11res1.bin",
        ],
    )
    parser.add_argument("-o", "--output", default="../extracted/resources/coverage")
    parser.add_argument("--top", type=int, default=20, help="Number of signatures to print per file")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    output_root = Path(args.output)
    summaries: list[CoverageSummary] = []
    signatures: list[SignatureSummary] = []

    for value in args.inputs:
        summary, signature_rows = analyze_file(Path(value))
        summaries.append(summary)
        signatures.extend(signature_rows)
        print(f"\n{summary.source}")
        print(f"  container coverage: {summary.container_coverage:.6%}")
        print(f"  parsed:     {summary.parsed_payload_ratio:.3%} ({summary.parsed_bytes} bytes)")
        print(f"  recognized: {summary.recognized_payload_ratio:.3%} ({summary.recognized_bytes} bytes)")
        print(f"  raw:        {summary.raw_payload_ratio:.3%} ({summary.raw_bytes} bytes)")
        for row in signature_rows[: args.top]:
            print(
                f"    {row.signature_text:8s} {row.status:10s} "
                f"count={row.entry_count:5d} bytes={row.total_bytes:10d} "
                f"ratio={row.payload_ratio:7.3%}"
            )

    write_csv(output_root / "coverage_summary.csv", summaries, list(CoverageSummary.__dataclass_fields__.keys()))
    write_json(output_root / "coverage_summary.json", summaries)
    write_csv(output_root / "signature_summary.csv", signatures, list(SignatureSummary.__dataclass_fields__.keys()))
    write_json(output_root / "signature_summary.json", signatures)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
