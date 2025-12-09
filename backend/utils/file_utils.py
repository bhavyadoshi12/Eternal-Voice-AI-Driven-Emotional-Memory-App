import os
import uuid
from pathlib import Path
from typing import Dict, Any
import magic

# Allowed file types
ALLOWED_EXTENSIONS = {
    'audio': ['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac'],
    'image': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'],
    'text': ['.txt', '.pdf', '.doc', '.docx', '.json', '.csv']
}

ALLOWED_MIME_TYPES = {
    'audio': ['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/flac', 'audio/ogg', 'audio/aac'],
    'image': ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff'],
    'text': ['text/plain', 'application/pdf', 'application/msword', 
             'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
             'application/json', 'text/csv']
}

def validate_file_type(filename: str, content_type: str) -> bool:
    """
    Validate file type based on extension and MIME type
    """
    if not filename or not content_type:
        return False

    # Check extension
    file_ext = Path(filename).suffix.lower()
    if not any(file_ext in extensions for extensions in ALLOWED_EXTENSIONS.values()):
        return False

    # Check MIME type
    if not any(content_type.startswith(mime) for mime in ALLOWED_MIME_TYPES.values()):
        return False

    return True

def create_secure_filename(filename: str) -> str:
    """
    Create a secure filename with UUID to prevent conflicts
    """
    file_ext = Path(filename).suffix.lower()
    unique_id = uuid.uuid4().hex
    return f"{unique_id}{file_ext}"

def get_file_size(file_path: Path) -> int:
    """
    Get file size in bytes
    """
    return file_path.stat().st_size

def get_file_info(file_path: Path) -> Dict[str, Any]:
    """
    Get comprehensive file information
    """
    stat = file_path.stat()
    
    return {
        'filename': file_path.name,
        'size_bytes': stat.st_size,
        'size_mb': round(stat.st_size / (1024 * 1024), 2),
        'created': stat.st_ctime,
        'modified': stat.st_mtime,
        'extension': file_path.suffix.lower(),
        'mime_type': get_file_mime_type(file_path)
    }

def get_file_mime_type(file_path: Path) -> str:
    """
    Get MIME type of file using python-magic
    """
    try:
        mime = magic.Magic(mime=True)
        return mime.from_file(str(file_path))
    except:
        return "application/octet-stream"

def format_file_size(size_bytes: int) -> str:
    """
    Format file size in human readable format
    """
    if size_bytes == 0:
        return "0B"
    
    size_names = ["B", "KB", "MB", "GB"]
    i = 0
    while size_bytes >= 1024 and i < len(size_names) - 1:
        size_bytes /= 1024.0
        i += 1
        
    return f"{size_bytes:.2f} {size_names[i]}"

def cleanup_old_files(directory: Path, max_age_hours: int = 24):
    """
    Clean up temporary files older than specified hours
    """
    import time
    current_time = time.time()
    
    for file_path in directory.rglob('*'):
        if file_path.is_file():
            file_age = current_time - file_path.stat().st_mtime
            if file_age > (max_age_hours * 3600):
                try:
                    file_path.unlink()
                except Exception as e:
                    print(f"Failed to delete {file_path}: {e}")

def get_storage_usage() -> Dict[str, Any]:
    """
    Get storage usage statistics
    """
    from backend.settings import settings
    
    total_size = 0
    file_count = 0
    
    for upload_dir in [settings.UPLOAD_DIR, settings.PROCESSED_DIR, settings.GENERATED_DIR]:
        if upload_dir.exists():
            for file_path in upload_dir.rglob('*'):
                if file_path.is_file():
                    total_size += file_path.stat().st_size
                    file_count += 1
    
    return {
        'total_size_bytes': total_size,
        'total_size_formatted': format_file_size(total_size),
        'file_count': file_count,
        'upload_dir_size': format_file_size(get_directory_size(settings.UPLOAD_DIR)),
        'processed_dir_size': format_file_size(get_directory_size(settings.PROCESSED_DIR)),
        'generated_dir_size': format_file_size(get_directory_size(settings.GENERATED_DIR))
    }

def get_directory_size(directory: Path) -> int:
    """
    Calculate total size of directory
    """
    if not directory.exists():
        return 0
        
    total_size = 0
    for file_path in directory.rglob('*'):
        if file_path.is_file():
            total_size += file_path.stat().st_size
            
    return total_size