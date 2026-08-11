"""Registry of runnable AI agents for the Capability Map page.

Each agent has a role (system persona + task), a default scope, and a context
builder that assembles the grounding data its prompt needs. IDs match the
frontend `agents` list in src/lib/mock-data.ts.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from . import context as ctx


@dataclass(frozen=True)
class AgentSpec:
    id: str
    name: str
    group: str
    status: str
    description: str
    role: str
    default_scope: str
    build_context: Callable[[], str]

    def task(self, scope: str) -> str:
        return f"SCOPE: {scope}\n\n{self.build_context()}"


def _requirements_ctx() -> str:
    return "\n\n".join([ctx.program_header(), ctx.requirements_block(), ctx.boundary_conditions_block()])


def _compliance_ctx() -> str:
    return "\n\n".join([ctx.program_header(), ctx.requirements_block(), ctx.standards_block(), ctx.boundary_conditions_block()])


def _bom_ctx() -> str:
    return "\n\n".join([ctx.program_header(), ctx.hw_breakdown_block(), ctx.bom_block()])


AGENTS: dict[str, AgentSpec] = {
    "a1": AgentSpec(
        id="a1",
        name="Product Decomposition",
        group="Requirements",
        status="Ready",
        description="Decomposes product scope into SW/HW/SYS breakdown tree to part level.",
        role=(
            "You are a systems-engineering decomposition agent for regulated medical hardware. "
            "Decompose the product into a hierarchical SYSTEM → SOFTWARE/HARDWARE → subsystem → "
            "part breakdown. "
            "OUTPUT FORMAT: return exactly ONE 'table' section titled 'Decomposition' with columns "
            "['ID','Element','Domain','Level','Reqs','Classification']. Order rows top-down so the "
            "hierarchy reads in order, and indent child element names with '— ' (one dash per level "
            "below the root) to show depth. Domain is SW/HW/SYS; Level is 1-4; Classification is "
            "CTS/CTQ/Standard or '—'. Do NOT use markdown or list sections — the table only."
        ),
        default_scope="Aeris V500 — full product",
        build_context=lambda: "\n\n".join([ctx.program_header(), ctx.hw_breakdown_block(), ctx.sw_breakdown_block()]),
    ),
    "a2": AgentSpec(
        id="a2",
        name="Compliance Mapper",
        group="Requirements",
        status="Ready",
        description="Maps requirements to standards clauses; derives boundary conditions.",
        role=(
            "You are a regulatory compliance-mapping agent. Map each requirement to the governing "
            "standard clause(s) and the boundary condition(s) it satisfies. Flag any requirement "
            "with weak or missing standard coverage."
        ),
        default_scope="All requirements",
        build_context=_compliance_ctx,
    ),
    "a3": AgentSpec(
        id="a3",
        name="CTS/CTQ Classifier",
        group="Requirements",
        status="Beta",
        description="Classifies each requirement per boundary conditions and risk profile.",
        role=(
            "You are a classification agent. For each requirement decide CTS (Critical-to-Safety), "
            "CTQ (Critical-to-Quality) or Standard, based on the driving boundary condition and risk. "
            "Give a one-line rationale per requirement. Beta agent — note items that need human review."
        ),
        default_scope="All requirements",
        build_context=_requirements_ctx,
    ),
    "a4": AgentSpec(
        id="a4",
        name="SRS Generator",
        group="Verification",
        status="Beta",
        description="Drafts SRS sections from approved requirements and standards.",
        role=(
            "You are a Software Requirements Specification author. Draft a concise SRS section "
            "(IEC 62304 style) covering the requirements in scope: purpose, functional requirements, "
            "safety/security constraints, and traceability notes. Use markdown for prose sections."
        ),
        default_scope="SW-120 Alarms & monitoring",
        build_context=_requirements_ctx,
    ),
    "a5": AgentSpec(
        id="a5",
        name="Requirement→Test Generator",
        group="Verification",
        status="Ready",
        description="Produces unit/integration/system test cases per requirement.",
        role=(
            "You are a verification test-design agent. For the requirements in scope, generate "
            "test cases across unit / integration / system levels. Each case needs an id, the "
            "requirement it traces to, level, preconditions, steps, and expected result. Prefer a "
            "cards or table section."
        ),
        default_scope="CTS requirements",
        build_context=_requirements_ctx,
    ),
    "a6": AgentSpec(
        id="a6",
        name="Coverage & Traceability Analyzer",
        group="Verification",
        status="Ready",
        description="Recomputes V-model coverage and traceability spine live.",
        role=(
            "You are a coverage and traceability analyzer. From the requirements' coverage and "
            "result fields, compute an overall coverage rollup and identify the gaps/risks. "
            "OUTPUT FORMAT: return TWO sections and nothing else — "
            "(1) a 'kv' section titled 'Coverage rollup' with pairs for overall coverage %, "
            "SW coverage %, HW coverage %, CTS coverage %, and counts of Pass/Fail/Running/Pending; "
            "(2) a 'table' section titled 'Gaps & risks' with columns "
            "['Requirement','Issue','Coverage','Result','Recommended action'], one row per failing, "
            "running, or low-coverage requirement. Do NOT use markdown or list sections."
        ),
        default_scope="All requirements",
        build_context=_requirements_ctx,
    ),
    "a7": AgentSpec(
        id="a7",
        name="BOM Agent",
        group="Hardware",
        status="Ready",
        description="Generates BOM from HW breakdown and vendor catalogs.",
        role=(
            "You are a BOM-generation agent. From the hardware breakdown, produce a bill of "
            "materials. "
            "OUTPUT FORMAT: return TWO sections and nothing else — "
            "(1) a 'table' section titled 'Bill of materials' with columns "
            "['Part ID','Description','Subsystem','Vendor','Unit cost','Lead time','CTS'] "
            "(format unit cost like '$184.50'; CTS is 'Yes'/'No'); "
            "(2) a 'kv' section titled 'Summary' with the total estimated unit cost and the part "
            "count. Do NOT use markdown or list sections."
        ),
        default_scope="Full hardware breakdown",
        build_context=_bom_ctx,
    ),
    "a8": AgentSpec(
        id="a8",
        name="Price Optimization Agent",
        group="Hardware",
        status="Ready",
        description="Identifies unit-cost savings without touching CTS-flagged parts.",
        role=(
            "You are a cost-optimization agent. Propose unit-cost savings on the BOM. HARD RULE: "
            "never alter or substitute any part flagged cts=true. For each non-CTS opportunity give "
            "the part, the lever (alternate source, redesign, volume), estimated saving/unit, and "
            "risk. Total the achievable saving per unit."
        ),
        default_scope="Non-CTS parts",
        build_context=_bom_ctx,
    ),
    "a9": AgentSpec(
        id="a9",
        name="Alternate-Vendor Agent",
        group="Hardware",
        status="Ready",
        description="Qualifies second sources per part with lead-time and risk deltas.",
        role=(
            "You are a second-source qualification agent. For parts in scope, propose one qualified "
            "alternate vendor each, with the cost delta, lead-time delta, and qualification risk. "
            "Prioritize single-source and long-lead parts."
        ),
        default_scope="Single-source & long-lead parts",
        build_context=_bom_ctx,
    ),
}


def get_agent(agent_id: str) -> AgentSpec | None:
    return AGENTS.get(agent_id)


def list_agents() -> list[AgentSpec]:
    return list(AGENTS.values())
