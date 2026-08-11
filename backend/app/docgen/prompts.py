"""Prompt construction for both Doc Studio pipelines.

Every contract block below literally contains the word JSON — OpenAI rejects a
`response_format: json_object` request whose prompt never mentions it.
"""
from __future__ import annotations

import json

from ..ingest.grounding import (
    BENCHMARKS,
    STANDARDS_WHITELIST,
    concept_grounding,
    matrix_grounding,
)
from ..ingest.stages import DOMAIN_SCOPE, ENGINEER_ROLE
from .models import GeneratedDoc

# ── Mode A — compliance enrichment ───────────────────────────────────────────
_RISK_RUBRIC = """\
RISK LEVEL — judge the consequence of this requirement FAILING, not its wording:
- High   — a direct patient-harm path: dose delivery and accuracy, occlusion,
           air-in-line, free-flow, bolus/lockout logic, alarm generation, safe-state,
           wrong-route connection, anything that could over- or under-infuse.
- Medium — redundancy, power continuity, workflow, connectivity, logging,
           usability items that could contribute to an error indirectly.
- Low    — identification, legibility, symbol conformance, documentation and
           configuration items with no direct injury path.

CALIBRATION — guard against High-inflation. "Could conceivably contribute to harm"
is Medium, not High; High is reserved for requirements whose failure IS the harm
path with nothing in between. In a well-classified device document roughly half the
rows are High and the rest split Medium/Low — if nearly every row you emit is High,
you are over-calling and the matrix loses its triage value. Power management,
logging, connectivity, diagnostics, update mechanics and configuration display are
Medium or Low unless the specific requirement gates therapy delivery directly. Use
all three levels: a section with no Low rows should make you re-check the
identification/documentation items in it.
Worked examples of the boundary: an occlusion ALARM requirement is High (missed
alarm = harm); the PCB conformal-coating or environmental-vibration requirement
behind it is Medium (failure surfaces as a detectable malfunction first); the
serial-number marking on that PCB is Low. Battery RUNTIME during transport is
Medium (loss of therapy is announced, clinician intervenes); undetected silent
shutdown is the High case. Enclosure, mounting, ingress, cleaning-survivability
and shock/vibration rows default to Medium.
"""


def matrix_chunk_prompt(
    doc_type: str,
    product_name: str,
    section_title: str,
    rows: list[tuple[str, str]],
    missing_only: bool = False,
) -> tuple[str, str]:
    """Build (system, task) for one chunk of requirements in one section."""
    software_field = (
        '\n      "sw_class": "A|B|C",           // IEC 62304 software safety class'
        if doc_type == "software"
        else ""
    )
    software_rule = (
        "\n- sw_class is REQUIRED for every row (IEC 62304 A/B/C per the guidance above)."
        if doc_type == "software"
        else ""
    )

    system = f"""{ENGINEER_ROLE}

You are annotating an EXISTING requirement set for "{product_name}" to produce a
Compliance & Traceability Matrix for the Design History File. The requirements are
already written and approved — you are NOT rewriting them. For each requirement you
add five columns of engineering analysis.

{matrix_grounding(doc_type)}

{_RISK_RUBRIC}

Return ONLY a JSON object of this shape:
{{
  "rows": [
    {{
      "req_id": "exactly the id given to you",
      "rationale": "one sentence: why this requirement exists, in engineering terms",
      "standards": "one or more whitelisted standards separated by '; '",
      "compliance_approach": "one sentence naming a concrete verification method",
      "risk_hazard": "one sentence: the hazard that occurs if this requirement fails",
      "risk_level": "High|Medium|Low"{software_field}
    }}
  ]
}}

Rules:
- Return EXACTLY one object per requirement id listed below — no more, no fewer.
- Do NOT restate, rewrite, summarise or return the requirement text. Only the id.
- Every string is terse and declarative. No hedging, no "should consider", no "TBD".
- rationale explains PURPOSE, risk_hazard explains CONSEQUENCE OF FAILURE. Do not
  write the same sentence twice in different columns.
- compliance_approach must name a real test, analysis, inspection or audit —
  "comply with the standard" is not a compliance approach.{software_rule}
"""

    lead = (
        "These requirement ids were missing from your previous response. Return a row "
        "for EACH of them, in the same JSON shape:"
        if missing_only
        else "Annotate every requirement below."
    )
    body = "\n".join(f"- {req_id}: {text}" for req_id, text in rows)
    task = f"SECTION: {section_title}\n\n{lead}\n\nREQUIREMENTS:\n{body}"
    return system, task


# ── Mode B — document-set generation ─────────────────────────────────────────
_DOC_PLAN: dict[str, dict[str, str]] = {
    "product": {
        "title": "Product Requirements Document",
        "sections": (
            "Exactly these numbered level-1 sections, in this order:\n"
            "  1. Product Overview          — no requirement rows; the overview_table carries it\n"
            "  2. System-Level Requirements — SYS-001…, 7-12 rows\n"
            "  3. Functional Requirements   — FUN-001…, 5-8 rows; if the concept has distinct\n"
            "     therapy/delivery modes, add a level-2 subsection for them\n"
            "  4. Performance Requirements  — PERF-001…, 5-8 rows\n"
            "  5. Alarm Requirements        — ALM-001…, 5-8 rows\n"
            "  6. User Interface Requirements — UI-001…, 5-7 rows\n"
            "  7. Safety Requirements       — SAF-001…, 5-7 rows; MUST include tiered\n"
            "     clinician authentication/authorization for safety-critical parameter\n"
            "     and drug-library changes\n"
            "  8. Battery and Power Requirements — PWR-001…, 4-6 rows\n"
            "  9. Connectivity Requirements — CON-001…, 4-6 rows\n"
            " 10. Reliability Requirements  — REL-001…, 3-5 rows\n"
            " 11. Regulatory Requirements   — REG-001…, 5-7 rows"
        ),
        "extra": (
            "EVERY PERF- row must carry a NUMBER with a unit and, where meaningful, a "
            "range or tolerance (e.g. '0.1 to 1200 mL/h', '±5%', '≥45 dB', "
            "'300/500/900 mmHg'). Take figures from the grounding; where the grounding "
            "has none, state the test method and the parameter to be established rather "
            "than inventing a figure. PERF is for QUANTITATIVE performance only — a "
            "workflow, authorization or interlock condition belongs in FUN or SAF, "
            "never in PERF.\n"
            "The alarm section must include occlusion detection with the selectable "
            "pressure trigger levels from the grounding (300/500/900 mmHg tiers).\n"
            "REG- rows must cite standards with the exact edition strings given in the "
            "citable-standards list (e.g. 'IEC 60601-2-24:2012'), never an undated "
            "family name.\n"
            "Populate overview_table with exactly: Product Name, Intended Use, Primary "
            "Users, Operating Environments, Route of Administration."
        ),
    },
    "hardware": {
        "title": "Hardware Requirements Document",
        "sections": (
            "8-10 numbered level-1 subsystem sections, 4-6 rows each, ids HW-<SUBSYS>-001. "
            "Use subsystem codes such as: ME (mechanical pumping assembly), EE (motor & "
            "drive electronics), SEN (pressure sensing), AIL (air-in-line sensing), CONN "
            "(fluid path connectors — include ISO 80369-6 NRFit where the route is "
            "neuraxial), PCB (main control board), LOCK (access-control hardware, where the "
            "therapy warrants it), PWR (battery & power), UI (user interface & alarm "
            "hardware), ENV (environmental & reliability)."
        ),
        "extra": DOMAIN_SCOPE["HW"],
    },
    "software": {
        "title": "Software Requirements Document",
        "sections": (
            "10-12 numbered level-1 module sections, 4-6 rows each, ids SW-<MODULE>-001. "
            "Use module codes such as: FLOW (delivery/scheduling logic), MODE (mode & "
            "interaction logic), DOSE (dose-limit enforcement), ALM (alarm management), "
            "SEN (sensor processing), UI (user interface), SAFE (safety monitoring & "
            "safe state), ERR (fault handling), LOG (event logging), PWR (power "
            "management), COM (connectivity & drug library), SEC (cybersecurity), UPD "
            "(software update), DATA (data storage), DIAG (diagnostics)."
        ),
        "extra": (
            DOMAIN_SCOPE["SW"]
            + "\nThe cybersecurity module MUST include a requirement for a Software Bill "
            "of Materials (SBOM) and a maintained cybersecurity management plan per "
            "FD&C Act §524B (FDA final guidance, 27 June 2025).\n"
            "The dose-limit module MUST enforce a cumulative cap across ALL delivery "
            "paths (scheduled, patient-demand and clinician-initiated) within a rolling "
            "window — not three independently-timed mechanisms that can stack.\n"
            "EVERY row id in this document is SW-<MODULE>-NNN. Never copy or restate "
            "product-level rows (SYS/FUN/PERF/ALM/UI/SAF/PWR/CON/REG ids) as rows of "
            "this document — product ids may appear ONLY inside a '(Traces to: …)' "
            "reference at the end of a software requirement."
        ),
    },
    "labeling": {
        "title": "Labeling Requirements Document",
        "sections": (
            "4-5 numbered level-1 sections: General Labeling (LBL-001…), Instructions for "
            "Use (LBL-IFU-001…), Symbols (LBL-SYM-001…), Risk and Safety Labeling "
            "(LBL-RISK-001…), plus a therapy-specific section where the route demands one "
            "(e.g. LBL-EPI-001… for neuraxial/epidural). 4-6 rows each."
        ),
        "extra": DOMAIN_SCOPE["LBL"],
    },
}

_SAFETY_BAR = """\
SAFETY CONTENT BAR — where the concept is an infusion/analgesia device, the set must
cover: cumulative dose caps across ALL delivery paths within a rolling window;
bolus/demand interaction logic (lockout intervals, timer re-arming after a clinician
dose); free-flow prevention; air-in-line and occlusion detection with numeric
thresholds; wrong-route protection (NRFit / ISO 80369-6) where the route is neuraxial;
therapy-appropriate toxicity warnings in labelling (e.g. local anaesthetic systemic
toxicity); and tiered authentication for safety-critical parameter changes.
"""


def docset_prompt(
    doc_type: str,
    concept: str,
    product_name: str | None = None,
    product_doc: GeneratedDoc | None = None,
    hardware_sections: list[str] | None = None,
) -> tuple[str, str]:
    """Build (system, task) for one document in the chained set."""
    plan = _DOC_PLAN[doc_type]
    overview_field = (
        '\n  "overview_table": [{"label": "Product Name", "value": "..."}],'
        if doc_type == "product"
        else ""
    )
    lead_field = "purpose" if doc_type == "product" else "scope"

    trace_rule = (
        ""
        if doc_type == "product"
        else (
            "\nTRACEABILITY: where a requirement implements a product-level requirement, "
            "end its text with ' (Traces to: SYS-0NN)' using an id that genuinely exists "
            "in the product document below. Do not invent ids, and do not force a trace "
            "onto a requirement that has no natural parent."
        )
    )

    system = f"""{ENGINEER_ROLE}

TASK: write the {plan['title']} for the concept below, as a flat requirement set
ready for a Design History File.

{concept_grounding(concept)}

{BENCHMARKS}

{STANDARDS_WHITELIST}

{_SAFETY_BAR}

SECTION STRUCTURE:
{plan['sections']}

{plan['extra']}
{trace_rule}

Return ONLY a JSON object of this shape:
{{
  "doc_type": "{doc_type}",
  "title": "{plan['title']}",
  "product_name": "the product name, consistently across all documents",
  "context_table": [{{"label": "Device Class Context", "value": "..."}}],{overview_field}
  "{lead_field}": "one short paragraph",
  "sections": [
    {{"title": "System-Level Requirements", "level": 1,
      "rows": [{{"req_id": "SYS-001", "text": "The device shall ..."}}]}}
  ]
}}

Rules:
- Section titles carry NO leading number — numbering is applied when rendering.
- Use level 2 only for a subsection nested under the preceding level-1 section.
- Every requirement is ONE testable "shall" sentence. Never a placeholder or "TBD".
- Requirement ids are unique across the whole document and numbered from 001.
- context_table: 2-4 rows of document framing (device class, who it is prepared for,
  lifecycle context).
- Never invent a numeric figure that is not in the grounding or established by a
  cited standard; name the test method instead.
"""

    parts = [f"CONCEPT:\n{concept}"]
    if product_name:
        parts.append(f"PRODUCT NAME (use exactly this):\n{product_name}")
    if product_doc is not None:
        compact = {
            "product_name": product_doc.product_name,
            "sections": [
                {
                    "title": s.title,
                    "rows": [{"req_id": r.req_id, "text": r.text} for r in s.rows],
                }
                for s in product_doc.sections
            ],
        }
        parts.append(
            "PRODUCT DOCUMENT already generated — trace to these ids and stay "
            f"consistent with it:\n{json.dumps(compact, ensure_ascii=False)}"
        )
    if hardware_sections:
        parts.append(
            "HARDWARE SECTIONS already generated (titles only — do not duplicate "
            "hardware content):\n" + "\n".join(f"- {t}" for t in hardware_sections)
        )
    return system, "\n\n".join(parts)
