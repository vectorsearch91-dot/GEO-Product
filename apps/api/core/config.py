import os
from functools import lru_cache

class Settings:
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./geo_platform.db")
    CORS_ORIGINS: list = ["*"]
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    APP_NAME: str = "GEO Platform"
    APP_VERSION: str = "1.0.0"

    # LLM Model Mapping (via OpenRouter)
    LLM_ENGINES = {
        "chatgpt": {"model": "openai/gpt-4o-mini", "display_name": "ChatGPT (GPT-4o)"},
        "gemini": {"model": "google/gemini-flash-1.5", "display_name": "Google Gemini"},
        "claude": {"model": "anthropic/claude-3-haiku", "display_name": "Claude"},
        "perplexity": {"model": "perplexity/llama-3.1-sonar-small-128k-online", "display_name": "Perplexity"},
    }
    VISION_MODEL: str = "openai/gpt-4o"
    PERSONA_MODEL: str = "google/gemini-flash-1.5"   # Gemini for persona generation
    SEEDING_MODEL: str = "openai/gpt-4o-mini"

    QUERIES_PER_PERSONA: int = 2   # default — user can override
    MAX_SIMULATION_WORKERS: int = 6

@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
