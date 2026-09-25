#!/usr/bin/env python3
"""Extract the five homepage bar charts from arXiv:2609.30266v1 as SVGs.

The crop boxes are PDF points and belong to the September 2026 v1 layout.
Recheck them against the paper before using this for a later revision.
Requires Poppler (pdfseparate, pdftocairo) and pdfcrop.
"""

import argparse
import subprocess
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FIGURES = (
    (2, 4, "58 647 538 800"),
    (3, 5, "58 489 540 803"),
    (6, 7, "62 291 534 477"),
    (7, 9, "87 638 505 796"),
    (8, 10, "87 638 505 796"),
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path, help="local copy of arXiv:2609.30266v1")
    args = parser.parse_args()
    source = args.pdf.resolve()
    output = ROOT / "assets"
    output.mkdir(exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="tpc-figures-") as directory:
        temporary = Path(directory)
        for number, page, box in FIGURES:
            single = temporary / f"page-{page}.pdf"
            cropped = temporary / f"figure-{number}.pdf"
            target = output / f"paper-figure-{number}.svg"
            subprocess.run(
                ["pdfseparate", "-f", str(page), "-l", str(page), str(source), str(single)],
                check=True,
            )
            subprocess.run(
                ["pdfcrop", "--quiet", "--bbox", box, "--clip", str(single), str(cropped)],
                check=True,
            )
            subprocess.run(["pdftocairo", "-svg", str(cropped), str(target)], check=True)
            print(target.relative_to(ROOT))


if __name__ == "__main__":
    main()
