from __future__ import annotations

import csv
import json
import mmap
import re
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable


EXTRACTOR_ROOT = Path(__file__).resolve().parents[3]
REPO_ROOT = EXTRACTOR_ROOT.parent
IDA_ROOT = EXTRACTOR_ROOT / "ida"
PYTHON_IDB_ROOT = IDA_ROOT / "data" / "python_idb"
OUTPUT_ROOT = IDA_ROOT / "data" / "resource_hints"
DEFAULT_IDB_INPUT = IDA_ROOT / "input" / "san11pk_dump.exe.idb"

NAMES_CSV = PYTHON_IDB_ROOT / "san11pk_dump.exe_names.csv"
FUNCTIONS_CSV = PYTHON_IDB_ROOT / "san11pk_dump.exe_functions.csv"
STRUCT_MEMBERS_CSV = PYTHON_IDB_ROOT / "san11pk_dump.exe_struct_members.csv"

OBJS_ACTIVE_CSV = REPO_ROOT / "extracted" / "maps" / "candidates" / "objs_active_records.csv"
SHEX_BLOCKS_JSON = REPO_ROOT / "extracted" / "maps" / "output" / "shex_blocks.json"
SHEX_FIELDS_JSON = REPO_ROOT / "extracted" / "maps" / "output" / "shex_fields.json"

SHADOW_RE = re.compile(rb"shadow(\d{2})_[A-Za-z0-9_]+")
SHADOW_SYMBOL_RE = re.compile(r"^aShadow(\d+)")

MAP_SYMBOL_KEYWORDS = (
    "MapGrid",
    "map_grid",
    "struct_map_grid_ARRAY",
    "Coordinate",
    "Facility",
    "GetObjectLimitByType",
    "aHxismapobject",
    "aHxmapobject",
)


@dataclass(frozen=True)
class ShadowName:
    shadow_index: int
    shadow_name: str
    symbol_ea: str = ""
    symbol_name: str = ""


@dataclass(frozen=True)
class ObjsShadowCandidate:
    object_type: int
    record_count: int
    candidate_shadow_name: str
    candidate_basis: str
    groups: str
    rotations: str
    x_min: int
    x_max: int
    y_min: int
    y_max: int
    note: str


@dataclass(frozen=True)
class StructCatalogRow:
    struct: str
    offset: str
    size_guess: str
    field: str
    label: str
    comment: str
    repeatable_comment: str
    typeinfo_hex: str


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as file:
        return list(csv.DictReader(file))


def write_csv(path: Path, rows: Iterable[object], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            data = asdict(row) if not isinstance(row, dict) else row
            writer.writerow(data)


def write_json(path: Path, rows: Iterable[object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = [asdict(row) if not isinstance(row, dict) else row for row in rows]
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def offset_int(value: str) -> int:
    return int(value, 16)


def extract_shadow_strings(idb_path: Path) -> list[tuple[int, str]]:
    if not idb_path.is_file():
        return []

    found: set[tuple[int, str]] = set()
    with idb_path.open("rb") as file:
        with mmap.mmap(file.fileno(), 0, access=mmap.ACCESS_READ) as mm:
            for match in SHADOW_RE.finditer(mm):
                name = match.group(0).decode("ascii", errors="ignore")
                found.add((int(match.group(1)), name))
    return sorted(found)


def collect_shadow_names() -> list[ShadowName]:
    symbol_by_index: dict[int, tuple[str, str]] = {}
    if NAMES_CSV.is_file():
        for row in read_csv(NAMES_CSV):
            match = SHADOW_SYMBOL_RE.match(row["name"])
            if match:
                symbol_by_index[int(match.group(1))] = (row["ea"], row["name"])

    rows: list[ShadowName] = []
    for index, shadow_name in extract_shadow_strings(DEFAULT_IDB_INPUT):
        ea, symbol_name = symbol_by_index.get(index, ("", ""))
        rows.append(ShadowName(index, shadow_name, ea, symbol_name))
    return rows


def build_objs_shadow_candidates(shadow_rows: list[ShadowName]) -> list[ObjsShadowCandidate]:
    if not OBJS_ACTIVE_CSV.is_file():
        return []

    shadow_by_index = {row.shadow_index: row.shadow_name for row in shadow_rows}
    records = read_csv(OBJS_ACTIVE_CSV)
    by_type: dict[int, list[dict[str, str]]] = defaultdict(list)
    for record in records:
        by_type[int(record["object_type"])].append(record)

    rows: list[ObjsShadowCandidate] = []
    for object_type, type_records in sorted(by_type.items()):
        groups = Counter(int(record["group"]) for record in type_records)
        rotations = Counter(round(float(record["rotation"]), 6) for record in type_records)
        xs = [int(record["x"]) for record in type_records]
        ys = [int(record["y"]) for record in type_records]
        shadow_name = shadow_by_index.get(object_type, "")
        rows.append(
            ObjsShadowCandidate(
                object_type=object_type,
                record_count=len(type_records),
                candidate_shadow_name=shadow_name,
                candidate_basis="shadow_index_matches_object_type" if shadow_name else "",
                groups=";".join(f"{key}:{value}" for key, value in sorted(groups.items())),
                rotations=";".join(f"{key:g}:{value}" for key, value in sorted(rotations.items())),
                x_min=min(xs),
                x_max=max(xs),
                y_min=min(ys),
                y_max=max(ys),
                note="candidate only; validate against map scatter plots" if shadow_name else "no shadow string with same numeric index",
            )
        )
    return rows


def build_map_grid_members() -> list[dict[str, str]]:
    members = read_csv(STRUCT_MEMBERS_CSV)
    return [
        {
            "struct": row["struct"],
            "offset": row["offset_guess"],
            "member": row["member"],
            "comment": row["comment"],
            "repeatable_comment": row["repeatable_comment"],
            "typeinfo_hex": row["typeinfo_hex"],
        }
        for row in members
        if row["struct"] == "struc_map_grid"
    ]


def build_map_grid_symbols() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for kind, path in [("function", FUNCTIONS_CSV), ("name", NAMES_CSV)]:
        for row in read_csv(path):
            text = row["name"]
            if any(keyword.lower() in text.lower() for keyword in MAP_SYMBOL_KEYWORDS):
                rows.append({"kind": kind, "ea": row["ea"], "name": row["name"]})
    return rows


def write_map_grid_notes(members: list[dict[str, str]], symbols: list[dict[str, str]]) -> None:
    shex_blocks = json.loads(SHEX_BLOCKS_JSON.read_text(encoding="utf-8")) if SHEX_BLOCKS_JSON.is_file() else []
    shex_fields = json.loads(SHEX_FIELDS_JSON.read_text(encoding="utf-8")) if SHEX_FIELDS_JSON.is_file() else []

    representative_fields = [row for row in shex_fields if row.get("entry") == 4791]
    symbol_lines = "\n".join(
        f"- `{row['ea']}` `{row['name']}` ({row['kind']})"
        for row in symbols
        if row["name"]
        in {
            "struct_map_grid_ARRAY",
            "GetFacilityIDFromMapGridData",
            "GetFacilityPtrFromCoordinate",
            "GetAdjacentCoordinateInDirection",
            "GetAllAccessibleCoordinatesInRange",
            "AreCoordinatesAdjacent",
        }
    )
    member_lines = "\n".join(
        f"- `{row['offset']}` `{row['member']}`"
        + (f": {row['comment'] or row['repeatable_comment']}" if row["comment"] or row["repeatable_comment"] else "")
        for row in members
    )
    field_lines = "\n".join(
        f"- `b{row['field']:02d}`: {row['min_value']}..{row['max_value']}, "
        f"{row['unique_values']} unique, top {row['top_values']}"
        for row in representative_fields
    )
    block_lines = "\n".join(
        f"- `{row['source']}` entry `{row['entry']}`: {row['width']}x{row['height']} * {row['record_size']} bytes"
        for row in shex_blocks
    )

    text = f"""# SHEX0008 and runtime map grid hints

## Resource-side facts

`SHEX0008` is a 200x200 grid with an 11-byte record.

{block_lines}

Representative field stats from `san11pkres.bin` entry `4791`:

{field_lines}

## Runtime-side facts from IDB

IDA contains `struc_map_grid` with five 4-byte fields, so the runtime grid cell is 20 bytes.

{member_lines}

Relevant symbols:

{symbol_lines}

## Working interpretation

- The 11-byte `SHEX0008` record is not a byte-for-byte dump of the 20-byte runtime `struc_map_grid`.
- IDB comments around `struct_map_grid_ARRAY` indicate coordinate packing as low 16 bits = x and high 16 bits = y.
- The same comments imply runtime indexing by 200x200 cells and 5 DWORDs per cell, equivalent to `20 * (x * 200 + y)` bytes.
- A city/facility-related ID appears to be extracted from a runtime grid DWORD by shifting right 5 bits and masking with `0x7f`; verify whether that is `field_0` or `field_4` in the decompiler before naming SHEX fields.
- `SHEX b00` and `b04` are still the best terrain/movement-class candidates. `b01` remains the strongest region/height/index candidate because of its 0..92 range and localized deltas between entries 4791 and 4863.
"""
    (OUTPUT_ROOT / "map_grid_shex_notes.md").write_text(text, encoding="utf-8")


def label_from_field(member: str) -> str:
    return re.sub(r"^fld_[0-9A-Fa-f]+_?", "", member)


def build_struct_catalog(struct_name: str) -> list[StructCatalogRow]:
    members = [row for row in read_csv(STRUCT_MEMBERS_CSV) if row["struct"] == struct_name]
    members.sort(key=lambda row: offset_int(row["offset_guess"]))
    rows: list[StructCatalogRow] = []
    for index, row in enumerate(members):
        current = offset_int(row["offset_guess"])
        if index + 1 < len(members):
            size_guess = str(offset_int(members[index + 1]["offset_guess"]) - current)
        else:
            size_guess = ""
        rows.append(
            StructCatalogRow(
                struct=row["struct"],
                offset=row["offset_guess"],
                size_guess=size_guess,
                field=row["member"],
                label=label_from_field(row["member"]),
                comment=row["comment"],
                repeatable_comment=row["repeatable_comment"],
                typeinfo_hex=row["typeinfo_hex"],
            )
        )
    return rows


def main() -> int:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

    shadow_rows = collect_shadow_names()
    write_csv(
        OUTPUT_ROOT / "shadow_names.csv",
        shadow_rows,
        ["shadow_index", "shadow_name", "symbol_ea", "symbol_name"],
    )
    write_json(OUTPUT_ROOT / "shadow_names.json", shadow_rows)

    objs_rows = build_objs_shadow_candidates(shadow_rows)
    write_csv(
        OUTPUT_ROOT / "objs_shadow_candidates.csv",
        objs_rows,
        [
            "object_type",
            "record_count",
            "candidate_shadow_name",
            "candidate_basis",
            "groups",
            "rotations",
            "x_min",
            "x_max",
            "y_min",
            "y_max",
            "note",
        ],
    )
    write_json(OUTPUT_ROOT / "objs_shadow_candidates.json", objs_rows)

    map_members = build_map_grid_members()
    map_symbols = build_map_grid_symbols()
    write_csv(
        OUTPUT_ROOT / "map_grid_runtime_members.csv",
        map_members,
        ["struct", "offset", "member", "comment", "repeatable_comment", "typeinfo_hex"],
    )
    write_json(OUTPUT_ROOT / "map_grid_runtime_members.json", map_members)
    write_csv(OUTPUT_ROOT / "map_grid_related_symbols.csv", map_symbols, ["kind", "ea", "name"])
    write_json(OUTPUT_ROOT / "map_grid_related_symbols.json", map_symbols)
    write_map_grid_notes(map_members, map_symbols)

    for struct_name in ["struct_person", "struct_skill"]:
        catalog = build_struct_catalog(struct_name)
        stem = struct_name.removeprefix("struct_")
        write_csv(
            OUTPUT_ROOT / f"{stem}_struct_catalog.csv",
            catalog,
            [
                "struct",
                "offset",
                "size_guess",
                "field",
                "label",
                "comment",
                "repeatable_comment",
                "typeinfo_hex",
            ],
        )
        write_json(OUTPUT_ROOT / f"{stem}_struct_catalog.json", catalog)

    summary = {
        "shadow_names": len(shadow_rows),
        "objs_object_types": len(objs_rows),
        "objs_object_types_with_shadow_candidate": sum(1 for row in objs_rows if row.candidate_shadow_name),
        "map_grid_runtime_members": len(map_members),
        "map_grid_related_symbols": len(map_symbols),
        "person_catalog_fields": len(build_struct_catalog("struct_person")),
        "skill_catalog_fields": len(build_struct_catalog("struct_skill")),
    }
    (OUTPUT_ROOT / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    for key, value in summary.items():
        print(f"{key}: {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
