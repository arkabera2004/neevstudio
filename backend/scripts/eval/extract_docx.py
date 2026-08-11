"""Extract requirement tables from generated and reference .docx files.

Two table families:
- Compliance matrix (7 columns): Req ID / Requirement / Rationale / Standards /
  Compliance Approach / Risk-Hazard / Risk Level. Section = nearest heading.
- Requirement set (2 columns): Req ID / Requirement.

CLI: `python scripts/eval/extract_docx.py` extracts the 8 reference deliverables
into eval_runs/reference/*.csv (one-time).
"""
from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.eval.common import EVAL_ROOT, REFERENCE_DIR  # noqa: E402

REQ_ID_RE = re.compile(r"^[A-Z]{2,4}(-[A-Z]{2,5})?-\d{3}$")

MATRIX_FIELDS = [
    "section", "req_id", "requirement", "rationale", "standards",
    "compliance_approach", "risk_hazard", "risk_level",
]
REQSET_FIELDS = ["section", "req_id", "requirement"]


def _iter_blocks(doc: Document):
    body = doc.element.body
    for child in body.iterchildren():
        if child.tag.endswith("}p"):
            yield Paragraph(child, doc)
        elif child.tag.endswith("}tbl"):
            yield Table(child, doc)


def _cell_texts(row) -> list[str]:
    return [" ".join(c.text.split()) for c in row.cells]


def extract_rows(path: Path) -> list[dict]:
    """Return normalized rows from every requirement table in the document."""
    doc = Document(str(path))
    rows: list[dict] = []
    heading = ""
    for block in _iter_blocks(doc):
        if isinstance(block, Paragraph):
            style = (block.style.name or "") if block.style else ""
            text = " ".join(block.text.split())
            if text and ("Heading" in style or style == "Title"):
                heading = text
            continue
        table: Table = block
        if not table.rows:
            continue
        ncols = len(table.rows[0].cells)
        for r in table.rows:
            cells = _cell_texts(r)
            if not cells or not REQ_ID_RE.match(cells[0]):
                continue
            if ncols >= 7:
                rows.append(dict(zip(MATRIX_FIELDS, [heading] + cells[:7])))
            elif ncols == 2:
                rows.append(dict(zip(REQSET_FIELDS, [heading] + cells[:2])))
    return rows


def to_csv(rows: list[dict], out_path: Path) -> None:
    if not rows:
        out_path.write_text("", encoding="utf-8")
        return
    fields = MATRIX_FIELDS if "standards" in rows[0] else REQSET_FIELDS
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", newline="", encoding="utf-8-sig") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    out_dir = EVAL_ROOT / "reference"
    out_dir.mkdir(parents=True, exist_ok=True)
    for docx_path in sorted(REFERENCE_DIR.glob("*.docx")):
        rows = extract_rows(docx_path)
        out = out_dir / (docx_path.stem + ".csv")
        to_csv(rows, out)
        print(f"{docx_path.name}: {len(rows)} rows -> {out.relative_to(EVAL_ROOT.parent)}")


if __name__ == "__main__":
    main()
