"""Structured extraction of a requirements .pdf.

The companion to `parse_docx.py`. The compliance matrix has to preserve every
requirement ID, its exact wording and the section it sat under, so — exactly as
for .docx — a flat-text extraction (what `ingest.parse` does) is useless here.

These PDFs are Word-exported requirement documents: a title/subtitle, a leading
two-column metadata table, numbered/bold section headings, and fully ruled
two-column requirement tables (`Req ID | Requirement`) that can continue across
page breaks. So this walks every page top-to-bottom, interleaving tables and
heading lines in reading order, and reuses the *same* requirement-table rule as
the .docx parser: a two-column table with at least one first cell matching
`REQ_ID_RE`. Everything downstream (`enrich.run_matrix`, the exporters) only sees
the resulting `ParsedDoc`, so it is oblivious to which format produced it.

Word draws these tables as filled rectangles, not stroke lines, and the shaded
header cells add stray edges that make pdfplumber over-segment the columns. So
rather than trust its automatic column detection, we keep its (reliable) table
bounding boxes and re-derive the column dividers ourselves: the real dividers are
the vertical edges that span most of the table's height, while the header-cell
noise spans only one row (`_dominant_verticals`).
"""
from __future__ import annotations

import io
import re

from ..ingest.parse import ParseError
from .models import KV
from .parse_docx import (
    REQ_ID_RE,
    ParsedDoc,
    ParsedRow,
    ParsedSection,
    _clean,
    _detect_doc_type,
    _product_name,
    _strip_number,
)

# Non-ASCII dashes a PDF text layer may substitute for the hyphen in "SW-001".
_DASHES = ("‐", "‑", "‒", "–", "—", "−")

# Text in the top/bottom page margins is a running header/footer, never a
# section heading — filtered by position so it survives multi-document PDFs
# (each concatenated sub-document carries its own footer on only some pages).
_HEADER_MARGIN = 30.0
_FOOTER_MARGIN = 50.0


# A word hyphenated across a wrapped line ("PCA-\ncapable") must rejoin without
# the space that whitespace-collapsing would otherwise insert.
_HYPHEN_BREAK = re.compile(r"-\s*\n\s*")


def _clean_cell(text: str) -> str:
    """Whitespace-collapse a PDF cell, healing hyphenated line breaks first.

    Same net effect as `parse_docx._clean` for text without wrapped hyphens, so
    the two parsers agree character-for-character on the same requirement.
    """
    return _clean(_HYPHEN_BREAK.sub("-", text))


def _join_fragment(base: str, extra: str) -> str:
    """Append a page-split cell fragment to the requirement it continues.

    No separating space when the break fell on a hyphen ("air-" + "in-line"),
    a space otherwise ("within the" + "active rolling window").
    """
    if not base:
        return extra
    if not extra:
        return base
    return base + extra if base.endswith("-") else f"{base} {extra}"


def _normalize_req_id(cell: str) -> str:
    """Undo the character substitutions a PDF text layer makes to an ID cell.

    Applied only when *matching* the ID — the requirement text is kept verbatim
    (whitespace-collapsed, exactly like the .docx path).
    """
    text = _clean(cell).replace("­", "")  # drop soft hyphens
    for dash in _DASHES:
        text = text.replace(dash, "-")
    return text


def _looks_like_heading(text: str) -> bool:
    """A section heading is short and isn't a sentence.

    Excludes body paragraphs like the leading "Scope: …" blurb while keeping
    "Flow Control Software Requirements" and "1. Software Requirement Set".
    """
    stripped = text.strip()
    if not stripped or stripped.endswith("."):
        return False
    return len(stripped.split()) <= 14


def _line_in_table(line: dict, boxes: list) -> bool:
    """True when a text line sits inside any table's bounding box (its content)."""
    for x0, top, x1, bottom in boxes:
        if line["top"] >= top - 2 and line["bottom"] <= bottom + 2 and line["x0"] < x1 and line["x1"] > x0:
            return True
    return False


def _dominant_verticals(page, bbox, tol: float = 4.0, extent_frac: float = 0.5) -> list[float]:
    """The x of each real column divider in a ruled table.

    Clusters the table's vertical edges by x and keeps only clusters that span at
    least `extent_frac` of the table height — the full-height column lines —
    discarding the short edges that shaded header cells leave behind. Robust to
    tables of any row count, since the test is span coverage, not total length.
    """
    left, top, right, bottom = bbox
    height = bottom - top
    if height <= 0:
        return []

    segs = sorted(
        (e["x0"], e["top"], e["bottom"])
        for e in page.edges
        if e["orientation"] == "v"
        and left - 2 <= e["x0"] <= right + 2
        and e["bottom"] >= top - 2
        and e["top"] <= bottom + 2
    )
    if not segs:
        return []

    clusters: list[dict] = []
    for x, t0, t1 in segs:
        if clusters and x - (clusters[-1]["xsum"] / clusters[-1]["n"]) <= tol:
            c = clusters[-1]
            c["xsum"] += x
            c["n"] += 1
            c["tmin"] = min(c["tmin"], t0)
            c["tmax"] = max(c["tmax"], t1)
        else:
            clusters.append({"xsum": x, "n": 1, "tmin": t0, "tmax": t1})

    kept = [c["xsum"] / c["n"] for c in clusters if (c["tmax"] - c["tmin"]) >= extent_frac * height]
    return sorted(kept)


def _table_grid(page, table) -> tuple[int, list[list[str]]]:
    """(column count, rows) for one table, using our own column dividers.

    Rows are lists of cell strings; missing cells are "". Returns (0, []) if the
    table has no usable column structure.
    """
    xs = _dominant_verticals(page, table.bbox)
    if len(xs) < 2:
        return 0, []
    settings = {
        "vertical_strategy": "explicit",
        "explicit_vertical_lines": xs,
        "horizontal_strategy": "lines",
    }
    try:
        raw = page.crop(table.bbox).extract_table(settings) or []
    except Exception:
        return 0, []
    rows = [[(cell or "") for cell in row] for row in raw]
    return len(xs) - 1, rows


def _build(pdf, filename: str, doc_type_override: str | None) -> ParsedDoc:
    """Walk every page once and assemble a ParsedDoc (possibly with 0 sections)."""
    # Collect reading-order elements: heading lines and requirement/metadata
    # tables, each tagged with (page index, vertical position).
    headings: list[dict] = []
    tables: list[dict] = []
    lead: list[str] = []

    for i, page in enumerate(pdf.pages):
        found = page.find_tables()
        boxes = [t.bbox for t in found]
        footer_y = page.height - _FOOTER_MARGIN

        candidates = []
        for line in page.extract_text_lines(strip=True):
            text = _clean(line.get("text", ""))
            if not text or line["top"] < _HEADER_MARGIN or line["bottom"] > footer_y:
                continue  # running header / footer margin
            if _line_in_table(line, boxes):
                continue  # table-internal text
            candidates.append({"text": text, "top": line["top"]})

        if i == 0:
            # Title / subtitle: the first (≤2) lines above the first table.
            first_top = min((b[1] for b in boxes), default=float("inf"))
            lead = [c["text"] for c in sorted(candidates, key=lambda c: c["top"]) if c["top"] < first_top][:2]

        for c in candidates:
            if c["text"] in lead or not _looks_like_heading(c["text"]):
                continue
            headings.append({"kind": "heading", "page": i, "top": c["top"], "text": c["text"]})

        for table in found:
            ncols, rows = _table_grid(page, table)
            tables.append({"kind": "table", "page": i, "top": table.bbox[1], "ncols": ncols, "rows": rows})

    elements = sorted(headings + tables, key=lambda e: (e["page"], e["top"]))

    sections: list[ParsedSection] = []
    metadata: list[KV] = []
    current_title: str | None = None
    last_row: ParsedRow | None = None  # for cells split across a page break

    for element in elements:
        if element["kind"] == "heading":
            current_title = _strip_number(element["text"])
            continue
        if element["ncols"] != 2:
            continue

        new_rows: list[ParsedRow] = []
        saw_continuation = False
        for row in element["rows"]:
            if len(row) < 2:
                continue
            req_id = _normalize_req_id(row[0])
            text = _clean_cell(row[1])
            if REQ_ID_RE.match(req_id) and text:
                new_rows.append(ParsedRow(req_id=req_id, text=text))
            elif not req_id and text and (new_rows or last_row is not None):
                # An ID-less row is the tail of a requirement whose cell was
                # split across a page break — stitch it back onto that row.
                target = new_rows[-1] if new_rows else last_row
                target.text = _join_fragment(target.text, text)
                saw_continuation = True

        if new_rows:
            title = current_title or "Requirements"
            if sections and sections[-1].title == title:
                sections[-1].rows.extend(new_rows)  # split / cross-page table, same section
            else:
                sections.append(ParsedSection(title=title, rows=new_rows))
            last_row = new_rows[-1]
        elif saw_continuation:
            pass  # nothing but a page-split fragment; already appended to last_row
        elif not metadata and not sections:
            # The document-metadata table that opens these documents. Its labels
            # are vertically centred against multi-line values, so a row can
            # over-segment; pair the two columns by reading order instead, and
            # only trust the result when the counts line up.
            labels = [_clean_cell(row[0]) for row in element["rows"] if row and _clean_cell(row[0])]
            values = [_clean_cell(row[1]) for row in element["rows"] if len(row) >= 2 and _clean_cell(row[1])]
            if labels and len(labels) == len(values):
                metadata = [KV(label=lbl, value=val) for lbl, val in zip(labels, values)]

    title = lead[0] if lead else (filename or "Requirements")
    subtitle = lead[1] if len(lead) > 1 else None
    doc_type = (
        doc_type_override
        if doc_type_override in ("product", "hardware", "software", "labeling")
        else _detect_doc_type(filename, metadata)
    )

    return ParsedDoc(
        title=title,
        subtitle=subtitle,
        doc_type=doc_type,  # type: ignore[arg-type]
        product_name=_product_name(metadata, "Infusion Pump"),
        source_name=filename or "requirements document",
        metadata=metadata,
        sections=sections,
    )


def parse_requirements_pdf(
    data: bytes,
    filename: str,
    doc_type_override: str | None = None,
) -> ParsedDoc:
    """Parse an uploaded requirements PDF into ordered sections.

    Raises ParseError when the file is unreadable (corrupt, encrypted) or holds
    no requirement tables — including scanned/image-only PDFs with no text layer
    — so the endpoint can fail fast and visibly, exactly like the .docx path.
    """
    try:
        import pdfplumber
    except ImportError as exc:  # pragma: no cover - dependency is declared
        raise ParseError("pdfplumber is not installed on the backend.") from exc

    try:
        pdf = pdfplumber.open(io.BytesIO(data))
    except Exception as exc:
        raise ParseError(
            "Could not read the .pdf file — it may be corrupt or password-protected. "
            f"Upload the .docx instead. ({exc})"
        ) from exc

    with pdf:
        parsed = _build(pdf, filename, doc_type_override)

    if not parsed.sections:
        raise ParseError(
            "No requirement tables found in the PDF. This importer expects "
            "two-column tables of Req ID and Requirement text; if this is a "
            "scanned or image-only PDF, upload the .docx instead."
        )

    return parsed
