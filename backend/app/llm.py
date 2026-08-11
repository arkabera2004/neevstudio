"""Thin Gemini wrapper that returns a validated `AgentResult`."""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone

from google import genai
from google.genai import types as genai_types
from google.genai.errors import APIError as GeminiAPIError

from .config import get_settings
from .schemas import AgentResult, MarkdownSection


def _log_usage(response, model: str, duration_ms: int) -> None:
    """Append one JSONL telemetry line when LLM_LOG_PATH is set; never raises."""
    settings = get_settings()
    if not settings.llm_log_path:
        return
    usage = getattr(response, "usage_metadata", None)
    line = {
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "model": model,
        "prompt_tokens": getattr(usage, "prompt_token_count", None),
        "completion_tokens": getattr(usage, "candidates_token_count", None),
        "duration_ms": duration_ms,
    }
    try:
        with open(settings.llm_log_path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(line) + "\n")
    except OSError:
        pass

# Contract the model must follow. Every agent returns this same shape so a single
# frontend renderer can display all of them.
FORMAT_INSTRUCTIONS = """\
Return ONLY a JSON object (no prose, no markdown fences) matching this shape:

{
  "summary": "1-2 sentence executive summary of what you produced",
  "sections": [ <one or more section objects> ]
}

Each section object is one of these types:

- Table:    {"type":"table","title":str,"columns":[str,...],"rows":[[str,...],...]}
- List:     {"type":"list","title":str,"items":[str,...]}
- Cards:    {"type":"cards","title":str,"items":[{"title":str,"subtitle":str?,"badge":str?,"body":str?},...]}
- KeyValue: {"type":"kv","title":str,"pairs":[{"key":str,"value":str},...]}
- Markdown: {"type":"markdown","title":str?,"text":str}

Rules:
- Use table/cards/kv for structured data; use markdown only for prose (e.g. SRS text).
- Keep every string concise. Use the real IDs from the provided context (REQ-*, BC-*, part IDs, standards).
- Produce realistic, specific engineering content grounded in the context — never placeholders.
"""


class LLMError(Exception):
    """Raised when the model call fails or the key is missing."""


def _client() -> genai.Client:
    settings = get_settings()
    kwargs: dict = {"api_key": settings.gemini_api_key}
    if settings.gemini_base_url:
        kwargs["http_options"] = genai_types.HttpOptions(base_url=settings.gemini_base_url)
    return genai.Client(**kwargs)


def _generate(system: str, task: str, temperature: float):
    settings = get_settings()
    client = _client()
    return client.models.generate_content(
        model=settings.gemini_model,
        contents=task,
        config=genai_types.GenerateContentConfig(
            system_instruction=system,
            temperature=temperature,
            response_mime_type="application/json",
        ),
    )


def complete_json(system: str, task: str, temperature: float = 0.3) -> dict:
    """Call the model in JSON mode and return the parsed object.

    Unlike `run_agent_llm`, a malformed response raises rather than degrading to
    markdown — the ingest pipeline needs structured data, and a caller that wants
    to tolerate a bad stage should decide that for itself.
    """
    settings = get_settings()
    if not settings.has_key:
        raise LLMError(
            "GEMINI_API_KEY is not set. Add your key to backend/.env and restart the backend."
        )

    started = time.monotonic()
    try:
        response = _generate(system, task, temperature)
    except GeminiAPIError as exc:
        raise LLMError(f"Gemini request failed: {exc}") from exc
    _log_usage(response, settings.gemini_model, int((time.monotonic() - started) * 1000))

    raw = response.text or "{}"
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise LLMError(f"Model returned invalid JSON: {exc}") from exc


def complete_json_retry(
    system: str, task: str, temperature: float = 0.3, retries: int = 1
) -> dict:
    """`complete_json` with a bounded retry.

    `LLMError` already covers both a failed request and unparseable JSON, which
    are the two things worth retrying — a transient upstream error and a model
    that opened with prose. One extra attempt is the whole budget: a call that
    fails twice is not going to succeed on the third while a demo audience
    watches the progress bar.
    """
    for attempt in range(retries + 1):
        try:
            return complete_json(system, task, temperature)
        except LLMError:
            if attempt == retries:
                raise
    raise LLMError("unreachable")  # pragma: no cover - loop always returns or raises


def run_agent_llm(system_role: str, task: str) -> tuple[AgentResult, str]:
    """Call the model and return (validated result, model name)."""
    settings = get_settings()
    if not settings.has_key:
        raise LLMError(
            "GEMINI_API_KEY is not set. Add your key to backend/.env and restart the backend."
        )

    system = f"{system_role}\n\n{FORMAT_INSTRUCTIONS}"

    started = time.monotonic()
    try:
        response = _generate(system, task, 0.4)
    except GeminiAPIError as exc:  # network/auth/rate-limit/etc.
        raise LLMError(f"Gemini request failed: {exc}") from exc
    _log_usage(response, settings.gemini_model, int((time.monotonic() - started) * 1000))

    raw = response.text or "{}"

    try:
        data = json.loads(raw)
        result = AgentResult.model_validate(data)
    except Exception:
        # Model returned something off-contract — degrade gracefully to markdown
        # so the demo still shows the content rather than an error.
        result = AgentResult(
            summary="Model returned unstructured output; showing raw text.",
            sections=[MarkdownSection(text=raw)],
        )

    return result, settings.gemini_model
