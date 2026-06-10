from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./xeno_crm.db"
    REDIS_URL: str = "redis://localhost:6379"
    CHANNEL_SERVICE_URL: str = "http://localhost:8001"
    CRM_RECEIPT_URL: str = "http://localhost:8000/api/receipts/callback"
    GROQ_API_KEY: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
