from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # MongoDB — running as a local Windows service by default; point MONGO_URI at
    # mongodb://host.docker.internal:27017 if the backend itself runs in Docker.
    MONGO_URI: str = "mongodb://localhost:27017"
    MONGO_DB_NAME: str = "dermato"
    UPLOAD_DIR: str = "uploads"
    MAX_IMAGE_SIZE_MB: int = 10
    MIN_BLUR_VARIANCE: float = 80.0
    MIN_BRIGHTNESS: float = 50.0
    MAX_BRIGHTNESS: float = 210.0
    # Kept deliberately low — this only needs to catch photos with essentially no
    # skin in frame (a blank wall, ceiling, paper); a high threshold would risk
    # false-rejecting valid photos across the full range of skin tones/lighting.
    MIN_SKIN_PIXEL_PCT: float = 4.0

    # Auth — override SECRET_KEY and ADMIN_PASSWORD via .env for anything beyond local dev
    SECRET_KEY: str = "dev-insecure-secret-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    PASSWORD_RESET_EXPIRE_MINUTES: int = 30

    # Seeded once at startup if the users table is empty
    ADMIN_EMAIL: str = "admin@dermato.local"
    ADMIN_PASSWORD: str = "changeme123"

    # Used to build the link inside password-reset emails
    FRONTEND_URL: str = "http://localhost:3000"

    # SMTP — leave SMTP_HOST empty for local dev; reset links are logged to the
    # console instead of emailed so the flow is testable without real mail infra.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "no-reply@dermato.local"

    # Rate limiting (requests per minute) for auth endpoints
    LOGIN_RATE_LIMIT: str = "5/minute"

    # Comma-separated list of allowed CORS origins
    CORS_ORIGINS: str = "http://localhost:3000"

    class Config:
        env_file = ".env"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
