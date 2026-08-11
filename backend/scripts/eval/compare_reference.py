"""Side-by-side comparison of generated output vs the PoC reference deliverables.

Informative, not scored — correctness beats parity. Disagreements get triaged by
a human into: generation wrong (prompt fix) / reference wrong (DEVIATIONS.md) /
both defensible.

Usage: python scripts/eval/compare_reference.py --iteration it01
Writes eval_runs/<iteration>/diffs/<run>.md
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.eval.checks import extract_citations  # noqa: E402
from scripts.eval.common import EVAL_ROOT, REFERENCE_DIR  # noqa: E402
from scripts.eval.extract_docx import extract_rows  # noqa: E402

MATRIX_REFERENCE = {
    "matrix-product": "Infusion_Pump_System_Requirements_Compliance.docx",
    "matrix-hardware": "Infusion_Pump_Hardware_Requirements_Compliance.docx",
    "matrix-software": "Infusion_Pump_Software_Requirements_Compliance.docx",
    "matrix-labeling": "Infusion_Pump_Labeling_Requirements_Compliance.docx",
}
PIEB_REFERENCE = {
    "product": "PIEB_Pump_Product_Requirements.docx",
    "hardware": "PIEB_Pump_Hardware_Requirements.docx",
    "software": "PIEB_Pump_Software_Requirements.docx",
    "labeling": "PIEB_Pump_Labeling_Requirements.docx",
}


def _norm_cites(text: str) -> set[str]:
    return {re.sub(r"\s+", " ", c) for c in extract_citations(text)}


def compare_matrix(run_dir: Path, ref_path: Path) -> str:
    gen_files = sorted(run_dir.glob("files/*.docx"))
    gen = {r["req_id"]: r for r in extract_rows(gen_files[0])} if gen_files else {}
    ref = {r["req_id"]: r for r in extract_rows(ref_path)}
    common_ids = [i for i in ref if i in gen]

    risk_agree = sum(1 for i in common_ids if gen[i].get("risk_level") == ref[i].get("risk_level"))
    lines = [
        f"# {run_dir.name} vs {ref_path.name}",
        "",
        f"- req_id overlap: {len(common_ids)}/{len(ref)} reference ids matched "
        f"({len(gen)} generated)",
        f"- risk-level agreement: {risk_agree}/{len(common_ids)}",
        "",
        "| Req ID | Risk ref→gen | Standards only in ref | Standards only in gen |",
        "|---|---|---|---|",
    ]
    for i in common_ids:
        rc, gc = _norm_cites(ref[i].get("standards", "")), _norm_cites(gen[i].get("standards", ""))
        risk = f"{ref[i].get('risk_level', '?')}→{gen[i].get('risk_level', '?')}"
        if ref[i].get("risk_level") == gen[i].get("risk_level"):
            risk = ref[i].get("risk_level", "?")
        lines.append(f"| {i} | {risk} | {', '.join(sorted(rc - gc)) or '—'} | {', '.join(sorted(gc - rc)) or '—'} |")
    lines += ["", "## Full row comparison (spot-read)", ""]
    for i in common_ids:
        lines += [
            f"### {i} — {ref[i]['requirement'][:120]}",
            f"- **ref approach:** {ref[i].get('compliance_approach', '')}",
            f"- **gen approach:** {gen[i].get('compliance_approach', '')}",
            f"- **ref rationale:** {ref[i].get('rationale', '')}",
            f"- **gen rationale:** {gen[i].get('rationale', '')}",
            "",
        ]
    return "\n".join(lines)


def compare_docset(run_dir: Path) -> str:
    job = json.loads((run_dir / "job.json").read_text())
    lines = [f"# {run_dir.name} vs PIEB reference set", ""]
    for doc in job.get("docs", []):
        ref_file = PIEB_REFERENCE.get(doc["doc_type"])
        if not ref_file:
            continue
        ref_rows = extract_rows(REFERENCE_DIR / ref_file)
        gen_n = sum(len(s.get("rows", [])) for s in doc.get("sections", []))
        gen_sections = [s.get("title", "") for s in doc.get("sections", [])]
        ref_sections = sorted({r["section"] for r in ref_rows if r["section"]})
        ref_prefixes = sorted({r["req_id"].rsplit("-", 1)[0] for r in ref_rows})
        gen_prefixes = sorted({r["req_id"].rsplit("-", 1)[0] for s in doc.get("sections", []) for r in s.get("rows", [])})
        lines += [
            f"## {doc['doc_type']} — {ref_file}",
            f"- rows: ref {len(ref_rows)} · gen {gen_n}",
            f"- ref id groups: {', '.join(ref_prefixes)}",
            f"- gen id groups: {', '.join(gen_prefixes)}",
            f"- gen sections: {'; '.join(gen_sections)}",
            f"- ref sections: {'; '.join(ref_sections)}",
            "",
        ]
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--iteration", required=True)
    args = ap.parse_args()
    it_dir = EVAL_ROOT / args.iteration
    diffs = it_dir / "diffs"
    diffs.mkdir(exist_ok=True)
    for run_dir in sorted(p for p in it_dir.iterdir() if p.is_dir() and p.name != "diffs"):
        if run_dir.name in MATRIX_REFERENCE:
            out = compare_matrix(run_dir, REFERENCE_DIR / MATRIX_REFERENCE[run_dir.name])
        elif run_dir.name.startswith("docset"):
            out = compare_docset(run_dir)
        else:
            continue
        (diffs / f"{run_dir.name}.md").write_text(out, encoding="utf-8")
        print(f"wrote diffs/{run_dir.name}.md")


if __name__ == "__main__":
    main()
