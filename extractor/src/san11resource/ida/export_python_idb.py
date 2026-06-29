from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path
from typing import Any, Callable

try:
    import idb
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "missing dependency: python-idb\n"
        "run with: uv sync --group ida\n"
        "then: uv run python -m san11resource.ida.export_python_idb"
    ) from exc


EXTRACTOR_ROOT = Path(__file__).resolve().parents[3]
IDA_ROOT = EXTRACTOR_ROOT / "ida"
DEFAULT_INPUTS = [
    IDA_ROOT / "input" / "san11pk.idb",
    IDA_ROOT / "input" / "san11pk_dump.exe.idb",
]
DEFAULT_OUT = IDA_ROOT / "data" / "python_idb"


FIELD_OFFSET_RE = re.compile(r"^(?:fld|field)_([0-9A-Fa-f]+)(?:_|$)")


def safe_call(func: Callable[[], Any], default: Any = "") -> Any:
    try:
        return func()
    except Exception:
        return default


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def guess_offset(member_name: str) -> str:
    match = FIELD_OFFSET_RE.match(member_name)
    if not match:
        return ""
    return f"0x{int(match.group(1), 16):x}"


def unique_existing(paths: list[Path]) -> list[Path]:
    result: list[Path] = []
    seen: set[str] = set()
    for path in paths:
        if not path.exists():
            continue
        key = path.name
        if key in seen:
            continue
        seen.add(key)
        result.append(path)
    return result


def export_one(path: Path, out_dir: Path) -> dict[str, Any]:
    source = path.name
    function_rows: list[dict[str, Any]] = []
    name_rows: list[dict[str, Any]] = []
    struct_rows: list[dict[str, Any]] = []
    member_rows: list[dict[str, Any]] = []

    with idb.from_file(str(path)) as db:
        api = idb.IDAPython(db)

        for ea in api.idautils.Functions():
            function_rows.append(
                {
                    "source": source,
                    "ea": f"0x{ea:x}",
                    "name": safe_call(lambda ea=ea: api.idc.GetFunctionName(ea)),
                }
            )

        for ea, name in api.idautils.Names():
            name_rows.append({"source": source, "ea": f"0x{ea:x}", "name": name})

        first_idx = api.ida_struct.get_first_struc_idx()
        last_idx = api.ida_struct.get_last_struc_idx()
        for idx in range(first_idx, last_idx + 1):
            struct = api.ida_struct.get_struc_by_idx(idx)
            if struct is None:
                continue

            struct_name = safe_call(struct.get_name)
            members = list(safe_call(struct.get_members, []))
            struct_rows.append(
                {
                    "source": source,
                    "idx": idx,
                    "nodeid": f"0x{struct.nodeid:x}",
                    "name": struct_name,
                    "member_count": len(members),
                }
            )

            for order, member in enumerate(members):
                member_name = safe_call(member.get_name)
                member_rows.append(
                    {
                        "source": source,
                        "struct": struct_name,
                        "order": order,
                        "offset_guess": guess_offset(member_name),
                        "member": member_name,
                        "fullname": safe_call(member.get_fullname),
                        "comment": safe_call(member.get_member_comment),
                        "repeatable_comment": safe_call(member.get_repeatable_member_comment),
                        "typeinfo_hex": safe_call(
                            lambda member=member: member.get_typeinfo().hex()
                            if member.get_typeinfo() is not None
                            else ""
                        ),
                    }
                )

    prefix = path.stem
    write_csv(out_dir / f"{prefix}_functions.csv", function_rows, ["source", "ea", "name"])
    write_csv(out_dir / f"{prefix}_names.csv", name_rows, ["source", "ea", "name"])
    write_csv(
        out_dir / f"{prefix}_structs.csv",
        struct_rows,
        ["source", "idx", "nodeid", "name", "member_count"],
    )
    write_csv(
        out_dir / f"{prefix}_struct_members.csv",
        member_rows,
        [
            "source",
            "struct",
            "order",
            "offset_guess",
            "member",
            "fullname",
            "comment",
            "repeatable_comment",
            "typeinfo_hex",
        ],
    )

    return {
        "source": source,
        "path": str(path),
        "size": path.stat().st_size,
        "functions": len(function_rows),
        "names": len(name_rows),
        "structs": len(struct_rows),
        "struct_members": len(member_rows),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Export functions, names, and structs from San11 IDB files.")
    parser.add_argument("inputs", nargs="*", type=Path, help="IDB files. Defaults to extractor/ida/input/*.idb.")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="Output directory for CSV and summary files.")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    inputs = unique_existing(args.inputs or DEFAULT_INPUTS)
    if not inputs:
        raise SystemExit("no IDB inputs found; put .idb files under extractor/ida/input/")

    args.out.mkdir(parents=True, exist_ok=True)
    summary = [export_one(path, args.out) for path in inputs]
    (args.out / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    for item in summary:
        print(
            f"{item['source']}: functions={item['functions']} "
            f"names={item['names']} structs={item['structs']} "
            f"struct_members={item['struct_members']}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
