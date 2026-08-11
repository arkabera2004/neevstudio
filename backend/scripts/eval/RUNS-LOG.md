# Eval iterations log

Append-only. One entry per suite iteration (`backend/eval_runs/<id>/`).
Suite = 4× Mode A (customer files) + 2× Mode B (presets) + 1× breakdown.

## smoke — 2026-07-22 · gpt-5.4-mini

First-ever real generations. Gates: matrix all green; docset FAILED
`gate:roundtrip:product` (renderer silently dropped 8 SYS rows when the model
put requirement rows in the first level-1 section — fixed in `render_docx.py`
by rendering rows after the overview meta-table instead of `continue`).
Found and fixed before this run: config default named a nonexistent model
(`gpt-5.5-mini` → `gpt-5.4-mini`). Learned: matrix runs 9–41 s, docset ~85 s.

## it01-mini — 2026-07-22 · gpt-5.4-mini · mean 86.5 · gates GREEN

Baseline after renderer fix. Issues ranked: (1) contested citations
`IEC 60601-1-2:2020` / `IEC 60601-1-6:2020` — traced to the grounding's own
whitelist, a data error, not model behavior; (2) High-risk inflation 68–81% vs
reference 51–57%; (3) PIEB software doc echoed SYS- rows; (4) Mode B REG rows
undated; (5) PIEB set missing numeric occlusion thresholds — root cause:
`concept_grounding` never included the BENCHMARKS block. ~7 min, ~185k tokens.

*(it02–it04 — mini variance repeat and gpt-5.5 comparison — PARKED by Daniel on
22 Jul to hit the demo deadline; see CLAUDE.md "Parked — model comparison".)*

## it05-prompts — 2026-07-22 · gpt-5.4-mini · mean 95.2 (96.6 rescored) · gates GREEN

Fixes: grounding citation strings corrected to consolidated editions (verified
against IEC webstore); risk-rubric calibration paragraph; BENCHMARKS +
STANDARDS_WHITELIST added to docset prompts; software-doc "SW- ids only" rule;
PERF = quantitative-only; REG dated-citation rule; row-range tightening.
Result: contested-citation queue EMPTY; matrix-labeling and matrix-product hit
100; PIEB occlusion tiers present. Rescore to 96.6 after fixing the eval's own
dated-fraction metric (it penalized legitimately-undated forms like ISO 80369-6).

## it06-risk — 2026-07-22 · gpt-5.4-mini · mean 95.7 · gates GREEN · **PLATEAU — stop**

Fixes: worked boundary examples in the risk rubric; SAF section must include
tiered authentication. docset-pieb 97.5 (all checks green). Residual: High
fraction 60–70% on hw/sw matrices (reference 51–57%) — declared a documented
safe-side deviation (DEVIATIONS.md D2) rather than chased; volumetric preset
occasionally misfiles one PERF row (variance-level). Stopping criteria met:
gates green, contested queue empty, composite plateaued (95.2 → 96.6 → 95.7).

**Demo configuration locked: `OPENAI_MODEL=gpt-5.4-mini`.** Timing medians for
the runbook — matrix: labeling ~10 s, product/hardware ~19–34 s, software
~40 s; docset ~68–78 s; breakdown ~58–67 s.
