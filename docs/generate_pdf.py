#!/usr/bin/env python3
"""Dependency-free PDF renderer for the project-understanding brief."""
from __future__ import annotations

import re
import textwrap
import unicodedata
from pathlib import Path

HERE = Path(__file__).parent
SOURCE = HERE / "AI_Financial_Automation_Project_Understanding.md"
OUTPUT = HERE / "AI_Financial_Automation_Project_Understanding.pdf"

PAGE_WIDTH, PAGE_HEIGHT = 595, 842  # A4, points
LEFT, RIGHT, TOP, BOTTOM = 48, 48, 54, 48
BODY_SIZE, SMALL_SIZE = 9.2, 8.0
LEADING = 13


def ascii_text(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "replace").decode()
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def clean(value: str) -> str:
    value = re.sub(r"!\[[^]]*\]\([^)]*\)", "", value)
    value = re.sub(r"\[([^]]+)\]\([^)]*\)", r"\1", value)
    value = re.sub(r"`([^`]+)`", r"\1", value)
    value = value.replace("**", "").replace("*", "")
    return value.strip()


def wrap(value: str, width: int) -> list[str]:
    return textwrap.wrap(value, width=width, break_long_words=False, break_on_hyphens=False) or [""]


def source_lines() -> list[tuple[str, str]]:
    result: list[tuple[str, str]] = []
    in_code = False
    in_front_matter = False
    for raw in SOURCE.read_text().splitlines():
        line = raw.rstrip()
        if line == "---" and (in_front_matter or not result):
            in_front_matter = not in_front_matter
            continue
        if in_front_matter:
            continue
        if line.startswith("```"):
            in_code = not in_code
            if not in_code:
                result.append(("space", ""))
            continue
        if in_code:
            # Mermaid diagrams are represented as readable workflow text in this renderer.
            if line and not line.startswith("flowchart"):
                result.append(("code", clean(re.sub(r"^[A-Za-z]+\[([^]]+)\].*", r"\1", line))))
            continue
        if not line.strip():
            result.append(("space", ""))
        elif line.startswith("# "):
            result.append(("title", clean(line[2:])))
        elif line.startswith("## "):
            result.append(("h2", clean(line[3:])))
        elif line.startswith("### "):
            result.append(("h3", clean(line[4:])))
        elif re.match(r"^[-*] ", line):
            result.append(("bullet", clean(line[2:])))
        elif re.match(r"^\d+\. ", line):
            result.append(("number", clean(line)))
        elif line.startswith("|") and not re.match(r"^\|[- :|]+\|$", line):
            cells = [clean(cell) for cell in line.strip("|").split("|")]
            result.append(("table", "  |  ".join(cells)))
        elif line.startswith("> "):
            result.append(("quote", clean(line[2:])))
        elif line.startswith("---"):
            result.append(("rule", ""))
        else:
            result.append(("body", clean(line)))
    return result


def render() -> bytes:
    pages: list[list[str]] = []
    content: list[str] = []
    y = PAGE_HEIGHT - TOP

    def new_page() -> None:
        nonlocal content, y
        pages.append(content)
        content = []
        y = PAGE_HEIGHT - TOP

    def line(text: str, font: str = "F1", size: float = BODY_SIZE, indent: int = 0, color: str = "0.09 0.13 0.20") -> None:
        nonlocal y
        if y < BOTTOM + 22:
            new_page()
        content.append(f"BT /{font} {size} Tf {color} rg 1 0 0 1 {LEFT + indent} {y:.1f} Tm ({ascii_text(text)}) Tj ET")
        y -= LEADING if size <= 10 else size + 5

    for kind, value in source_lines():
        if kind == "space":
            y -= 4
        elif kind == "title":
            if y < BOTTOM + 60:
                new_page()
            line(value, "F2", 23, 0, "0.03 0.22 0.48")
            y -= 5
        elif kind == "h2":
            if y < BOTTOM + 50:
                new_page()
            y -= 6
            line(value, "F2", 14, 0, "0.03 0.22 0.48")
            content.append(f"0.55 0.70 0.86 RG 0.7 w {LEFT} {y + 5:.1f} m {PAGE_WIDTH - RIGHT} {y + 5:.1f} l S")
            y -= 5
        elif kind == "h3":
            y -= 3
            for part in wrap(value, 82):
                line(part, "F2", 11, 0, "0.04 0.22 0.42")
        elif kind == "bullet":
            parts = wrap(value, 82)
            for index, part in enumerate(parts):
                line(("- " if index == 0 else "  ") + part, "F1", BODY_SIZE, 10)
        elif kind == "number":
            parts = wrap(value, 82)
            for index, part in enumerate(parts):
                line(part, "F1", BODY_SIZE, 10 if index == 0 else 18)
        elif kind == "quote":
            for part in wrap(value, 75):
                line(part, "F3", 10.2, 18, "0.04 0.26 0.50")
            y -= 3
        elif kind == "table":
            for part in wrap(value, 100):
                line(part, "F1", 7.7, 4, "0.10 0.18 0.29")
            y -= 2
        elif kind == "code":
            if value:
                for part in wrap(value, 78):
                    line(part, "F4", 8.1, 14, "0.16 0.26 0.39")
        else:
            for part in wrap(value, 94):
                line(part)

    pages.append(content)

    objects: list[bytes] = []
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    kids = " ".join(f"{index} 0 R" for index in range(3, 3 + len(pages) * 2, 2))
    objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {len(pages)} >>".encode())
    page_ids = []
    for page in pages:
        page_ids.append(len(objects) + 1)
        objects.append(b"")
        stream = ["q"] + page
        footer = f"AI Financial Automation  |  Project Understanding  |  Page {len(page_ids)}"
        stream.append(f"BT /F1 {SMALL_SIZE} Tf 0.35 0.42 0.50 rg 1 0 0 1 {LEFT} 25 Tm ({ascii_text(footer)}) Tj ET")
        stream.append("Q")
        data = "\n".join(stream).encode("latin-1", "replace")
        content_id = len(objects) + 1
        objects.append(f"<< /Length {len(data)} >>\nstream\n".encode() + data + b"\nendstream")
        objects[page_ids[-1] - 1] = f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] /Resources << /Font << /F1 {3 + len(pages) * 2} 0 R /F2 {4 + len(pages) * 2} 0 R /F3 {5 + len(pages) * 2} 0 R /F4 {6 + len(pages) * 2} 0 R >> >> /Contents {content_id} 0 R >>".encode()
    objects.extend([
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
    ])
    buffer = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for number, obj in enumerate(objects, 1):
        offsets.append(len(buffer))
        buffer.extend(f"{number} 0 obj\n".encode())
        buffer.extend(obj)
        buffer.extend(b"\nendobj\n")
    xref = len(buffer)
    buffer.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]:
        buffer.extend(f"{offset:010d} 00000 n \n".encode())
    buffer.extend(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
    return bytes(buffer)


if __name__ == "__main__":
    OUTPUT.write_bytes(render())
    print(f"Created {OUTPUT}")
