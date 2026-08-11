"""CSV exports alongside every Word deliverable.

The customer explicitly accepts CSV, and it is the format that survives every
tool (Excel, DOORS import, a quick grep). Encoded utf-8-sig so Excel on Windows
opens the em-dashes and ± signs correctly instead of mojibake.
"""
from __future__ import annotations

import csv
import io

from .models import ComplianceResult, GeneratedDoc

COMPLIANCE_COLUMNS = [
    "Section",
    "Req ID",
    "Requirement",
    "Rationale / Description",
    "Applicable Standard(s)",
    "Compliance Approach",
    "Risk / Hazard Addressed",
    "Risk Level",
]

REQSET_COLUMNS = ["Section", "Req ID", "Requirement"]


def _encode(rows: list[list[str]]) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\r\n")
    writer.writerows(rows)
    return buf.getvalue().encode("utf-8-sig")


def compliance_csv(result: ComplianceResult) -> bytes:
    rows: list[list[str]] = [COMPLIANCE_COLUMNS]
    for section in result.sections:
        for row in section.rows:
            rows.append(
                [
                    section.title,
                    row.req_id,
                    row.requirement,
                    row.rationale or "",
                    row.standards or "",
                    row.compliance_approach or "",
                    row.risk_hazard or "",
                    row.risk_level or "",
                ]
            )
    return _encode(rows)


def reqset_csv(doc: GeneratedDoc) -> bytes:
    rows: list[list[str]] = [REQSET_COLUMNS]
    section_title = ""
    for section in doc.sections:
        section_title = section.title
        for row in section.rows:
            rows.append([section_title, row.req_id, row.text])
    return _encode(rows)
