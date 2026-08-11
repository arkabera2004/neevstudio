"""Structured extraction of a requirements .docx.

`ingest.parse.extract_text` flattens a document to plain text, which is right for
the breakdown pipeline but useless here: the compliance matrix has to preserve
every requirement ID, its exact wording and the section it sat under. So this
walks the document body in order, tracking headings, and pulls the requirement
tables out as structured sections.

What counts as a requirement table (verified against all four customer files):
exactly 2 columns AND at least one first-cell matching REQ_ID_RE. That single
rule excludes everything that should be excluded — the document-metadata table,
the "Attribute | Description" product-overview table, and every appendix (the
"Recommended Traceability Structure" table is 4 columns, and the DOORS/DHF and
"Suggested Decomposition" appendices are bullet lists with no table at all).
"""
from __future__ import annotations

import io
import re

from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph
from pydantic import BaseModel, Field

from ..ingest.parse import ParseError
from .models import KV, DocType

# SYS-001, HW-ME-001, LBL-IFU-001, SW-FLOW-001 …
REQ_ID_RE = re.compile(r"^[A-Z]{2,4}(-[A-Z]{2,5})?-\d{3}$")

# Leading section numbering: "2. System-Level Product Requirements"
_NUMBER_PREFIX = re.compile(r"^\d+(\.\d+)*\.?\s+")


class ParsedRow(BaseModel):
    req_id: str
    text: str


class ParsedSection(BaseModel):
    title: str
    rows: list[ParsedRow] = Field(default_factory=list)


class ParsedDoc(BaseModel):
    title: str
    subtitle: str | None = None
    doc_type: DocType = "generic"
    product_name: str = "Infusion Pump"
    source_name: str
    metadata: list[KV] = Field(default_factory=list)
    sections: list[ParsedSection] = Field(default_factory=list)

    @property
    def row_count(self) -> int:
        return sum(len(s.rows) for s in self.sections)


def _clean(text: str) -> str:
    """Collapse the newlines Word leaves inside table cells."""
    return " ".join(text.split())


def _strip_number(title: str) -> str:
    return _NUMBER_PREFIX.sub("", title).strip()


def _is_requirement_table(table: Table) -> bool:
    if len(table.columns) != 2:
        return False
    return any(REQ_ID_RE.match(_clean(row.cells[0].text)) for row in table.rows)


def _detect_doc_type(filename: str, metadata: list[KV]) -> DocType:
    name = (filename or "").lower()
    # Order matters: "software" before the bare "sw" check, and labeling before
    # product because "Product Labeling" contains both words.
    if "label" in name:
        return "labeling"
    if "software" in name or re.search(r"\bsw\b", name):
        return "software"
    if "hardware" in name or re.search(r"\bhw\b", name):
        return "hardware"
    if "product" in name or "system" in name or "prd" in name:
        return "product"

    joined = " ".join(f"{kv.label} {kv.value}" for kv in metadata).lower()
    for needle, kind in (
        ("labeling", "labeling"),
        ("labelling", "labeling"),
        ("software", "software"),
        ("hardware", "hardware"),
        ("product", "product"),
    ):
        if needle in joined:
            return kind  # type: ignore[return-value]
    return "generic"


def _product_name(metadata: list[KV], fallback: str) -> str:
    for kv in metadata:
        if kv.label.strip().lower() in ("product name", "product context", "device"):
            value = _clean(kv.value)
            if value:
                # "Volumetric Infusion Pump — sample" → keep the leading phrase.
                return value.split("—")[0].split(" - ")[0].strip()[:80]
    return fallback


def parse_requirements_docx(
    data: bytes,
    filename: str,
    doc_type_override: str | None = None,
) -> ParsedDoc:
    """Parse an uploaded requirements document into ordered sections.

    Raises ParseError when the file is unreadable or contains no requirement
    tables, so the endpoint can fail fast and visibly rather than starting a
    run that is guaranteed to produce nothing.
    """
    try:
        import docx  # python-docx
    except ImportError as exc:  # pragma: no cover - dependency is declared
        raise ParseError("python-docx is not installed on the backend.") from exc

    try:
        document = docx.Document(io.BytesIO(data))
    except Exception as exc:
        raise ParseError(f"Could not read the .docx file: {exc}") from exc

    sections: list[ParsedSection] = []
    metadata: list[KV] = []
    lead_paragraphs: list[str] = []
    current_h1: str | None = None
    current_h2: str | None = None
    seen_heading = False

    for child in document.element.body.iterchildren():
        if child.tag == qn("w:p"):
            paragraph = Paragraph(child, document)
            text = _clean(paragraph.text)
            if not text:
                continue
            style = paragraph.style.name if paragraph.style else ""
            if style.startswith("Heading"):
                seen_heading = True
                if style == "Heading 1":
                    current_h1 = _strip_number(text)
                    current_h2 = None
                elif style == "Heading 2":
                    current_h2 = _strip_number(text)
            elif not seen_heading and len(lead_paragraphs) < 2:
                # Title and subtitle sit above the first heading.
                lead_paragraphs.append(text)

        elif child.tag == qn("w:tbl"):
            table = Table(child, document)
            if _is_requirement_table(table):
                rows = [
                    ParsedRow(req_id=_clean(r.cells[0].text), text=_clean(r.cells[1].text))
                    for r in table.rows
                    if REQ_ID_RE.match(_clean(r.cells[0].text))
                    and _clean(r.cells[1].text)
                ]
                if rows:
                    title = current_h2 or current_h1 or "Requirements"
                    if sections and sections[-1].title == title:
                        sections[-1].rows.extend(rows)  # split table, same section
                    else:
                        sections.append(ParsedSection(title=title, rows=rows))
            elif not seen_heading and not metadata and len(table.columns) == 2:
                # The document-metadata table that opens these documents.
                metadata = [
                    KV(label=_clean(r.cells[0].text), value=_clean(r.cells[1].text))
                    for r in table.rows
                    if _clean(r.cells[0].text)
                ]

    if not sections:
        raise ParseError(
            "No requirement tables found. This importer expects a Word document "
            "with two-column tables of Req ID and Requirement text."
        )

    title = lead_paragraphs[0] if lead_paragraphs else (filename or "Requirements")
    subtitle = lead_paragraphs[1] if len(lead_paragraphs) > 1 else None
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
