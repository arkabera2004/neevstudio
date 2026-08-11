"""Runtime configuration, loaded from backend/.env."""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    gemini_api_key: str = ""
    # Doc Studio produces customer-facing deliverables in a single pass, and the
    # quality difference between model tiers shows up directly in the exported
    # Word file. Override per environment with GEMINI_MODEL.
    gemini_model: str = "gemini-flash-latest"
    gemini_base_url: str | None = None
    cors_origins: str = "http://localhost:8080,http://localhost:3000,http://127.0.0.1:8080"
    # Optional JSONL file for per-call token/latency telemetry (set LLM_LOG_PATH).
    # Empty disables logging entirely — the demo path never touches the disk.
    llm_log_path: str = ""
    # Optional Postgres DSN for run history (see app/db.py). Empty disables
    # persistence — the app runs exactly as before, just without history.
    database_url: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def has_key(self) -> bool:
        return bool(self.gemini_api_key.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()
