import os
from dataclasses import dataclass
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]


def _env(name: str, default: str) -> str:
    value = os.environ.get(name)
    return default if value is None or value == "" else value


def _env_int(name: str, default: int) -> int:
    return int(_env(name, str(default)))


def _env_float(name: str, default: float) -> float:
    return float(_env(name, str(default)))


@dataclass(frozen=True)
class Settings:
    db_host: str
    db_port: int
    db_name: str
    db_user: str
    db_password: str
    ml_horizon_ms: int = 15000
    ml_test_fraction: float = 0.2
    ml_threshold_sigma: float = 3.0
    ml_seed: int = 42
    ml_top_k: int = 5
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "qwen3:8b"
    ollama_timeout_s: float = 60.0

    @property
    def out_dir(self) -> Path:
        return ROOT / "ml" / "out"

    @property
    def data_dir(self) -> Path:
        return ROOT / "ml" / "data"


def load_settings() -> Settings:
    env_file = ROOT / _env("ML_ENV_FILE", ".env")
    if env_file.exists():
        load_dotenv(env_file)
    return Settings(
        db_host=_env("DB_HOST", "localhost"),
        db_port=_env_int("DB_PORT", 3306),
        db_name=_env("DB_NAME", "waitt"),
        db_user=_env("DB_USER", "waitt"),
        db_password=_env("DB_PASSWORD", "waitt"),
        ml_horizon_ms=_env_int("ML_HORIZON_MS", 15000),
        ml_test_fraction=_env_float("ML_TEST_FRACTION", 0.2),
        ml_threshold_sigma=_env_float("ML_THRESHOLD_SIGMA", 3.0),
        ml_seed=_env_int("ML_SEED", 42),
        ml_top_k=_env_int("ML_TOP_K_ANOMALIES", 5),
        ollama_host=_env("OLLAMA_HOST", "http://localhost:11434"),
        ollama_model=_env("OLLAMA_MODEL", "qwen3:8b"),
        ollama_timeout_s=_env_float("OLLAMA_TIMEOUT_S", 60.0),
    )