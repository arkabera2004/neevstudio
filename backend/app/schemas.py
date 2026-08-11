"""Request/response contracts.

Every agent returns the SAME generic, renderable result shape (`AgentResult`) —
a short summary plus a list of typed `sections`. This lets one frontend renderer
display rich output for all nine agents without a bespoke component per agent.
"""
from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field


# ── Section types (discriminated union on `type`) ─────────────────────────────
class TableSection(BaseModel):
    type: Literal["table"] = "table"
    title: str
    columns: list[str]
    rows: list[list[str]]


class ListSection(BaseModel):
    type: Literal["list"] = "list"
    title: str
    items: list[str]


class CardItem(BaseModel):
    title: str
    subtitle: str | None = None
    badge: str | None = None
    body: str | None = None


class CardsSection(BaseModel):
    type: Literal["cards"] = "cards"
    title: str
    items: list[CardItem]


class KV(BaseModel):
    key: str
    value: str


class KVSection(BaseModel):
    type: Literal["kv"] = "kv"
    title: str
    pairs: list[KV]


class MarkdownSection(BaseModel):
    type: Literal["markdown"] = "markdown"
    title: str | None = None
    text: str


Section = Annotated[
    Union[TableSection, ListSection, CardsSection, KVSection, MarkdownSection],
    Field(discriminator="type"),
]


class AgentResult(BaseModel):
    summary: str
    sections: list[Section] = Field(default_factory=list)


# ── API request/response ──────────────────────────────────────────────────────
class RunRequest(BaseModel):
    # Optional free-text scope override; if omitted the agent uses its default scope.
    scope: str | None = None


class AgentInfo(BaseModel):
    id: str
    name: str
    group: str
    status: str
    description: str


class RunResponse(BaseModel):
    agent_id: str
    agent_name: str
    scope: str
    model: str
    duration_ms: int
    result: AgentResult


# ── Persisted run history (see app/db.py) ─────────────────────────────────────
class AgentRunSummary(BaseModel):
    run_id: str
    agent_id: str
    agent_name: str
    scope: str
    model: str | None = None
    duration_ms: int | None = None
    created_at: str
    summary: str | None = None


class AgentRunRecord(RunResponse):
    run_id: str
    created_at: str
