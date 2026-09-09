"""Environment-based configuration (NFR-S4: secrets from env only)."""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache

try:  # optional; .env is convenience for local dev
    from dotenv import load_dotenv

    load_dotenv()
except Exception:  # pragma: no cover
    pass


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    execution_mode: str = os.getenv("EXECUTION_MODE", "demo").strip().lower()
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "").strip()
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()
    openai_timeout_seconds: float = float(os.getenv("OPENAI_TIMEOUT_SECONDS", "60"))

    db_path: str = os.getenv("DB_PATH", "./data/companyops.db").strip()
    backup_dir: str = os.getenv("BACKUP_DIR", "./backups").strip()

    git_remote: str = os.getenv("GIT_REMOTE", "https://github.com/DDthonWinner/TestOutput").strip()
    checkout_root: str = os.getenv("CHECKOUT_ROOT", "./checkouts").strip()
    git_subprocess_timeout_seconds: float = float(os.getenv("GIT_SUBPROCESS_TIMEOUT_SECONDS", "120"))
    # stub (default; deterministic demo) | real (subprocess git + real push)
    git_mode: str = os.getenv("GIT_MODE", "stub").strip().lower()
    # Dedicated showcase publisher; does not change other projects' GitPort.
    demo_replay_git_mode: str = os.getenv("DEMO_REPLAY_GIT_MODE", "stub").strip().lower()

    qa_test_cmd: str = os.getenv("QA_TEST_CMD", "").strip()

    host: str = os.getenv("HOST", "127.0.0.1").strip()
    port: int = int(os.getenv("PORT", "8000"))

    # SSE tuning (06 §5)
    heartbeat_seconds: int = 15

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.db_path}"

    @property
    def use_openai(self) -> bool:
        return self.execution_mode == "openai" and bool(self.openai_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
