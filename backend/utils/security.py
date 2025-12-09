import hashlib
import secrets
from datetime import datetime
from typing import Optional

def generate_consent_token() -> str:
    """Generate a unique consent token"""
    return secrets.token_urlsafe(32)

def hash_sensitive_data(data: str) -> str:
    """Hash sensitive data for storage"""
    return hashlib.sha256(data.encode()).hexdigest()

def validate_consent(profile_data: dict) -> bool:
    """Validate that proper consent has been given"""
    if not profile_data.get('consent_given'):
        return False
    
    consent_timestamp = profile_data.get('consent_timestamp')
    if not consent_timestamp:
        return False
    
    # Check if consent is not too old (optional)
    # consent_age = datetime.now() - consent_timestamp
    # if consent_age.days > 365:  # 1 year expiry
    #     return False
    
    return True

def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal"""
    import re
    # Remove path components and special characters
    safe_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', filename)
    return safe_name[:255]  # Limit length