"""Staged orchestration for a scope-ingest run.

Runs in a background thread; the UI polls the job for progress. Stages are
sequential, but the three domains inside the decompose stage fan out
concurrently — they are genuinely independent, and that is most of the
wall-clock saving available here.

Design note: a stage failure marks that stage failed and lets the run continue.
A partial breakdown on screen beats an error page in a live demo.
"""
from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from ..config import get_settings
from ..llm import LLMError
from . import stages
from .grounding import concept_grounding
from .models import (
    GeneratedRequirement,
    JobState,
    StageState,
    SystemRequirement,
    TreeNode,
)

STAGE_DEFS: list[tuple[str, str]] = [
    ("parse", "Reading document & extracting scope"),
    ("system", "Identifying system-level requirements"),
    ("decompose", "Decomposing into hardware, software & labelling"),
    ("units", "Deriving unit requirements & verification"),
    ("assemble", "Building traceability tree"),
]

# Short codes used when building module ids in the tree.
_MODULE_CODE_STOPWORDS = {"and", "&", "of", "the"}


def initial_stages() -> list[StageState]:
    return [StageState(key=k, label=l) for k, l in STAGE_DEFS]


def _stage(job: JobState, key: str) -> StageState:
    return next(s for s in job.stages if s.key == key)


def _start(job: JobState, key: str) -> None:
    _stage(job, key).status = "running"


def _done(job: JobState, key: str, detail: str | None = None) -> None:
    s = _stage(job, key)
    s.status = "done"
    s.detail = detail


def _fail(job: JobState, key: str, detail: str) -> None:
    s = _stage(job, key)
    s.status = "failed"
    s.detail = detail


def _module_code(module: str) -> str:
    """'Alarm management' -> 'ALARMMANAGEMENT' shortened to a stable slug."""
    words = [w for w in module.replace("&", " ").split() if w.lower() not in _MODULE_CODE_STOPWORDS]
    return "-".join(w[:4].upper() for w in words[:2]) or "GEN"


def _coerce_requirements(raw: list[dict], domain: str) -> list[GeneratedRequirement]:
    """Validate model output into requirements, dropping anything unusable.

    The model occasionally emits a field off-contract (a stray enum value, a
    missing module). One bad requirement should not lose the other twenty.
    """
    out: list[GeneratedRequirement] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        item.setdefault("domain", domain)
        item["domain"] = domain  # never let the model reassign the domain
        item.setdefault("module", "General")
        item.setdefault("level", 4)
        # Normalise nulls the model may send as strings.
        for k in ("standard", "risk_link", "rationale", "acceptance_criteria", "gap_note"):
            if item.get(k) in ("null", "N/A", "none", ""):
                item[k] = None
        try:
            out.append(GeneratedRequirement.model_validate(item))
        except Exception:
            continue
    return out


def _build_tree(product: str, reqs: list[GeneratedRequirement]) -> TreeNode:
    """Assemble the 5-level tree: System → Domain → Module → Element → Unit.

    Unit requirements (level 5) are attached under their parent element by
    parent_id; anything orphaned stays at element level rather than vanishing.
    """
    by_parent: dict[str, list[GeneratedRequirement]] = {}
    elements: list[GeneratedRequirement] = []
    for r in reqs:
        if r.level >= 5 and r.parent_id:
            by_parent.setdefault(r.parent_id, []).append(r)
        else:
            elements.append(r)

    root = TreeNode(id="SYS-0", name=f"{product} System", domain="SYS", level=1)

    for domain, label in (("HW", "Hardware"), ("SW", "Software"), ("LBL", "Labelling & IFU")):
        domain_reqs = [r for r in elements if r.domain == domain]
        if not domain_reqs:
            continue

        domain_node = TreeNode(id=f"{domain}-0", name=label, domain=domain, level=2)

        modules: dict[str, list[GeneratedRequirement]] = {}
        for r in domain_reqs:
            modules.setdefault(r.module, []).append(r)

        for module, module_reqs in modules.items():
            module_node = TreeNode(
                id=f"{domain}-{_module_code(module)}",
                name=module,
                domain=domain,
                level=3,
            )
            for r in module_reqs:
                el = TreeNode(
                    id=r.id,
                    name=r.statement,
                    domain=domain,
                    level=4,
                    reqs=1,
                    classification=r.classification,
                )
                for unit in by_parent.get(r.id, []):
                    el.children.append(
                        TreeNode(
                            id=unit.id,
                            name=unit.statement,
                            domain=domain,
                            level=5,
                            reqs=1,
                            classification=unit.classification,
                        )
                    )
                el.reqs = 1 + len(el.children)
                module_node.children.append(el)

            module_node.reqs = sum(c.reqs for c in module_node.children)
            domain_node.children.append(module_node)

        domain_node.reqs = sum(c.reqs for c in domain_node.children)
        root.children.append(domain_node)

    root.reqs = sum(c.reqs for c in root.children)
    return root


def run(job: JobState, source_text: str) -> None:
    """Execute the pipeline, mutating `job` in place as it goes.

    `source_text` is already-extracted document text, or the raw concept string.
    Never raises — every failure path lands on the job.
    """
    started = time.monotonic()
    job.status = "running"
    job.model = get_settings().gemini_model
    failures = 0

    # ── Stage 1: parse ────────────────────────────────────────────────────────
    # Document parsing happened at the endpoint (so a bad file 400s immediately
    # rather than failing asynchronously). This stage reports the outcome.
    _start(job, "parse")
    if job.source_kind == "document":
        _done(job, "parse", f"{len(source_text):,} characters extracted")
    else:
        _done(job, "parse", "Concept mode — grounding from regulatory research")
        source_text = f"{source_text}\n\n{concept_grounding(source_text)}"

    # ── Stage 2: system requirements ──────────────────────────────────────────
    _start(job, "system")
    _stage(job, "system").detail = "One model call over the full scope text"
    try:
        result = stages.extract_system_requirements(source_text, job.source_kind)
        job.product = (result.get("product") or "Product").strip()
        job.summary = result.get("summary")
        job.system_requirements = [
            SystemRequirement.model_validate(r)
            for r in result.get("system_requirements", [])
            if isinstance(r, dict) and r.get("id") and r.get("statement")
        ]
        if not job.system_requirements:
            raise LLMError("No system requirements were returned.")
        _done(job, "system", f"{len(job.system_requirements)} system requirements")
    except (LLMError, Exception) as exc:
        # Without system requirements there is nothing to trace to — stop here.
        _fail(job, "system", str(exc))
        for key in ("decompose", "units", "assemble"):
            _fail(job, key, "Skipped — no system requirements to decompose")
        job.status = "failed"
        job.error = f"Could not establish system requirements: {exc}"
        job.duration_ms = int((time.monotonic() - started) * 1000)
        return

    sys_dicts = [r.model_dump() for r in job.system_requirements]

    # ── Stage 3: decompose per domain (fan-out) ───────────────────────────────
    _start(job, "decompose")
    domains = ["HW", "SW", "LBL"]

    def _one(domain: str) -> tuple[str, list[GeneratedRequirement] | Exception]:
        try:
            res = stages.decompose_domain(
                domain, source_text, job.source_kind, job.product or "Product", sys_dicts
            )
            return domain, _coerce_requirements(res.get("requirements", []), domain)
        except Exception as exc:
            return domain, exc

    # Live per-domain progress: results attach as each domain lands, and the
    # detail line tells the truth about which of the three parallel calls are
    # still running.
    domain_state = {d: "running" for d in domains}
    _stage(job, "decompose").detail = "HW, SW & LBL — three model calls in parallel"

    ok_domains: list[str] = []
    failed_domains: list[str] = []
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {pool.submit(_one, d): d for d in domains}
        for future in as_completed(futures):
            domain, outcome = future.result()
            if isinstance(outcome, Exception) or not outcome:
                failed_domains.append(domain)
                failures += 1
                domain_state[domain] = "failed"
            else:
                job.requirements.extend(outcome)
                ok_domains.append(domain)
                domain_state[domain] = f"done ({len(outcome)})"
            _stage(job, "decompose").detail = " · ".join(
                f"{d} {domain_state[d]}" for d in domains
            )

    if not job.requirements:
        _fail(job, "decompose", "All three domains failed to decompose")
        for key in ("units", "assemble"):
            _fail(job, key, "Skipped — nothing to assemble")
        job.status = "failed"
        job.error = "Decomposition produced no requirements."
        job.duration_ms = int((time.monotonic() - started) * 1000)
        return

    detail = f"{len(job.requirements)} element requirements across {', '.join(ok_domains)}"
    if failed_domains:
        _fail(job, "decompose", f"{detail} — {', '.join(failed_domains)} failed")
    else:
        _done(job, "decompose", detail)

    # ── Stage 4: unit requirements for CTS ────────────────────────────────────
    _start(job, "units")
    cts = [r for r in job.requirements if r.classification == "CTS"]
    if not cts:
        _done(job, "units", "No critical-to-safety requirements to decompose")
    else:
        _stage(job, "units").detail = (
            f"Decomposing {len(cts)} critical-to-safety elements into unit requirements"
        )
        try:
            res = stages.derive_units(job.product or "Product", [r.model_dump() for r in cts])
            by_id = {r.id: r for r in job.requirements}
            units: list[GeneratedRequirement] = []
            for u in res.get("units", []):
                parent = by_id.get(u.get("parent_id", ""))
                if not parent or not u.get("id") or not u.get("statement"):
                    continue  # Orphan unit — drop rather than float it at the root.
                units.append(
                    GeneratedRequirement(
                        id=u["id"],
                        statement=u["statement"],
                        domain=parent.domain,
                        module=parent.module,
                        level=5,
                        parent_id=parent.id,
                        classification="CTS",
                        risk=parent.risk,
                        origin="derived",
                        standard=parent.standard,
                        verification_method="Test",
                        verification_id=u.get("verification_id"),
                    )
                )
            job.requirements.extend(units)
            _done(job, "units", f"{len(units)} unit requirements from {len(cts)} CTS elements")
        except Exception as exc:
            failures += 1
            _fail(job, "units", f"Unit decomposition failed: {exc}")

    # ── Stage 5: assemble ─────────────────────────────────────────────────────
    _start(job, "assemble")
    try:
        job.tree = _build_tree(job.product or "Product", job.requirements)
        gaps = sum(1 for r in job.requirements if r.origin == "gap")
        _done(job, "assemble", f"{job.tree.reqs} requirements · {gaps} gaps identified")
    except Exception as exc:
        _fail(job, "assemble", str(exc))
        job.status = "failed"
        job.error = f"Could not assemble the tree: {exc}"
        job.duration_ms = int((time.monotonic() - started) * 1000)
        return

    job.status = "partial" if failures else "succeeded"
    job.duration_ms = int((time.monotonic() - started) * 1000)
