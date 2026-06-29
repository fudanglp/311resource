from __future__ import annotations

from pathlib import Path

import click

from san11resource import main as extract_main


EXTRACTOR_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = EXTRACTOR_ROOT.parent


@click.group(context_settings={"help_option_names": ["-h", "--help"]})
def main() -> None:
    """San11 resource extraction and analysis command group."""


@main.command("paths")
def paths() -> None:
    """Print the project paths used by the extractor."""
    for name, path in {
        "repo": REPO_ROOT,
        "extractor": EXTRACTOR_ROOT,
        "game": REPO_ROOT / "game" / "San11WPK",
        "extracted": REPO_ROOT / "extracted",
        "package": EXTRACTOR_ROOT / "src" / "san11resource",
        "docs": REPO_ROOT / "docs",
        "viewer": REPO_ROOT / "viewer",
    }.items():
        click.echo(f"{name}: {path}")


@main.command("list-modules")
def list_modules() -> None:
    """List runnable extractor modules."""
    package_root = EXTRACTOR_ROOT / "src" / "san11resource"
    for script in sorted(package_root.glob("*/*.py")):
        if script.name == "__init__.py":
            continue
        module = ".".join(script.relative_to(EXTRACTOR_ROOT / "src").with_suffix("").parts)
        click.echo(f"python -m {module}")


@main.command("extract-all")
@click.option("--clean", is_flag=True, help="先删除 ../extracted，再重新完整导出")
@click.option("--skip-overlays", is_flag=True, help="跳过 AIMG overlay 图片生成")
def extract_all(clean: bool, skip_overlays: bool) -> None:
    """Run the full extraction pipeline."""
    argv = []
    if clean:
        argv.append("--clean")
    if skip_overlays:
        argv.append("--skip-overlays")
    raise SystemExit(extract_main.main_from_args(argv))
