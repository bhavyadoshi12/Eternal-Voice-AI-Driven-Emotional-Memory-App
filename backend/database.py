# backend/database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from backend.settings import settings, BASE_DIR
from pathlib import Path

# Ensure data directory exists (relative to BASE_DIR)
data_dir = (BASE_DIR / "data")
data_dir.mkdir(parents=True, exist_ok=True)

# Convert relative sqlite URL to absolute path so DB is always in project/data/db.sqlite3
_db_url = settings.DATABASE_URL

# Handle common forms: sqlite:///./data/db.sqlite3  or sqlite:///data/db.sqlite3
if _db_url.startswith("sqlite:///"):
    rel_path = _db_url[len("sqlite:///"):]
    abs_path = (BASE_DIR / rel_path).resolve()
    db_url = f"sqlite:///{abs_path}"
else:
    db_url = _db_url

# Create SQLAlchemy engine using computed db_url
engine = create_engine(
    db_url,
    connect_args={"check_same_thread": False} if db_url.startswith("sqlite:///") else {}
)

# SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Initialize database with tables
def init_db():
    try:
        print("Initializing database at:", engine.url)
        if hasattr(engine.url, "database"):
            db_file = Path(str(engine.url.database))
            db_file.parent.mkdir(parents=True, exist_ok=True)
            print("Database file (absolute):", db_file)
    except Exception:
        pass

    Base.metadata.create_all(bind=engine)
    print("Database initialization complete.")
