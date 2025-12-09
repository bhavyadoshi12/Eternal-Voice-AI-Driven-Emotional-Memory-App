#!/usr/bin/env python3
"""
Database initialization script
Run this once to set up the database tables
"""

import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.database import init_db, engine
from backend import models

def initialize_database():
    print("🔄 Initializing Eternal Voice Database...")
    
    try:
        # Create all tables
        models.Base.metadata.create_all(bind=engine)
        print("✅ Database tables created successfully!")
        
        # Verify tables were created
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        print("📊 Created tables:")
        for table in tables:
            print(f"   - {table}")
            
        print(f"🎉 Database initialization complete!")
        
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        sys.exit(1)

if __name__ == "__main__":
    initialize_database()