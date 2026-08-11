"""The LLM stages of the ingest pipeline.

Each stage is one focused call with a small, well-specified output shape. That
keeps JSON reliable (a single call asked to emit an entire enriched tree drifts
badly) and lets a failed stage degrade without taking the run with it.
"""
from __future__ import annotations

from ..llm import complete_json
from . import grounding

# Domains we decompose into. Labelling is a first-class axis because the client
# sent a separate Labelling requirements document alongside HW and SW.
DOMAIN_LABELS: dict[str, str] = {
    "HW": "Hardware",
    "SW": "Software",
    "LBL": "Labelling & IFU",
}

# The subsystem/module taxonomy the client's own documents use. Naming the
# expected groupings keeps output aligned with their DOORS structure instead of
# inventing a parallel vocabulary they'd have to reconcile.
DOMAIN_MODULES: dict[str, str] = {
    "HW": (
        "Mechanical pumping assembly, Motor & drive electronics, Pressure sensor "
        "hardware, Air-in-line sensor hardware, Main control PCB, Battery & power "
        "hardware, User interface hardware, Alarm hardware, Environmental & reliability"
    ),
    "SW": (
        "Flow control, Infusion modes, Alarm management, Sensor processing, User "
        "interface, Safety monitoring & safe-state, Error handling & fault management, "
        "Event logging, Battery & power management, Communication & connectivity, "
        "Cybersecurity, Software update, Data storage & configuration, Software diagnostics"
    ),
    "LBL": (
        "General labelling, IFU content, Symbols, Risk & safety labelling"
    ),
}

DOMAIN_PREFIX: dict[str, str] = {"HW": "HW", "SW": "SW", "LBL": "LBL"}

# Hard boundaries between domains. Without these the concept path (which has no
# source document to anchor the split) files control logic under hardware —
# "the mechanical pumping assembly shall enforce dose-cap logic" — which reads as
# obviously wrong to a systems engineer and duplicates the software requirement.
DOMAIN_SCOPE: dict[str, str] = {
    "HW": (
        "SCOPE — HARDWARE ONLY. Write requirements about PHYSICAL and ELECTRICAL "
        "properties: mechanism, actuation, materials, sensing elements, circuits, "
        "power, connectors, enclosure, thermal, EMC, environmental durability.\n"
        "DO NOT write requirements about algorithms, control logic, dose calculation, "
        "timers, lockouts, access control, authentication, logging, user workflow, "
        "state machines or anything a processor executes — those are SOFTWARE and "
        "will be produced separately. If a requirement's verb is 'calculate', "
        "'enforce', 'log', 'authenticate', 'prompt' or 'validate', it does NOT belong "
        "here. Hardware PROVIDES the sensing, actuation and interlocks that software "
        "acts on; describe only that physical capability."
    ),
    "SW": (
        "SCOPE — SOFTWARE ONLY. Write requirements about what the software computes, "
        "decides, enforces, monitors, stores and displays: control algorithms, dose "
        "calculation, timers and lockouts, alarm logic and prioritisation, state "
        "machines, safe-state transitions, diagnostics, logging, access control, "
        "cybersecurity, updates.\n"
        "DO NOT specify physical construction, component choice or materials — that is "
        "HARDWARE and will be produced separately. Where software depends on a physical "
        "capability, reference it rather than re-specifying it."
    ),
    "LBL": (
        "SCOPE — LABELLING AND IFU ONLY. Write requirements about what must be PRINTED "
        "on the device/packaging or STATED in the Instructions for Use: identifiers, "
        "UDI, symbols, intended use, contraindications, warnings, operating "
        "instructions, cleaning/maintenance, disclosure obligations.\n"
        "DO NOT restate a device behaviour as a labelling requirement. 'The pump shall "
        "cap the hourly dose' is a SOFTWARE requirement; 'the IFU shall state the "
        "maximum hourly dose' is a labelling requirement. Every requirement here must "
        "be about information conveyed to the user, not about what the device does."
    ),
}

_ENGINEER_ROLE = (
    "You are a principal systems engineer at a medical device manufacturer, writing "
    "requirements for a Class II infusion pump destined for an FDA 510(k) submission "
    "and a Design History File. You write requirements the way a regulator expects to "
    "read them: measurable, testable, traceable to a standard clause, never vague."
)

# Public alias — the docgen pipelines write for the same reader and should not
# drift into a second, subtly different persona.
ENGINEER_ROLE = _ENGINEER_ROLE


# ── Stage: system-level PRDs ─────────────────────────────────────────────────
def extract_system_requirements(source_text: str, source_kind: str) -> dict:
    """Pull (or derive) the system-level PRD requirements and product identity."""
    if source_kind == "document":
        instruction = (
            "Read the SOURCE DOCUMENT below and extract its system-level product "
            "requirements. Mark each one origin='extracted' if it is explicitly stated "
            "in the document. If the document is missing a system requirement that this "
            "device class plainly needs, add it and mark it origin='gap'."
        )
        payload = f"SOURCE DOCUMENT:\n{source_text}"
    else:
        instruction = (
            "No source document exists. Derive the system-level product requirements for "
            "the CONCEPT below from the grounding provided. Mark every requirement "
            "origin='derived', except those that exist specifically to close a known "
            "safety gap named in the grounding, which are origin='gap'."
        )
        payload = f"CONCEPT:\n{source_text}"

    system = f"""{_ENGINEER_ROLE}

{grounding.base_grounding()}

{instruction}

Return ONLY a JSON object of this shape:
{{
  "product": "short product name, e.g. 'Smart Volumetric Infusion Pump'",
  "summary": "2-3 sentence engineering summary of what was found and what was missing",
  "system_requirements": [
    {{"id": "SYS-001", "statement": "The pump shall ...", "origin": "extracted|derived|gap"}}
  ]
}}

Rules:
- Produce 7-12 system requirements. Use SYS-NNN ids, numbered from 001.
- Each statement is one testable "shall" sentence.
- Never output a placeholder. Never invent a numeric figure that is not in the grounding.
"""
    return complete_json(system, payload)


# ── Stage: decompose + enrich one domain ─────────────────────────────────────
def decompose_domain(
    domain: str,
    source_text: str,
    source_kind: str,
    product: str,
    system_reqs: list[dict],
) -> dict:
    """Decompose one domain into fully-populated element requirements.

    Decomposition and enrichment are one call per domain rather than two: a second
    pass would have to re-reference ids emitted by the first, and that cross-call
    id matching is exactly where these pipelines break.
    """
    label = DOMAIN_LABELS[domain]
    modules = DOMAIN_MODULES[domain]
    prefix = DOMAIN_PREFIX[domain]

    sys_block = "\n".join(f"- {r['id']}: {r['statement']}" for r in system_reqs)
    source_block = (
        f"SOURCE DOCUMENT:\n{source_text}"
        if source_kind == "document"
        else f"CONCEPT (no source document — derive from grounding):\n{source_text}"
    )

    system = f"""{_ENGINEER_ROLE}

{grounding.base_grounding()}

TASK: decompose the {label} domain of "{product}" into element-level requirements.

{DOMAIN_SCOPE[domain]}

Group them under these modules where they apply (use these exact names; omit a
module if genuinely not applicable; do not invent parallel names):
{modules}

SYSTEM REQUIREMENTS to trace back to (every element requirement must name one as parent_id):
{sys_block}

Return ONLY a JSON object of this shape:
{{
  "requirements": [
    {{
      "id": "{prefix}-XXX-001",
      "statement": "one testable 'shall' sentence",
      "module": "exact module name from the list above",
      "parent_id": "SYS-00N",
      "classification": "CTS|CTQ|Standard",
      "risk": "High|Medium|Low",
      "origin": "extracted|derived|gap",
      "rationale": "why this requirement exists",
      "standard": "governing standard and clause where known, else null",
      "risk_link": "ISO 14971 risk control this implements, else null",
      "acceptance_criteria": "measurable pass/fail criterion with real numbers",
      "verification_method": "Test|Inspection|Analysis|Demonstration",
      "verification_id": "TV-XXX-001",
      "gap_note": "if origin='gap', why the source omitted this; else null"
    }}
  ]
}}

Rules that matter most:
- Produce 14-22 requirements for this domain. Cover every applicable module.
- CLASSIFICATION: CTS (critical-to-safety) if failure could harm the patient —
  dosing accuracy, occlusion, air-in-line, free-flow, alarms, safe-state.
  CTQ (critical-to-quality) if it affects performance or usability but not direct
  safety. Standard otherwise.
- ACCEPTANCE CRITERIA IS THE POINT. "Shall comply with IEC 60601-1" is a promise,
  not a requirement. Every criterion must carry a real, testable figure — a
  pressure in mmHg, a time in seconds, a percentage, a dB level, a test method.
  Take the figures from the grounding above. If the grounding has no figure for
  something, state the test method and the parameter to be established rather
  than inventing a number.
- ORIGIN is a comparative signal and must be honest:
  "extracted" = this requirement is stated in the source document;
  "derived"   = decomposed from a stated requirement;
  "gap"       = absent from the source but required by a standard or good practice.
  Getting origin right matters more than producing a large count.
- Ids: use the {prefix}- prefix with a short module code, e.g. {prefix}-ALM-001.
- Never output a placeholder or a "TBD".
"""
    return complete_json(system, source_block)


# ── Stage: unit-level decomposition for the safety-critical requirements ─────
def derive_units(product: str, cts_reqs: list[dict]) -> dict:
    """Decompose CTS element requirements one level further, to unit requirements.

    Only CTS requirements get this treatment — it is where a DHF reviewer looks,
    and decomposing all of them would triple the call size for little demo value.
    """
    req_block = "\n".join(
        f"- {r['id']} [{r['domain']}/{r['module']}]: {r['statement']}" for r in cts_reqs
    )

    system = f"""{_ENGINEER_ROLE}

TASK: decompose each critical-to-safety element requirement of "{product}" one level
further, into unit-level requirements — the level a developer or test engineer
implements and verifies directly.

Return ONLY a JSON object of this shape:
{{
  "units": [
    {{
      "id": "SWU-XXX-001",
      "statement": "one testable 'shall' sentence at unit level",
      "parent_id": "the element requirement id this decomposes",
      "verification_id": "SWT-XXX-001"
    }}
  ]
}}

Rules:
- One or two unit requirements per element requirement. Do not pad.
- Use SWU- prefix for software units, HWU- for hardware units, LBLU- for labelling.
- parent_id MUST be one of the element requirement ids listed below, exactly.
- Unit requirements are concrete and implementable: evaluate a threshold, latch a
  fault, drive an output, store a record.
"""
    return complete_json(system, f"ELEMENT REQUIREMENTS (critical-to-safety only):\n{req_block}")
