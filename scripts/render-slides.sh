#!/usr/bin/env python3
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from pptx import Presentation


def require_tool(name):
    if not shutil.which(name):
        raise SystemExit(f"Required tool not found: {name}")


def write_variant(deck_path, temp_path, filename, remove_text):
    presentation = Presentation(deck_path)
    found = {text: 0 for text in remove_text}
    for shape in presentation.slides[0].shapes:
        if shape.has_text_frame:
            text = shape.text.strip()
            if text in found:
                shape.text = ""
                found[text] += 1
    missing = [text for text, count in found.items() if count != 1]
    if missing:
        raise SystemExit(
            f"Expected one shape for each requested text; missing or duplicated: {missing}"
        )
    presentation.save(temp_path / filename)


def render_pdf(temp_path, filename):
    profile = temp_path / f"profile-{filename}"
    profile.mkdir()
    subprocess.run(
        [
            "libreoffice",
            f"-env:UserInstallation={profile.as_uri()}",
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            str(temp_path),
            str(temp_path / filename),
        ],
        check=True,
    )


def render_page(pdf, prefix, temp_path):
    subprocess.run(
        [
            "pdftoppm",
            "-f",
            "1",
            "-l",
            "1",
            "-singlefile",
            "-jpeg",
            "-jpegopt",
            "quality=90",
            "-r",
            "120",
            str(pdf),
            str(temp_path / prefix),
        ],
        check=True,
    )
    return temp_path / f"{prefix}.jpg"


def main():
    if len(sys.argv) not in (2, 3):
        raise SystemExit(
            f"Usage: {Path(sys.argv[0]).name} <presentation.pptx> [output-directory]"
        )

    deck_path = Path(sys.argv[1]).resolve()
    output = Path(sys.argv[2]) if len(sys.argv) == 3 else Path("public/presentation")
    output.mkdir(parents=True, exist_ok=True)

    for tool in ("libreoffice", "pdftoppm"):
        require_tool(tool)

    presentation = Presentation(deck_path)
    if len(presentation.slides) != 14:
        raise SystemExit(f"Expected 14 slides, found {len(presentation.slides)}")

    with tempfile.TemporaryDirectory() as temp_name:
        temp_path = Path(temp_name)
        shutil.copy2(deck_path, temp_path / "full.pptx")
        write_variant(
            deck_path,
            temp_path,
            "base.pptx",
            {"Linked Lists: Insertion & Deletion", "NullEntity"},
        )
        write_variant(deck_path, temp_path, "title.pptx", {"NullEntity"})

        for filename in ("full.pptx", "base.pptx", "title.pptx"):
            render_pdf(temp_path, filename)

        subprocess.run(
            [
                "pdftoppm",
                "-jpeg",
                "-jpegopt",
                "quality=90",
                "-r",
                "120",
                str(temp_path / "full.pdf"),
                str(temp_path / "slide"),
            ],
            check=True,
        )
        slides = sorted(temp_path.glob("slide-*.jpg"))
        if len(slides) != 14:
            raise SystemExit(f"Expected 14 rendered slides, found {len(slides)}")
        for slide in slides:
            shutil.copy2(slide, output / slide.name)

        base = render_page(temp_path / "base.pdf", "base-render", temp_path)
        title = render_page(temp_path / "title.pdf", "title-render", temp_path)
        shutil.copy2(base, output / "slide-01-base.jpg")
        shutil.copy2(title, output / "slide-01-title.jpg")

    files = sorted(output.glob("slide-*.jpg"))
    if len(files) != 16:
        raise SystemExit(f"Expected 16 slide images, found {len(files)}")
    print(f"Rendered 16 slide images into {output}")


if __name__ == "__main__":
    main()
