"""Document-generation feature (Doc Studio).

Two single-pass LLM pipelines that produce customer-grade deliverables:

  Mode A — Compliance Matrix: an uploaded requirements .docx is parsed into
  structured sections, each requirement is enriched with compliance analysis
  (rationale, standards, approach, hazard, risk level), and the result is
  rendered as a landscape 7-column compliance & traceability matrix (.docx +
  .csv). Requirement IDs and text are preserved verbatim from the source.

  Mode B — Document Set: a therapy/device concept is expanded, via four chained
  generation calls, into a coherent Product / Hardware / Software / Labeling
  requirement set, rendered as four portrait requirement docs (.docx + .csv,
  bundled as a .zip).

Kept separate from `app.ingest` (the breakdown pipeline) — the two share only
the job store, StageState, the LLM wrapper, the grounding corpus and the
engineer persona; everything else here is genuinely new.
"""
