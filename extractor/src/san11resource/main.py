from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


EXTRACTOR_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = EXTRACTOR_ROOT.parent
EXTRACTED_ROOT = REPO_ROOT / "extracted"


@dataclass(frozen=True)
class Step:
    name: str
    args: tuple[str, ...]


STEPS = (
    Step("导出 LINK/WFTX 资源", ("-m", "san11resource.resource.export_resources")),
    Step("分析资源覆盖率", ("-m", "san11resource.resource.analyze_coverage")),
    Step("导出 FCE 人脸", ("-m", "san11resource.face.export_fce")),
    Step(
        "导出 san11pkres WKMD 模型",
        (
            "-m",
            "san11resource.model.export_wkmd",
            "../game/San11WPK/media/san11pkres.bin",
            "-o",
            "../extracted/models/output_pkres",
        ),
    ),
    Step(
        "导出 san11res1 WKMD 模型",
        (
            "-m",
            "san11resource.model.export_wkmd",
            "../game/San11WPK/media/san11res1.bin",
            "-o",
            "../extracted/models/output_res1",
        ),
    ),
    Step("导出 AIMG 元数据", ("-m", "san11resource.aimg.export_aimg")),
    Step("生成 AIMG overlay", ("-m", "san11resource.aimg.overlay_aimg")),
    Step("导出 SHEX 地图格子", ("-m", "san11resource.map.export_shex")),
    Step("分析地图候选资源", ("-m", "san11resource.map.analyze_map_candidates")),
    Step("分析 recognized 资源", ("-m", "san11resource.recognized.analyze_recognized")),
)


MANIFESTS = {
    "resources/output/link_entries.json": "resource_link_entries.json",
    "resources/output/wftx_images.json": "resource_wftx_images.json",
    "resources/coverage/coverage_summary.json": "resource_coverage_summary.json",
    "resources/coverage/signature_summary.json": "resource_signature_summary.json",
    "faces/output/manifest.json": "face_manifest.json",
    "faces/output/face_header.json": "face_header.json",
    "models/output_pkres/wkmd_models.json": "model_wkmd_pkres.json",
    "models/output_res1/wkmd_models.json": "model_wkmd_res1.json",
    "aimg/output/aimg_slots.json": "aimg_slots.json",
    "aimg/output/aimg_records.json": "aimg_records.json",
    "maps/output/shex_blocks.json": "map_shex_blocks.json",
    "maps/output/shex_fields.json": "map_shex_fields.json",
    "maps/candidates/map_candidates.json": "map_candidates.json",
    "maps/candidates/objs_active_records.json": "map_objs_active_records.json",
    "maps/candidates/buffer_descriptors.json": "map_buffer_descriptors.json",
    "maps/candidates/buffer_streams.json": "map_buffer_streams.json",
    "recognized/output/recognized_blocks.json": "recognized_blocks.json",
    "recognized/output/fcvd_sample_records.json": "recognized_fcvd_sample_records.json",
}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="提取全部 San11 已支持资源")
    parser.add_argument(
        "--clean",
        action="store_true",
        help="先删除 ../extracted，再重新完整导出",
    )
    parser.add_argument(
        "--skip-overlays",
        action="store_true",
        help="跳过 AIMG overlay 图片生成",
    )
    return parser


def ensure_inputs() -> None:
    required = (
        REPO_ROOT / "game/San11WPK/media/san11pkres.bin",
        REPO_ROOT / "game/San11WPK/media/san11res1.bin",
        REPO_ROOT / "game/San11WPK/media/face/San11Face00.fce",
    )
    missing = [path for path in required if not path.is_file()]
    if missing:
        for path in missing:
            print(f"缺少输入文件: {path}", file=sys.stderr)
        raise SystemExit(2)


def run_step(index: int, total: int, step: Step) -> None:
    print(f"\n[{index}/{total}] {step.name}", flush=True)
    command = (sys.executable, *step.args)
    subprocess.run(command, cwd=EXTRACTOR_ROOT, check=True)


def collect_manifests() -> None:
    manifests_dir = EXTRACTED_ROOT / "manifests"
    manifests_dir.mkdir(parents=True, exist_ok=True)
    missing: list[Path] = []
    for source_name, target_name in MANIFESTS.items():
        source = EXTRACTED_ROOT / source_name
        target = manifests_dir / target_name
        if not source.is_file():
            missing.append(source)
            continue
        shutil.copy2(source, target)
    if missing:
        print("\n以下 manifest 未生成：", file=sys.stderr)
        for path in missing:
            print(f"  {path}", file=sys.stderr)
        raise SystemExit(1)
    print(f"\nmanifest 已汇总到 {manifests_dir}")


def main_from_args(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    ensure_inputs()

    if args.clean and EXTRACTED_ROOT.exists():
        print(f"删除旧提取结果: {EXTRACTED_ROOT}", flush=True)
        shutil.rmtree(EXTRACTED_ROOT)
    EXTRACTED_ROOT.mkdir(parents=True, exist_ok=True)

    steps = [step for step in STEPS if not (args.skip_overlays and step.name == "生成 AIMG overlay")]
    for index, step in enumerate(steps, start=1):
        run_step(index, len(steps), step)

    collect_manifests()
    print("\n全部提取完成。")
    return 0


def main() -> int:
    return main_from_args()


if __name__ == "__main__":
    raise SystemExit(main())
