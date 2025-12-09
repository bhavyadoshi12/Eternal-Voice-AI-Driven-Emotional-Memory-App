#!/usr/bin/env python3
"""
scripts/migrate_profiles_unique.py

Apply a UNIQUE constraint to the `profiles.name` column in SQLite safely.
This script will:
- Backup `data/db.sqlite3` to `data/db.sqlite3.migration.bak`
- Remove duplicates (keeping lowest id per name)
- Recreate `profiles` table with `name` set to UNIQUE
- Copy data from old table to new table
- Preserve existing column values where possible

Run from project root inside your virtualenv:

    python .\scripts\migrate_profiles_unique.py

Caution: Always backup before running. This script attempts to be safe by creating a backup.
"""
from pathlib import Path
import sqlite3
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / 'data' / 'db.sqlite3'
BACKUP = ROOT / 'data' / 'db.sqlite3.migration.bak'

if not DB.exists():
    print(f"Database not found at {DB}")
    sys.exit(1)

print(f"Backing up database: {DB} -> {BACKUP}")
shutil.copy2(DB, BACKUP)

conn = sqlite3.connect(str(DB))
cur = conn.cursor()

print("Step 1: Remove duplicates keeping lowest id per name...")
cur.execute("BEGIN TRANSACTION;")
cur.execute("DELETE FROM profiles WHERE id NOT IN (SELECT MIN(id) FROM profiles GROUP BY name);")
conn.commit()
print("Duplicates removed.")

print("Step 2: Create temporary table with UNIQUE constraint on name")
# Create new temporary table matching expected schema (adjust types as needed)
cur.execute("PRAGMA foreign_keys=OFF;")
conn.commit()

# We construct a new table named profiles_new
cur.execute('''
CREATE TABLE IF NOT EXISTS profiles_new (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    relationship VARCHAR(100),
    description TEXT,
    consent_given BOOLEAN DEFAULT 0,
    consent_timestamp DATETIME DEFAULT (CURRENT_TIMESTAMP),
    created_at DATETIME DEFAULT (CURRENT_TIMESTAMP),
    updated_at DATETIME
);
''')
conn.commit()

print("Step 3: Copy data from old table to new table (only columns that exist)")
# Copy column data - ensure column names match the existing table
cur.execute('''
INSERT INTO profiles_new (id, name, relationship, description, consent_given, consent_timestamp, created_at, updated_at)
SELECT id, name, relationship, description, consent_given, consent_timestamp, created_at, updated_at
FROM profiles;
''')
conn.commit()

print("Step 4: Replace old table with new table")
cur.execute('BEGIN TRANSACTION;')
cur.execute('DROP TABLE profiles;')
cur.execute('ALTER TABLE profiles_new RENAME TO profiles;')
conn.commit()

print("Step 5: Re-enable foreign keys and VACUUM")
cur.execute('PRAGMA foreign_keys=ON;')
conn.commit()
cur.execute('VACUUM;')
conn.close()
print("Migration complete. Please restart your backend and verify." )
