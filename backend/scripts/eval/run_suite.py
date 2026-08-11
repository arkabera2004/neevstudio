"""Run the 7-run eval suite against a running backend and capture everything.

Usage:
  python scripts/eval/run_suite.py --iteration it01 [--only matrix|docset|breakdown] [--skip-score]

Sequential on purpose: it mirrors the demo (single process, one run at a time)
and keeps per-run telemetry deltas unambiguous.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.eval import common  # noqa: E402


def run_one(c, name: str, start_fn, endpoint: str, it_dir: Path, meta: dict, offset: int) -> int:
    print(f"→ {name} ...", flush=True)
    t0 = time.monotonic()
    job = start_fn(c)
    final, timeline = common.poll_job(c, job["job_id"], endpoint=endpoint)
    wall = round(time.monotonic() - t0, 1)
    llm_lines, offset = common.read_llm_log_delta(offset)

    run_dir = it_dir / name
    common.save_json(run_dir / "job.json", final)
    common.save_json(run_dir / "timeline.json", timeline)
    common.save_json(run_dir / "llm_calls.json", llm_lines)
    common.save_json(run_dir / "run_meta.json", {**meta, "wall_s": wall})
    if final.get("files"):
        common.download_files(c, final, run_dir / "files")
    tok = sum((l.get("prompt_tokens") or 0) + (l.get("completion_tokens") or 0) for l in llm_lines)
    print(f"  {final['status']} in {wall}s · {len(llm_lines)} calls · {tok} tokens", flush=True)
    return offset


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--iteration", required=True)
    ap.add_argument("--only", choices=["matrix", "docset", "breakdown"])
    ap.add_argument("--skip-score", action="store_true")
    args = ap.parse_args()

    it_dir = common.EVAL_ROOT / args.iteration
    it_dir.mkdir(parents=True, exist_ok=True)

    with common.client() as c:
        health = common.check_health(c)
        print(f"backend ok · model={health['model']}")
        _, offset = common.read_llm_log_delta(0)  # skip to current end of telemetry log

        if args.only in (None, "matrix"):
            for fname in common.CUSTOMER_FILES:
                path = common.CUSTOMER_DIR / fname
                short = fname.replace("Infusion_Pump_", "").replace("_Requirements", "").replace(
                    "Sample_Product_", "product_").replace(".docx", "").lower().strip("_")
                offset = run_one(
                    c, f"matrix-{short}",
                    lambda c, p=path: common.post_matrix(c, p),
                    "/api/docgen/jobs/{id}", it_dir,
                    {"mode": "matrix", "input": fname}, offset)

        if args.only in (None, "docset"):
            for label, concept in (("pieb", common.PRESET_PIEB), ("volumetric", common.PRESET_VOLUMETRIC)):
                offset = run_one(
                    c, f"docset-{label}",
                    lambda c, k=concept: common.post_docset(c, k),
                    "/api/docgen/jobs/{id}", it_dir,
                    {"mode": "docset", "concept": concept}, offset)

        if args.only in (None, "breakdown"):
            path = common.CUSTOMER_DIR / common.CUSTOMER_FILES[0]
            offset = run_one(
                c, "breakdown-sample",
                lambda c: common.post_breakdown_ingest(c, path),
                "/api/breakdown/jobs/{id}", it_dir,
                {"mode": "breakdown", "input": path.name}, offset)

    if not args.skip_score:
        from scripts.eval import score
        sys.argv = ["score.py", "--iteration", args.iteration]
        score.main()


if __name__ == "__main__":
    main()
