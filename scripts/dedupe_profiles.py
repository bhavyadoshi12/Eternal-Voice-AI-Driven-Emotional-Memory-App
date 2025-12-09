#!/usr/bin/env python3
"""
scripts/dedupe_profiles.py

Safely remove duplicate profile rows keeping the lowest id per name.
Run from project root inside your virtualenv:

    python .\scripts\dedupe_profiles.py

This script will:
- Backup `data/db.sqlite3` to `data/db.sqlite3.bak` (overwrites existing backup)
- Print duplicate names found
- Delete duplicate rows keeping the smallest `id` for each name
- VACUUM the database

Note: This script only modifies `profiles` table.
"""
from pathlib import Path
import sqlite3
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / 'data' / 'db.sqlite3'
BACKUP = ROOT / 'data' / 'db.sqlite3.bak'

if not DB.exists():
    print(f"Database not found at {DB}")
    sys.exit(1)

print(f"Backing up database: {DB} -> {BACKUP}")
shutil.copy2(DB, BACKUP)

conn = sqlite3.connect(str(DB))
cur = conn.cursor()

# List duplicate names
cur.execute("SELECT name, COUNT(*) as c FROM profiles GROUP BY name HAVING c>1;")
dups = cur.fetchall()
if not dups:
    print("No duplicate profile names found.")
else:
    print("Duplicate profile names (name, count):")
    for name, count in dups:
        print(f" - {name!r}: {count}")

# Delete duplicates keeping the smallest id per name
print("Removing duplicates (keeping lowest id per name)...")
cur.execute("BEGIN TRANSACTION;")
cur.execute("DELETE FROM profiles WHERE id NOT IN (SELECT MIN(id) FROM profiles GROUP BY name);")
conn.commit()
print("Duplicates removed.")

print("Running VACUUM to optimize database...")
cur.execute("VACUUM;")
conn.close()
print("Done.")
