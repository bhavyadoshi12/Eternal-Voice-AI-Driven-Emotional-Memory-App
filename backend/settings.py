import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
load_dotenv()

# Base directory
BASE_DIR = Path(__file__).resolve().parent.parent

class Settings:
    # App Settings
    APP_NAME = "Eternal Voice"
    APP_VERSION = "1.0.0"
    DEBUG = os.getenv("DEBUG", "false").lower() == "true"
    
    # Server Configuration
    HOST = os.getenv("APP_HOST", "127.0.0.1")
    PORT = int(os.getenv("APP_PORT", 8000))
    
    # Database
    DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/data/db.sqlite3")
    
    # File Paths
    UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", BASE_DIR / "data" / "uploads"))
    PROCESSED_DIR = Path(os.getenv("PROCESSED_DIR", BASE_DIR / "data" / "processed"))
    GENERATED_DIR = Path(os.getenv("GENERATED_DIR", BASE_DIR / "data" / "generated"))
    
    # Create directories if they don't exist
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    
    # AI Configuration
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")
    GPT_MODEL = os.getenv("GPT_MODEL", "gpt-4o-mini")
    TTS_ENGINE = os.getenv("TTS_ENGINE", "pyttsx3")
    
    # Security
    SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    ENABLE_ENCRYPTION = os.getenv("ENABLE_ENCRYPTION", "false").lower() == "true"

# Global settings instance
settings = Settings()