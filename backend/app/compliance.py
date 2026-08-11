"""Endpoints for user-created boundary-condition rules (Compliance page).

The page's BC-01…BC-10 rows are frontend mock data; rules created here persist
to Postgres via the fail-soft db module and continue the series at BC-11.
"""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from . import db

router = APIRouter(prefix="/api/compliance", tags=["compliance"])


class BoundaryRuleIn(BaseModel):
    parameter: str = Field(min_length=1, max_length=200)
    threshold: str = Field(min_length=1, max_length=100)
    drives: Literal["CTS", "CTQ"]
    source: str = Field(min_length=1, max_length=200)
    reqs: int = Field(default=0, ge=0)


class BoundaryRule(BoundaryRuleIn):
    id: str
    created_at: str


@router.get("/rules", response_model=list[BoundaryRule])
def list_rules() -> list[BoundaryRule]:
    """Saved rules, oldest first (empty when Postgres is not configured)."""
    return [BoundaryRule.model_validate(r) for r in db.list_boundary_rules()]


@router.post("/rules", response_model=BoundaryRule)
def create_rule(body: BoundaryRuleIn) -> BoundaryRule:
    saved = db.add_boundary_rule(
        parameter=body.parameter.strip(),
        threshold=body.threshold.strip(),
        drives=body.drives,
        reqs=body.reqs,
        source=body.source.strip(),
    )
    if saved is None:
        raise HTTPException(
            status_code=503,
            detail="Rule store unavailable — check DATABASE_URL and that Postgres is running.",
        )
    return BoundaryRule.model_validate(saved)
