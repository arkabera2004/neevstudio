"""Prompt construction for the CTS/CTQ classification pass.

Every contract block below literally contains the word JSON — OpenAI rejects a
`response_format: json_object` request whose prompt never mentions it.
"""
from __future__ import annotations

from ..ingest.grounding import classification_grounding
from ..ingest.stages import ENGINEER_ROLE
from .models import BoundaryCondition

_ROLE = (
    f"{ENGINEER_ROLE} You are now performing the formal ISO 14971 risk-based "
    "criticality classification of an existing requirement set — the review that "
    "confirms or overturns the preliminary classes assigned during decomposition."
)

# Statements are truncated in the boundary-condition call: it reasons over the
# whole set at once, and the first ~160 characters carry the parameter and
# threshold a boundary condition hangs on.
_BC_STATEMENT_CHARS = 160


def boundaries_prompt(
    product: str, reqs: list[tuple[str, str]]
) -> tuple[str, str]:
    """Build (system, task) for the single boundary-condition call."""
    system = f"""{_ROLE}

TASK: from the requirement set of "{product}" below, derive the BOUNDARY
CONDITIONS — the measurable parameters whose thresholds decide whether a
requirement is Critical to Safety or Critical to Quality. These become the
classification register's cross-reference table (BC-01, BC-02, …).

{classification_grounding()}

Return ONLY a JSON object of this shape:
{{
  "boundary_conditions": [
    {{
      "id": "BC-01",
      "parameter": "short parameter name, e.g. 'Occlusion alarm pressure'",
      "threshold": "the concrete figure with unit, taken from the grounding",
      "drives": "CTS|CTQ",
      "source": "one whitelisted standard string, with clause where confident"
    }}
  ]
}}

Rules:
- Produce 6-10 boundary conditions, numbered BC-01 upward.
- Every threshold is a REAL figure from the grounding or a cited standard —
  never an invented number. If the grounding has no figure for a parameter,
  state the test method that establishes it instead.
- source strings come ONLY from the citable-standards list, copied exactly.
- Cover the safety-critical territory first (dosing accuracy, occlusion,
  air-in-line, alarms, safe-state) before quality parameters.
"""
    body = "\n".join(
        f"- {req_id}: {statement[:_BC_STATEMENT_CHARS]}" for req_id, statement in reqs
    )
    task = f"REQUIREMENT SET:\n{body}"
    return system, task


def _bc_table(boundary_conditions: list[BoundaryCondition]) -> str:
    if not boundary_conditions:
        return "BOUNDARY CONDITIONS: none were derived — leave bc_id null."
    lines = "\n".join(
        f"- {bc.id}: {bc.parameter} — {bc.threshold} (drives {bc.drives}; {bc.source})"
        for bc in boundary_conditions
    )
    return f"BOUNDARY CONDITIONS (link each requirement to at most one, by id):\n{lines}"


def classify_chunk_prompt(
    product: str,
    boundary_conditions: list[BoundaryCondition],
    rows: list[dict],
    missing_only: bool = False,
) -> tuple[str, str]:
    """Build (system, task) for one chunk of requirements.

    Each row dict carries id/statement/domain/module/classification/risk from
    the breakdown — the preliminary values the pass confirms or overturns.
    """
    system = f"""{_ROLE}

You are classifying an EXISTING requirement set for "{product}". The requirements
are already written — you are NOT rewriting them. For each requirement you decide
the final criticality class, risk level and boundary-condition linkage.

{classification_grounding()}

{_bc_table(boundary_conditions)}

Return ONLY a JSON object of this shape:
{{
  "rows": [
    {{
      "req_id": "exactly the id given to you",
      "classification": "CTS|CTQ|Standard",
      "risk": "High|Medium|Low",
      "rationale": "one sentence: why this class — and, if you changed it, why the preliminary class was wrong",
      "standard": "one whitelisted standard string governing this requirement, else null",
      "bc_id": "the boundary condition id this requirement is classified against, else null",
      "confidence": "High|Medium|Low"
    }}
  ]
}}

Rules:
- Return EXACTLY one object per requirement id listed below — no more, no fewer.
- Do NOT restate, rewrite or return the requirement text. Only the id.
- Every string is terse and declarative. No hedging, no "should consider", no "TBD".
- bc_id must be one of the boundary condition ids above, or null — never invented.
- standard strings come ONLY from the citable-standards list, copied exactly.
"""

    lead = (
        "These requirement ids were missing from your previous response. Return a "
        "row for EACH of them, in the same JSON shape:"
        if missing_only
        else "Classify every requirement below."
    )
    body = "\n".join(
        f"- {r['id']} [{r['domain']}/{r['module']}] "
        f"(preliminary: {r['classification']}, risk {r['risk']}): {r['statement']}"
        for r in rows
    )
    task = f"{lead}\n\nREQUIREMENTS:\n{body}"
    return system, task
