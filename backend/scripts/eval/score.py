"""Score an eval iteration folder: gates + weighted rubric -> scores.json + report.md.

Usage: python scripts/eval/score.py --iteration it01
Deterministic: same folder in, byte-identical scores.json out.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.eval import checks  # noqa: E402
from scripts.eval.common import EVAL_ROOT, save_json  # noqa: E402
from scripts.eval.extract_docx import extract_rows  # noqa: E402


def _docs_rows_from_job(job: dict) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for doc in job.get("docs", []):
        rows = []
        for section in doc.get("sections", []):
            for r in section.get("rows", []):
                rows.append({"section": section.get("title", ""), "req_id": r["req_id"], "requirement": r["text"]})
        out[doc["doc_type"]] = rows
    return out


def score_matrix_run(run_dir: Path, job: dict) -> dict:
    docx_files = sorted(run_dir.glob("files/*.docx"))
    docx_rows = extract_rows(docx_files[0]) if docx_files else []
    doc_type = (job.get("matrix") or {}).get("doc_type", "generic")

    results = checks.gates_matrix(job, docx_rows)
    results.append(checks.check_column_completeness(docx_rows))
    results.append(checks.check_standards_quality([r.get("standards", "") for r in docx_rows]))
    if doc_type == "software":
        results.append(checks.check_sw_class(docx_rows))
    results.append(checks.check_risk_calibration(docx_rows, doc_type))
    results.append(checks.check_approach_specificity(docx_rows))
    return _summarize(results, extra={"doc_type": doc_type, "rows": len(docx_rows)})


def score_docset_run(run_dir: Path, job: dict, concept: str) -> dict:
    docs_rows = _docs_rows_from_job(job)
    results = checks.gates_docset(job, docs_rows)

    # docx round-trip gate: every per-doc docx re-extracts the same row count.
    for doc_type, rows in docs_rows.items():
        matches = [p for p in run_dir.glob("files/*.docx") if doc_type[:4].lower() in p.name.lower()]
        if matches:
            extracted = extract_rows(matches[0])
            results.append(checks.CheckResult(
                f"gate:roundtrip:{doc_type}", 0, 0, len(extracted) == len(rows),
                [f"docx={len(extracted)} api={len(rows)}"]))

    all_texts = [r["requirement"] for rows in docs_rows.values() for r in rows]
    results.append(checks.check_row_quality(docs_rows))
    results.append(checks.check_standards_quality(all_texts))
    results.append(checks.check_plan_conformance(docs_rows))
    results.append(checks.check_trace_integrity(docs_rows))
    results.append(checks.check_safety_bar(docs_rows, concept))
    return _summarize(results, extra={"docs": {k: len(v) for k, v in docs_rows.items()}})


def score_breakdown_run(job: dict) -> dict:
    reqs = job.get("requirements", [])
    gaps = [r for r in reqs if r.get("origin") == "gap"]
    results = [
        checks.CheckResult("gate:status", 0, 0, job["status"] in ("succeeded", "partial"),
                           [f"status={job['status']}"]),
        checks.CheckResult("info:requirements", 0, 0, len(reqs) > 30, [f"{len(reqs)} requirements"]),
        checks.CheckResult("info:gaps", 0, 0, len(gaps) > 0, [f"{len(gaps)} gaps identified"]),
    ]
    return _summarize(results, extra={"requirements": len(reqs), "gaps": len(gaps)})


def _summarize(results: list[checks.CheckResult], extra: dict | None = None) -> dict:
    gates = [r for r in results if r.max_points == 0]
    scored = [r for r in results if r.max_points > 0]
    earned = sum(r.earned for r in scored)
    possible = sum(r.max_points for r in scored)
    return {
        **(extra or {}),
        "gates_passed": all(g.passed for g in gates),
        "composite": round(100 * earned / possible, 1) if possible else None,
        "checks": [
            {"name": r.name, "earned": round(r.earned, 2), "max": r.max_points,
             "passed": r.passed, "details": r.details}
            for r in results
        ],
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--iteration", required=True)
    args = ap.parse_args()
    it_dir = EVAL_ROOT / args.iteration
    if not it_dir.is_dir():
        raise SystemExit(f"No iteration folder {it_dir}")

    all_scores: dict[str, dict] = {}
    for run_dir in sorted(p for p in it_dir.iterdir() if p.is_dir()):
        job_file = run_dir / "job.json"
        meta_file = run_dir / "run_meta.json"
        if not job_file.exists():
            continue
        job = json.loads(job_file.read_text())
        meta = json.loads(meta_file.read_text()) if meta_file.exists() else {}
        mode = meta.get("mode") or job.get("mode")
        if mode == "matrix":
            all_scores[run_dir.name] = score_matrix_run(run_dir, job)
        elif mode == "docset":
            all_scores[run_dir.name] = score_docset_run(run_dir, job, meta.get("concept", ""))
        else:
            all_scores[run_dir.name] = score_breakdown_run(job)
        all_scores[run_dir.name]["model"] = job.get("model")
        all_scores[run_dir.name]["duration_ms"] = job.get("duration_ms")

    composites = [s["composite"] for s in all_scores.values() if s.get("composite") is not None]
    summary = {
        "iteration": args.iteration,
        "gates_all_passed": all(s["gates_passed"] for s in all_scores.values()),
        "mean_composite": round(sum(composites) / len(composites), 1) if composites else None,
        "runs": all_scores,
    }
    save_json(it_dir / "scores.json", summary)
    _write_report(it_dir, summary)
    print(f"gates_all_passed={summary['gates_all_passed']} mean_composite={summary['mean_composite']}")


def _write_report(it_dir: Path, summary: dict) -> None:
    lines = [
        f"# Eval report — {summary['iteration']}",
        "",
        f"**Gates:** {'ALL PASSED' if summary['gates_all_passed'] else 'FAILURES'} · "
        f"**Mean composite:** {summary['mean_composite']}",
        "",
    ]
    contested_all: list[str] = []
    for name, s in summary["runs"].items():
        dur = f"{s['duration_ms'] / 1000:.1f}s" if s.get("duration_ms") else "n/a"
        lines.append(f"## {name} — composite {s.get('composite')} · {s.get('model')} · {dur}")
        lines.append("")
        for c in s["checks"]:
            mark = "✅" if c["passed"] else "❌"
            pts = f" ({c['earned']}/{c['max']})" if c["max"] else ""
            lines.append(f"- {mark} **{c['name']}**{pts}: " + " · ".join(c["details"]))
            for d in c["details"]:
                if d.startswith("CONTESTED"):
                    contested_all.append(f"{name}: {d[11:]}")
        lines.append("")
    lines.append("## Contested citations (audit queue)")
    lines.append("")
    lines += [f"- {c}" for c in contested_all] or ["- none 🎉"]
    (it_dir / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
