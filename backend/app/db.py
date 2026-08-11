"""Fail-soft Postgres persistence for breakdown and agent run history.

Doc Studio deliberately stays on its disk store (app/docgen/store.py): its
Word/CSV artifacts must live on disk for file streaming, and job.json already
persists its metadata — don't "unify" it here. This module only backs the two
features that previously had nothing: New Breakdown and the AI Capability Map.

Everything degrades to a no-op / empty list when DATABASE_URL is unset or the
database is unreachable — a dead database must never take down a live demo.
One table, document-style: a few promoted columns for listing plus the full
pydantic dump as JSONB, so schema evolution rides on the pydantic defaults.
"""
from __future__ import annotations

import logging
from typing import Any

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from .config import get_settings

log = logging.getLogger(__name__)

_pool: ConnectionPool | None = None

_SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
    id          text PRIMARY KEY,
    kind        text NOT NULL,
    agent_id    text,
    status      text NOT NULL,
    title       text NOT NULL,
    model       text,
    duration_ms integer,
    created_at  timestamptz NOT NULL DEFAULT now(),
    payload     jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS runs_kind_created_idx  ON runs (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS runs_agent_created_idx ON runs (agent_id, created_at DESC)
    WHERE kind = 'agent';
CREATE TABLE IF NOT EXISTS boundary_rules (
    seq        serial PRIMARY KEY,
    parameter  text NOT NULL,
    threshold  text NOT NULL,
    drives     text NOT NULL,
    reqs       integer NOT NULL DEFAULT 0,
    source     text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
"""

# Mock rows BC-01…BC-10 live in the frontend; stored rules continue the series.
_RULE_ID_OFFSET = 10


def _rule_id(seq: int) -> str:
    return f"BC-{seq + _RULE_ID_OFFSET:02d}"


def init() -> None:
    """Open the pool and ensure the schema exists. Called once from lifespan."""
    global _pool
    url = get_settings().database_url.strip()
    if not url:
        log.info("DATABASE_URL not set — run history disabled")
        return
    try:
        pool = ConnectionPool(url, min_size=0, max_size=4, timeout=5, open=True)
        with pool.connection() as conn:
            conn.execute(_SCHEMA)
        _pool = pool
        log.info("Run history enabled (Postgres)")
    except Exception:
        log.warning("Postgres unavailable — run history disabled", exc_info=True)


def close() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def save_run(
    run_id: str,
    kind: str,
    title: str,
    payload: dict,
    *,
    status: str = "succeeded",
    agent_id: str | None = None,
    model: str | None = None,
    duration_ms: int | None = None,
) -> None:
    if _pool is None:
        return
    try:
        with _pool.connection() as conn:
            conn.execute(
                """
                INSERT INTO runs (id, kind, agent_id, status, title, model, duration_ms, payload)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    status = EXCLUDED.status,
                    duration_ms = EXCLUDED.duration_ms,
                    payload = EXCLUDED.payload
                """,
                (run_id, kind, agent_id, status, title, model, duration_ms, Jsonb(payload)),
            )
    except Exception:
        log.warning("Could not persist run %s", run_id, exc_info=True)


def _rows(query: str, params: tuple = ()) -> list[dict[str, Any]]:
    if _pool is None:
        return []
    try:
        with _pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(query, params)
                rows = cur.fetchall()
        for row in rows:
            if row.get("created_at") is not None:
                row["created_at"] = row["created_at"].isoformat()
        return rows
    except Exception:
        log.warning("Run history query failed", exc_info=True)
        return []


def list_breakdown_runs(limit: int = 25) -> list[dict[str, Any]]:
    return _rows(
        """
        SELECT id AS run_id, status, title AS source_name, model, duration_ms, created_at,
               payload->>'source_kind' AS source_kind,
               payload->>'product' AS product,
               COALESCE(jsonb_array_length(payload->'requirements'), 0) AS requirement_count
        FROM runs WHERE kind = 'breakdown'
        ORDER BY created_at DESC LIMIT %s
        """,
        (limit,),
    )


def list_classification_runs(limit: int = 25) -> list[dict[str, Any]]:
    return _rows(
        """
        SELECT id AS run_id, status, title AS source_name, model, duration_ms, created_at,
               payload->>'product' AS product,
               COALESCE(jsonb_array_length(payload->'rows'), 0) AS requirement_count
        FROM runs WHERE kind = 'classification'
        ORDER BY created_at DESC LIMIT %s
        """,
        (limit,),
    )


def list_agent_runs(limit: int = 50) -> list[dict[str, Any]]:
    return _rows(
        """
        SELECT id AS run_id, agent_id, status, title AS scope, model, duration_ms, created_at,
               payload->>'agent_name' AS agent_name,
               payload->'result'->>'summary' AS summary
        FROM runs WHERE kind = 'agent'
        ORDER BY created_at DESC LIMIT %s
        """,
        (limit,),
    )


def list_boundary_rules() -> list[dict[str, Any]]:
    rows = _rows(
        """
        SELECT seq, parameter, threshold, drives, reqs, source, created_at
        FROM boundary_rules ORDER BY seq
        """
    )
    for row in rows:
        row["id"] = _rule_id(row.pop("seq"))
    return rows


def add_boundary_rule(
    parameter: str, threshold: str, drives: str, reqs: int, source: str
) -> dict[str, Any] | None:
    """Insert a rule and return it, or None when the store is unavailable —
    unlike save_run, the caller must be able to report the failure."""
    if _pool is None:
        return None
    try:
        with _pool.connection() as conn:
            row = conn.execute(
                """
                INSERT INTO boundary_rules (parameter, threshold, drives, reqs, source)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING seq, created_at
                """,
                (parameter, threshold, drives, reqs, source),
            ).fetchone()
        seq, created_at = row
        return {
            "id": _rule_id(seq),
            "parameter": parameter,
            "threshold": threshold,
            "drives": drives,
            "reqs": reqs,
            "source": source,
            "created_at": created_at.isoformat(),
        }
    except Exception:
        log.warning("Could not persist boundary rule", exc_info=True)
        return None


def load_payload(kind: str, run_id: str) -> dict[str, Any] | None:
    if _pool is None:
        return None
    try:
        with _pool.connection() as conn:
            row = conn.execute(
                "SELECT payload, created_at FROM runs WHERE id = %s AND kind = %s",
                (run_id, kind),
            ).fetchone()
        if row is None:
            return None
        payload, created_at = row
        payload["created_at"] = created_at.isoformat()
        return payload
    except Exception:
        log.warning("Could not load run %s", run_id, exc_info=True)
        return None
