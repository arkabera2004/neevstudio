"""Quality rubric for generated deliverables.

Two tiers:
- gates: binary, any failure fails the whole iteration.
- scored checks: weighted, composite normalized to /100 per run.

Standards whitelist doubles as the SME citation-audit trail: every entry carries
its source. Citations the generator emits that are NOT matched here land on the
run's "contested" list and must be web-verified before being whitelisted (or
prompted away).
"""
from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field

PLACEHOLDER = "— pending SME review"

# ── Citation extraction ──────────────────────────────────────────────────────
CITATION_RE = re.compile(
    r"\b(?:IEC|ISO|EN|AAMI)(?:/(?:TR|TS|IEC|ISO|AAMI))?\s?"
    r"\d{3,5}(?:-[\dA-Za-z]+)*"
    r"(?::\d{4})?"
    r"(?:\s?\+\s?A(?:MD)?\d+:\d{4})*"
)
CFR_RE = re.compile(r"\b21\s?CFR\s?(?:Part\s?)?\d+(?:\.\d+)?(?:\([a-z]\))?")
MISC_RE = re.compile(r"\bANSI(?:/AAMI)?\s?Z535(?:\.\d+)?|\bFD&C(?:\s?Act)?\s?§?\s?524B|\bMDR\s?(?:\(EU\)\s?)?2017/745")

# Dated-edition detector for the ISO/IEC family.
DATED_RE = re.compile(r":\d{4}")

# ── Whitelist ────────────────────────────────────────────────────────────────
# base code -> set of accepted edition strings ("" = undated form accepted).
# source tags: KB = PoC Data/Knowledge Base (fact-checked deliverables notes),
# WEB = verified during the citation audit (date in comment).
STANDARDS_WHITELIST: dict[str, set[str]] = {
    "IEC 60601-1": {"2005", "2005+A1:2012", "2005+A1:2012+A2:2020", "2005+AMD1:2012", "2005+AMD1:2012+AMD2:2020"},  # KB
    "IEC 60601-1-2": {"2014", "2014+A1:2020", "2014+AMD1:2020"},  # KB
    "IEC 60601-1-6": {"2010", "2010+A1:2013", "2010+A1:2013+A2:2020", "2010+AMD1:2013+AMD2:2020"},  # WEB 2026-07-22: usability collateral; standalone ":2020" is an amendment year, not an edition
    "IEC 60601-1-8": {"2006", "2006+A1:2012", "2006+A1:2012+A2:2020", "2006+AMD1:2012+AMD2:2020", "2020"},  # KB (reference deliverables cite ":2020" shorthand)
    "IEC 60601-1-11": {"2015"},  # KB
    "IEC 60601-1-12": {"2014"},  # KB
    "IEC 60601-2-24": {"2012"},  # KB — current edition confirmed
    "IEC 62304": {"2006", "2006+A1:2015", "2006+AMD1:2015"},  # KB
    "IEC 62366-1": {"2015", "2015+A1:2020", "2015+AMD1:2020"},  # KB
    "ISO 14971": {"2019"},  # KB
    "IEC/TR 24971": {"2020"},  # KB
    "IEC 81001-5-1": {"2021"},  # KB
    "IEC 62133-2": {"2017"},  # KB
    "ISO 15223-1": {"2021"},  # KB
    "ISO 20417": {"2021"},  # KB
    "ISO 80369-6": {"", "2016"},  # KB
    "ISO 80369-7": {"", "2016"},  # WEB 2026-07-22: Luer connectors
    "ISO 10993-1": {"2018"},  # KB
    "ISO 13485": {"2016"},  # KB
    "ISO 3696": {""},  # KB benchmark water spec (undated use accepted)
    "ISO 7864": {""},  # KB benchmark needle spec
    "ISO 594": set(),  # WITHDRAWN, replaced by ISO 80369 — never acceptable
}
# Undated families acceptable as-is (series references / regulations).
UNDATED_FAMILIES = (
    "IEC 60068-2",  # environmental test series — subpart citations acceptable
    "IEC 61000-4",  # EMC basic standards series
)


@dataclass
class CheckResult:
    name: str
    earned: float
    max_points: float
    passed: bool
    details: list[str] = field(default_factory=list)


def _split_citation(token: str) -> tuple[str, str]:
    """'IEC 62304:2006+AMD1:2015' -> ('IEC 62304', '2006+AMD1:2015')."""
    token = re.sub(r"\s+", " ", token.strip())
    m = re.match(r"^([A-Z/]+(?:/TR|/TS)?\s?[\d-]+?)(?::(.+))?$", token)
    if not m:
        return token, ""
    base = m.group(1).strip().rstrip("-")
    edition = (m.group(2) or "").replace(" ", "")
    # normalize "IEC/TR 24971" style
    base = re.sub(r"^(IEC|ISO)/TR\s?", lambda g: f"{g.group(1)}/TR ", base)
    return base, edition


def extract_citations(text: str) -> list[str]:
    found = [m.group(0).strip() for m in CITATION_RE.finditer(text)]
    found += [m.group(0).strip() for m in CFR_RE.finditer(text)]
    found += [m.group(0).strip() for m in MISC_RE.finditer(text)]
    return found


def classify_citation(token: str) -> str:
    """-> 'whitelisted' | 'contested' | 'regulatory' (CFR/ANSI/FD&C/MDR, accepted)."""
    if CFR_RE.match(token) or MISC_RE.match(token):
        return "regulatory"
    base, edition = _split_citation(token)
    for fam in UNDATED_FAMILIES:
        if base.startswith(fam):
            return "whitelisted"
    accepted = STANDARDS_WHITELIST.get(base)
    if accepted is None:
        return "contested"
    if edition in accepted or (edition and edition.split("+")[0] in accepted and all(
        part in " ".join(accepted) for part in edition.split("+")[1:]
    )):
        return "whitelisted"
    if not edition and "" in accepted:
        return "whitelisted"
    return "contested"


# ── Vague-language and method keywords ───────────────────────────────────────
VAGUE_RE = re.compile(
    r"\b(TBD|to be determined|as appropriate|as needed|should consider|"
    r"comply with (?:all )?(?:the )?(?:applicable )?standards?\b(?!.*(?:test|inspect|audit|analy|verif|valid)))",
    re.IGNORECASE,
)
METHOD_KEYWORDS = [
    "test", "inspection", "inspect", "audit", "analysis", "review", "study",
    "verification", "validation", "measurement", "trumpet", "gravimetric",
    "fault injection", "penetration", "usability", "static analysis",
    "aging", "ageing", "scan", "simulation", "demonstration", "benchmark",
]
SHALL_RE = re.compile(r"\bshall\b", re.IGNORECASE)
NUMERIC_RE = re.compile(r"±|\d+(?:\.\d+)?\s?(?:mL/h|mL|%|dB|mmHg|kPa|hours?|h\b|min\b|minutes?|s\b|seconds?|kg|g\b|V\b|N\b|µL|nm|mm|cm|lux|°C)")
TRACE_RE = re.compile(r"\(Traces? to:?\s*([A-Z0-9,\-\s]+)\)")

SAFETY_BAR = {
    "cumulative dose cap": re.compile(r"cumulative|rolling.{0,20}(dose|limit)|dose.{0,20}(cap|limit)", re.I),
    "lockout / re-arm": re.compile(r"lockout|lock-out|re-?arm", re.I),
    "free-flow protection": re.compile(r"free[- ]flow", re.I),
    "air-in-line": re.compile(r"air[- ]in[- ]line", re.I),
    "occlusion with threshold": re.compile(r"occlusion.{0,120}?\d+\s?mmHg|\d+\s?mmHg.{0,120}?occlusion", re.I | re.S),
    "NRFit / ISO 80369-6": re.compile(r"NRFit|80369-6", re.I),
    "LAST warning": re.compile(r"\bLAST\b|local anesthetic systemic toxicity", re.I),
    "tiered access control": re.compile(r"(access|authoriz|authentic).{0,60}(tier|level|clinician|role)|(tier|role).{0,40}access", re.I | re.S),
    "SBOM / §524B": re.compile(r"SBOM|524B", re.I),
}

PRODUCT_PREFIXES = {"SYS", "FUN", "PERF", "ALM", "UI", "SAF", "PWR", "CON", "REL", "REG"}


def _prefix(req_id: str) -> str:
    return req_id.split("-")[0]


# ── Gates ────────────────────────────────────────────────────────────────────
def gates_matrix(job: dict, docx_rows: list[dict]) -> list[CheckResult]:
    out = []
    out.append(CheckResult("gate:status", 0, 0, job["status"] == "succeeded",
                           [f"status={job['status']}"]))
    ids = [r["req_id"] for r in docx_rows]
    out.append(CheckResult("gate:no-duplicates", 0, 0, len(ids) == len(set(ids)),
                           [f"{len(ids)} rows, {len(set(ids))} unique"]))
    placeholders = sum(1 for r in docx_rows if PLACEHOLDER in " ".join(r.values()))
    out.append(CheckResult("gate:no-placeholders", 0, 0, placeholders == 0,
                           [f"{placeholders} placeholder rows"]))
    matrix = job.get("matrix") or {}
    api_ids = {row["req_id"] for s in matrix.get("sections", []) for row in s.get("rows", [])}
    out.append(CheckResult("gate:roundtrip", 0, 0, api_ids == set(ids) and bool(ids),
                           [f"api={len(api_ids)} docx={len(set(ids))}"]))
    return out


def gates_docset(job: dict, docs_rows: dict[str, list[dict]]) -> list[CheckResult]:
    out = []
    out.append(CheckResult("gate:status", 0, 0, job["status"] == "succeeded",
                           [f"status={job['status']}"]))
    out.append(CheckResult("gate:four-docs", 0, 0, len(job.get("docs", [])) == 4,
                           [f"{len(job.get('docs', []))} docs"]))
    names = [f["name"] for f in job.get("files", [])]
    out.append(CheckResult("gate:zip-present", 0, 0, any(n.endswith(".zip") for n in names), names[-1:]))
    for doc_type, rows in docs_rows.items():
        ids = [r["req_id"] for r in rows]
        out.append(CheckResult(f"gate:no-duplicates:{doc_type}", 0, 0,
                               len(ids) == len(set(ids)), [f"{len(ids)} rows"]))
    return out


# ── Scored checks: Mode A ────────────────────────────────────────────────────
def check_column_completeness(docx_rows: list[dict]) -> CheckResult:
    fields = ["rationale", "standards", "compliance_approach", "risk_hazard", "risk_level"]
    bad = [r["req_id"] for r in docx_rows if any(not r.get(f, "").strip() for f in fields)]
    frac = 1 - len(bad) / max(len(docx_rows), 1)
    return CheckResult("column-completeness", 15 * frac, 15, not bad,
                       [f"{len(bad)} incomplete rows: {bad[:8]}"] if bad else ["all rows complete"])


def check_standards_quality(texts: list[str], weight: float = 25) -> CheckResult:
    all_cites: list[str] = []
    rows_without = 0
    for t in texts:
        cites = extract_citations(t)
        if not cites:
            rows_without += 1
        all_cites += cites
    counts = Counter(classify_citation(c) for c in all_cites)
    contested = sorted({c for c in all_cites if classify_citation(c) == "contested"})
    iso_iec = [c for c in all_cites if not (CFR_RE.match(c) or MISC_RE.match(c))]

    def _dated_ok(c: str) -> bool:
        # A citation counts as edition-specific if it carries a year OR its
        # whitelist entry explicitly accepts the undated form (series refs,
        # ISO 80369-6, benchmark specs).
        if DATED_RE.search(c):
            return True
        base, _ = _split_citation(c)
        if any(base.startswith(fam) for fam in UNDATED_FAMILIES):
            return True
        return "" in STANDARDS_WHITELIST.get(base, set())

    dated = sum(1 for c in iso_iec if _dated_ok(c))
    dated_frac = dated / max(len(iso_iec), 1)
    ok_frac = counts.get("whitelisted", 0) / max(len(iso_iec), 1)
    score = weight * (0.4 * dated_frac + 0.5 * ok_frac + 0.1 * (1 - rows_without / max(len(texts), 1)))
    details = [
        f"{len(all_cites)} citations · dated {dated}/{len(iso_iec)} · whitelisted {counts.get('whitelisted', 0)}/{len(iso_iec)} · regulatory {counts.get('regulatory', 0)}",
        f"rows without any citation: {rows_without}/{len(texts)}",
    ]
    if contested:
        details.append("CONTESTED: " + "; ".join(contested))
    return CheckResult("standards-quality", score, weight, not contested and dated_frac > 0.9, details)


def check_sw_class(docx_rows: list[dict]) -> CheckResult:
    tagged = [r for r in docx_rows if re.search(r"\(?Class [ABC]\)?", r.get("standards", ""))]
    frac = len(tagged) / max(len(docx_rows), 1)
    return CheckResult("sw-class-folding", 10 * frac, 10, frac == 1.0,
                       [f"{len(tagged)}/{len(docx_rows)} rows carry an IEC 62304 class"])


def check_risk_calibration(docx_rows: list[dict], doc_type: str) -> CheckResult:
    levels = Counter(r.get("risk_level", "").strip() for r in docx_rows)
    valid = {"High", "Medium", "Low"}
    invalid = {k: v for k, v in levels.items() if k not in valid}
    n = max(len(docx_rows), 1)
    high_frac = levels.get("High", 0) / n
    problems = []
    if invalid:
        problems.append(f"invalid levels: {dict(invalid)}")
    if high_frac > 0.6:
        problems.append(f"High fraction {high_frac:.0%} > 60%")
    if doc_type == "labeling" and high_frac > 0.35:
        problems.append(f"labeling High fraction {high_frac:.0%} > 35%")
    if len([k for k in levels if k in valid]) < 2:
        problems.append("fewer than 2 distinct risk levels")
    score = 10 * (1 - 0.34 * len(problems))
    return CheckResult("risk-calibration", max(score, 0), 10, not problems,
                       [f"distribution: {dict(levels)}"] + problems)


def check_approach_specificity(docx_rows: list[dict]) -> CheckResult:
    vague, unmethodical = [], []
    for r in docx_rows:
        a = r.get("compliance_approach", "")
        if VAGUE_RE.search(a):
            vague.append(r["req_id"])
        if not any(k in a.lower() for k in METHOD_KEYWORDS):
            unmethodical.append(r["req_id"])
    bad = set(vague) | set(unmethodical)
    frac = 1 - len(bad) / max(len(docx_rows), 1)
    details = []
    if vague:
        details.append(f"vague phrasing: {vague[:6]}")
    if unmethodical:
        details.append(f"no concrete method: {unmethodical[:6]}")
    return CheckResult("approach-specificity", 15 * frac, 15, not bad,
                       details or ["every approach names a concrete method"])


# ── Scored checks: Mode B ────────────────────────────────────────────────────
def check_row_quality(docs_rows: dict[str, list[dict]]) -> CheckResult:
    bad = []
    total = 0
    for doc_type, rows in docs_rows.items():
        for r in rows:
            total += 1
            t = r["requirement"]
            if not SHALL_RE.search(t) or VAGUE_RE.search(t):
                bad.append(f"{doc_type}:{r['req_id']}")
    frac = 1 - len(bad) / max(total, 1)
    return CheckResult("row-quality", 15 * frac, 15, not bad,
                       [f"{len(bad)}/{total} rows lack 'shall' or contain vague language: {bad[:8]}"]
                       if bad else [f"all {total} rows are single-shall statements"])


def check_plan_conformance(docs_rows: dict[str, list[dict]]) -> CheckResult:
    problems = []
    prod = docs_rows.get("product", [])
    prod_prefixes = {_prefix(r["req_id"]) for r in prod}
    missing = PRODUCT_PREFIXES - prod_prefixes
    if missing:
        problems.append(f"product missing prefixes: {sorted(missing)}")
    if not 35 <= len(prod) <= 95:
        problems.append(f"product row count {len(prod)} outside 35-95")
    for dt, lo, hi, pref in (("hardware", 20, 70, "HW"), ("software", 25, 90, "SW"), ("labeling", 12, 60, "LBL")):
        rows = docs_rows.get(dt, [])
        if not rows:
            problems.append(f"{dt}: no rows extracted")
            continue
        if not lo <= len(rows) <= hi:
            problems.append(f"{dt} row count {len(rows)} outside {lo}-{hi}")
        offpref = [r["req_id"] for r in rows if not r["req_id"].startswith(pref)]
        if offpref:
            problems.append(f"{dt} off-prefix ids: {offpref[:5]}")
    perf = [r for r in prod if _prefix(r["req_id"]) == "PERF"]
    nonnumeric = [r["req_id"] for r in perf if not NUMERIC_RE.search(r["requirement"])]
    if nonnumeric:
        problems.append(f"PERF rows without a number+unit: {nonnumeric}")
    score = 15 * max(0, 1 - 0.15 * len(problems))
    return CheckResult("plan-conformance", score, 15, not problems,
                       problems or ["sections, prefixes, counts and PERF numerics all conform"])


def check_trace_integrity(docs_rows: dict[str, list[dict]]) -> CheckResult:
    prod_ids = {r["req_id"] for r in docs_rows.get("product", [])}
    dangling, traced, total = [], 0, 0
    for dt, rows in docs_rows.items():
        if dt == "product":
            continue
        for r in rows:
            total += 1
            m = TRACE_RE.search(r["requirement"])
            if not m:
                continue
            traced += 1
            for ref in re.split(r"[,\s]+", m.group(1).strip()):
                if ref and not REQ_SIMPLE_RE.match(ref):
                    continue
                if ref and ref not in prod_ids:
                    dangling.append(f"{dt}:{r['req_id']}->{ref}")
    frac_ok = 1 - len(dangling) / max(traced, 1)
    return CheckResult("trace-integrity", 10 * frac_ok, 10, not dangling,
                       [f"{traced}/{total} rows carry a trace · {len(dangling)} dangling: {dangling[:8]}"])


REQ_SIMPLE_RE = re.compile(r"^[A-Z]{2,4}(-[A-Z]{2,5})?-\d{3}$")


def check_safety_bar(docs_rows: dict[str, list[dict]], concept: str) -> CheckResult:
    corpus = " ".join(r["requirement"] for rows in docs_rows.values() for r in rows)
    applicable = dict(SAFETY_BAR)
    if "PIEB" not in concept and "epidural" not in concept.lower():
        applicable.pop("NRFit / ISO 80369-6", None)
        applicable.pop("LAST warning", None)
    missing = [name for name, rx in applicable.items() if not rx.search(corpus)]
    frac = 1 - len(missing) / max(len(applicable), 1)
    return CheckResult("safety-bar", 15 * frac, 15, not missing,
                       [f"missing: {missing}"] if missing else [f"all {len(applicable)} safety items covered"])
