#!/usr/bin/env python3
"""
Extract executable stage asset paths and compare them with LINK entries.

This does not prove filename-to-entry binding. It creates a reproducible
evidence table for the next reverse-engineering pass.
"""

from __future__ import annotations

import argparse
import csv
import json
import mmap
import re
import struct
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path


ASCII_RE = re.compile(rb"[\x20-\x7e]{4,}")
LINK_MAGIC = b"LINK"

DEFAULT_EXE = Path("../game/San11WPK/San11WPK.exe")
DEFAULT_LINK = Path("../game/San11WPK/media/san11pkres.bin")
DEFAULT_OUTPUT = Path("../extracted/stage/paths")


@dataclass(frozen=True)
class StagePath:
    source: str
    sequence: int
    offset: int
    path: str
    category: str
    extension: str
    basename: str


@dataclass(frozen=True)
class LinkEntry:
    source: str
    entry: int
    offset: int
    size: int
    signature: str


@dataclass(frozen=True)
class StageCandidate:
    path: str
    candidate_source: str
    candidate_entry: int
    candidate_signature: str
    candidate_size: int
    confidence: str
    basis: str
    notes: str


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def write_csv(path: Path, rows: list[object], fields: list[str]) -> None:
    ensure_dir(path.parent)
    with path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow(asdict(row))


def write_json(path: Path, value: object) -> None:
    ensure_dir(path.parent)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def classify_path(path: str) -> tuple[str, str, str]:
    parts = path.split("/")
    basename = parts[-1]
    category = parts[2] if len(parts) > 3 else "root"
    extension = ""
    if "." in basename:
        extension = "." + basename.rsplit(".", 1)[1].lower()
    return category, extension, basename


def extract_stage_paths(exe_path: Path) -> list[StagePath]:
    rows: list[StagePath] = []
    data = exe_path.read_bytes()
    for match in ASCII_RE.finditer(data):
        text = match.group(0).decode("ascii", errors="ignore")
        normalized = text.replace("\\", "/")
        if not normalized.lower().startswith("media/stage/"):
            continue
        category, extension, basename = classify_path(normalized)
        rows.append(
            StagePath(
                source=str(exe_path),
                sequence=len(rows),
                offset=match.start(),
                path=normalized,
                category=category,
                extension=extension,
                basename=basename,
            )
        )
    return rows


def format_signature(payload: bytes) -> str:
    if payload and all(32 <= byte <= 126 for byte in payload):
        return payload.decode("ascii", errors="ignore")
    return "hex:" + payload.hex()


def read_link_entries(link_path: Path, start: int, end: int) -> list[LinkEntry]:
    with link_path.open("rb") as file:
        with mmap.mmap(file.fileno(), 0, access=mmap.ACCESS_READ) as buf:
            if len(buf) < 16 or buf[:4] != LINK_MAGIC:
                raise ValueError(f"{link_path} is not a LINK container")
            count = struct.unpack_from("<I", buf, 4)[0]
            rows: list[LinkEntry] = []
            last = min(count - 1, end)
            for entry in range(max(0, start), last + 1):
                offset, size = struct.unpack_from("<II", buf, 16 + entry * 8)
                payload = buf[offset : offset + min(size, 8)]
                signature = format_signature(bytes(payload))
                rows.append(
                    LinkEntry(
                        source=str(link_path),
                        entry=entry,
                        offset=offset,
                        size=size,
                        signature=signature,
                    )
                )
    return rows


def entry_by_index(entries: list[LinkEntry]) -> dict[int, LinkEntry]:
    return {entry.entry: entry for entry in entries}


def add_candidate(
    candidates: list[StageCandidate],
    path: str,
    entry: LinkEntry | None,
    confidence: str,
    basis: str,
    notes: str,
) -> None:
    if entry is None:
        return
    candidates.append(
        StageCandidate(
            path=path,
            candidate_source=entry.source,
            candidate_entry=entry.entry,
            candidate_signature=entry.signature,
            candidate_size=entry.size,
            confidence=confidence,
            basis=basis,
            notes=notes,
        )
    )


def build_candidates(paths: list[StagePath], entries: list[LinkEntry]) -> list[StageCandidate]:
    by_entry = entry_by_index(entries)
    candidates: list[StageCandidate] = []

    for path in [row.path for row in paths if row.path == "media/stage/object.sto"]:
        add_candidate(
            candidates,
            path,
            by_entry.get(4805),
            "medium",
            "OBJS0004 is the only parsed object-placement table in the stage cluster",
            "Likely map object table; verify through resource loader xrefs.",
        )

    for path in [row.path for row in paths if row.path == "media/stage/default.hex"]:
        for entry_index in (4791, 4863):
            add_candidate(
                candidates,
                path,
                by_entry.get(entry_index),
                "medium",
                "SHEX0008 is a 200x200 logical-grid block and .hex is the stage grid filename",
                "There are two SHEX blocks; entry 4791 and res1 entry 3 are byte-identical, entry 4863 differs slightly.",
            )

    for path in [row.path for row in paths if row.path == "media/stage/default.stg"]:
        for entry_index in (4864, 4866, 4868):
            add_candidate(
                candidates,
                path,
                by_entry.get(entry_index),
                "low",
                "nearby data-buffer entries follow the second SHEX0008 block",
                "Possible stage renderer buffers; not filename-bound yet.",
            )

    for path in [row.path for row in paths if row.path == "media/stage/default.sef"]:
        add_candidate(
            candidates,
            path,
            by_entry.get(4792),
            "medium",
            "path extension .sef and entry signature SEFF0001 match",
            "Likely filename-to-entry binding by signature and cluster position.",
        )

    for path in [row.path for row in paths if row.path == "media/stage/envinfo.sea"]:
        add_candidate(
            candidates,
            path,
            by_entry.get(4799),
            "medium",
            "envinfo.sea path and SENV0002 signature are both environment-related",
            "Likely filename-to-entry binding by signature and cluster position.",
        )

    for path in [row.path for row in paths if row.path == "media/stage/distantview/distantview.bin"]:
        add_candidate(
            candidates,
            path,
            by_entry.get(4795),
            "medium",
            "distantview.bin path and DIST0002 signature are both distant-view related",
            "Likely metadata for the four seasonal distant-view textures.",
        )

    season_color_paths = [row.path for row in paths if row.path.startswith("media/stage/color_")]
    for path, entry_index in zip(season_color_paths, (4787, 4788, 4789, 4790), strict=False):
        add_candidate(
            candidates,
            path,
            by_entry.get(entry_index),
            "low",
            "four color_*.sea paths and four consecutive GCOL0001 map-color payloads",
            "Extension and signature differ; treat as ordering evidence only.",
        )

    distantview_paths = [
        row.path
        for row in paths
        if row.path.startswith("media/stage/distantview/") and row.path.endswith("_distantview.wft")
    ]
    for path, entry_index in zip(distantview_paths, (4794, 4796, 4797, 4798), strict=False):
        add_candidate(
            candidates,
            path,
            by_entry.get(entry_index),
            "medium",
            "four seasonal distant-view paths and four nearby 512x256 WFTX payloads",
            "Entry 4794 visually looks like a distant mountain/sky panorama.",
        )

    for path in [row.path for row in paths if row.path == "media/stage/hex.wft"]:
        add_candidate(
            candidates,
            path,
            by_entry.get(4804),
            "medium",
            "hex.wft path and entry 4804 is a 256x512 terrain/road/facility label atlas",
            "Visual inspection shows terrain labels and direction glyphs.",
        )

    tree_texture_paths = [row.path for row in paths if row.path.startswith("media/stage/tree/tree_")]
    for path, entry_index in zip(tree_texture_paths, (4840, 4841, 4842, 4843), strict=False):
        add_candidate(
            candidates,
            path,
            by_entry.get(entry_index),
            "medium",
            "four tree season texture paths and four 512x256 RGBA vegetation atlases after tree WKMD entries",
            "Entry 4840 visually looks like a tree/foliage texture atlas.",
        )

    tree_model_paths = [row.path for row in paths if row.path.startswith("media/stage/tree/") and row.extension == ".wkm"]
    for path, entry_index in zip(tree_model_paths, range(4808, 4840), strict=False):
        add_candidate(
            candidates,
            path,
            by_entry.get(entry_index),
            "high",
            "32 tree .wkm paths and 32 consecutive WKMD0010 entries with small tree-like bounds",
            "Still an order-based binding; verify by model previews or loader xrefs.",
        )

    return candidates


def build_summary(paths: list[StagePath], candidates: list[StageCandidate]) -> dict[str, object]:
    return {
        "path_count": len(paths),
        "categories": dict(sorted(Counter(row.category for row in paths).items())),
        "extensions": dict(sorted(Counter(row.extension for row in paths).items())),
        "candidate_count": len(candidates),
        "candidate_confidence": dict(sorted(Counter(row.confidence for row in candidates).items())),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Extract media/stage paths from San11WPK.exe")
    parser.add_argument("exe", nargs="?", type=Path, default=DEFAULT_EXE)
    parser.add_argument("--link", type=Path, default=DEFAULT_LINK)
    parser.add_argument("-o", "--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--entry-start", type=int, default=4778)
    parser.add_argument("--entry-end", type=int, default=4890)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    paths = extract_stage_paths(args.exe)
    entries = read_link_entries(args.link, args.entry_start, args.entry_end) if args.link.is_file() else []
    candidates = build_candidates(paths, entries) if entries else []

    write_csv(args.output / "stage_paths.csv", paths, list(StagePath.__dataclass_fields__.keys()))
    write_json(args.output / "stage_paths.json", [asdict(row) for row in paths])
    if entries:
        write_csv(args.output / "stage_link_entries.csv", entries, list(LinkEntry.__dataclass_fields__.keys()))
        write_json(args.output / "stage_link_entries.json", [asdict(row) for row in entries])
    if candidates:
        write_csv(args.output / "stage_entry_candidates.csv", candidates, list(StageCandidate.__dataclass_fields__.keys()))
        write_json(args.output / "stage_entry_candidates.json", [asdict(row) for row in candidates])
    write_json(args.output / "summary.json", build_summary(paths, candidates))

    print(f"Extracted {len(paths)} stage path(s) into {args.output}")
    if entries:
        print(f"Compared {len(entries)} LINK entry slice row(s)")
    if candidates:
        print(f"Wrote {len(candidates)} candidate binding row(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
