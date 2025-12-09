#!/usr/bin/env python3
"""
Data Backup Script for Eternal Voice
Run this script to backup all application data
"""

import os
import sys
import shutil
import json
import sqlite3
from pathlib import Path
from datetime import datetime
import zipfile

def create_backup():
    """Create a comprehensive backup of all application data"""
    
    # Create backup directory with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = Path(f"backups/eternal_voice_backup_{timestamp}")
    backup_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"📦 Creating backup in: {backup_dir}")
    
    try:
        # Backup database
        backup_database(backup_dir)
        
        # Backup uploaded files
        backup_uploaded_files(backup_dir)
        
        # Backup generated files
        backup_generated_files(backup_dir)
        
        # Backup configuration
        backup_configuration(backup_dir)
        
        # Create backup manifest
        create_manifest(backup_dir)
        
        # Create zip archive
        create_zip_archive(backup_dir)
        
        print(f"✅ Backup completed successfully: {backup_dir}.zip")
        
    except Exception as e:
        print(f"❌ Backup failed: {e}")
        # Clean up failed backup
        if backup_dir.exists():
            shutil.rmtree(backup_dir)

def backup_database(backup_dir):
    """Backup SQLite database"""
    print("🔍 Backing up database...")
    
    db_path = Path("data/db.sqlite3")
    if not db_path.exists():
        print("⚠️  Database file not found")
        return
    
    # Copy database file
    backup_db_path = backup_dir / "database"
    backup_db_path.mkdir(exist_ok=True)
    
    shutil.copy2(db_path, backup_db_path / "db.sqlite3")
    
    # Also create SQL dump
    create_sql_dump(db_path, backup_db_path / "database_dump.sql")
    
    print("✅ Database backed up")

def create_sql_dump(db_path, output_path):
    """Create SQL dump of database"""
    try:
        conn = sqlite3.connect(db_path)
        with open(output_path, 'w') as f:
            for line in conn.iterdump():
                f.write(f'{line}\n')
        conn.close()
    except Exception as e:
        print(f"⚠️  SQL dump failed: {e}")

def backup_uploaded_files(backup_dir):
    """Backup uploaded files"""
    print("🔍 Backing up uploaded files...")
    
    uploads_dir = Path("data/uploads")
    if not uploads_dir.exists():
        print("⚠️  Uploads directory not found")
        return
    
    backup_uploads_dir = backup_dir / "uploads"
    shutil.copytree(uploads_dir, backup_uploads_dir)
    print("✅ Uploaded files backed up")

def backup_generated_files(backup_dir):
    """Backup generated files (TTS, etc.)"""
    print("🔍 Backing up generated files...")
    
    generated_dir = Path("data/generated")
    if not generated_dir.exists():
        print("⚠️  Generated files directory not found")
        return
    
    backup_generated_dir = backup_dir / "generated"
    shutil.copytree(generated_dir, backup_generated_dir)
    print("✅ Generated files backed up")

def backup_configuration(backup_dir):
    """Backup configuration files"""
    print("🔍 Backing up configuration...")
    
    config_files = [
        ".env",
        "requirements.txt",
        "app.py"
    ]
    
    backup_config_dir = backup_dir / "configuration"
    backup_config_dir.mkdir(exist_ok=True)
    
    for config_file in config_files:
        config_path = Path(config_file)
        if config_path.exists():
            shutil.copy2(config_path, backup_config_dir / config_file)
    
    print("✅ Configuration backed up")

def create_manifest(backup_dir):
    """Create backup manifest file"""
    print("🔍 Creating backup manifest...")
    
    manifest = {
        "backup_date": datetime.now().isoformat(),
        "version": "1.0.0",
        "components": {
            "database": True,
            "uploads": Path("data/uploads").exists(),
            "generated": Path("data/generated").exists(),
            "configuration": True
        },
        "file_counts": {
            "audio_files": count_files(Path("data/uploads/audio")),
            "image_files": count_files(Path("data/uploads/images")),
            "text_files": count_files(Path("data/uploads/text")),
            "tts_files": count_files(Path("data/generated/tts"))
        },
        "total_size": calculate_total_size(backup_dir)
    }
    
    with open(backup_dir / "backup_manifest.json", 'w') as f:
        json.dump(manifest, f, indent=2)
    
    print("✅ Backup manifest created")

def count_files(directory):
    """Count files in directory"""
    if not directory.exists():
        return 0
    return len([f for f in directory.rglob('*') if f.is_file()])

def calculate_total_size(directory):
    """Calculate total size of directory in MB"""
    total_size = 0
    for file_path in directory.rglob('*'):
        if file_path.is_file():
            total_size += file_path.stat().st_size
    return round(total_size / (1024 * 1024), 2)

def create_zip_archive(backup_dir):
    """Create zip archive of backup"""
    print("🔍 Creating zip archive...")
    
    zip_path = Path(f"{backup_dir}.zip")
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for file_path in backup_dir.rglob('*'):
            if file_path.is_file():
                arcname = file_path.relative_to(backup_dir)
                zipf.write(file_path, arcname)
    
    # Remove the uncompressed backup directory
    shutil.rmtree(backup_dir)
    
    print("✅ Zip archive created")

def restore_backup(backup_path):
    """Restore from backup"""
    print(f"🔄 Restoring from backup: {backup_path}")
    
    if not Path(backup_path).exists():
        print("❌ Backup file not found")
        return False
    
    try:
        # Extract backup
        extract_dir = Path("temp_restore")
        with zipfile.ZipFile(backup_path, 'r') as zipf:
            zipf.extractall(extract_dir)
        
        # Restore components
        restore_database(extract_dir)
        restore_files(extract_dir / "uploads", Path("data/uploads"))
        restore_files(extract_dir / "generated", Path("data/generated"))
        
        # Clean up
        shutil.rmtree(extract_dir)
        
        print("✅ Backup restored successfully")
        return True
        
    except Exception as e:
        print(f"❌ Restore failed: {e}")
        return False

def restore_database(extract_dir):
    """Restore database from backup"""
    db_backup_path = extract_dir / "database" / "db.sqlite3"
    if db_backup_path.exists():
        # Backup current database
        current_db = Path("data/db.sqlite3")
        if current_db.exists():
            backup_path = Path(f"data/db.sqlite3.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}")
            shutil.copy2(current_db, backup_path)
        
        # Restore backup database
        shutil.copy2(db_backup_path, current_db)
        print("✅ Database restored")

def restore_files(source_dir, target_dir):
    """Restore files from backup"""
    if source_dir.exists():
        if target_dir.exists():
            shutil.rmtree(target_dir)
        shutil.copytree(source_dir, target_dir)
        print(f"✅ {target_dir.name} restored")

def list_backups():
    """List available backups"""
    backup_files = sorted(Path(".").glob("backups/eternal_voice_backup_*.zip"))
    
    if not backup_files:
        print("No backups found")
        return
    
    print("Available backups:")
    for backup in backup_files:
        print(f"  - {backup.name}")

def main():
    """Main function"""
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python backup_data.py create    - Create new backup")
        print("  python backup_data.py list      - List available backups")
        print("  python backup_data.py restore <backup_file> - Restore from backup")
        return
    
    command = sys.argv[1]
    
    if command == "create":
        create_backup()
    elif command == "list":
        list_backups()
    elif command == "restore" and len(sys.argv) > 2:
        restore_backup(sys.argv[2])
    else:
        print("Invalid command")

if __name__ == "__main__":
    main()