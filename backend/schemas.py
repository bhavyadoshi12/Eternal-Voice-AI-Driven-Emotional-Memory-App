from pydantic import BaseModel, validator
from typing import Optional, List, Dict, Any
from datetime import datetime

# Profile Schemas
class ProfileBase(BaseModel):
    name: str
    relationship: Optional[str] = None
    description: Optional[str] = None

class ProfileCreate(ProfileBase):
    consent_given: bool

class Profile(ProfileBase):
    id: int
    consent_given: bool
    consent_timestamp: datetime
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# File Upload Schemas
class FileUploadBase(BaseModel):
    profile_id: int
    file_type: str

class FileUpload(FileUploadBase):
    id: int
    filename: str
    file_path: str
    file_size: int
    upload_date: datetime
    processed: bool
    
    class Config:
        from_attributes = True

# Transcription Schemas
class TranscriptionBase(BaseModel):
    file_id: int
    profile_id: int

class TranscriptionCreate(TranscriptionBase):
    original_text: str
    cleaned_text: str
    confidence: Optional[float] = None

class Transcription(TranscriptionBase):
    id: int
    original_text: str
    cleaned_text: str
    confidence: Optional[float] = None
    transcription_method: str
    processing_time: float
    created_at: datetime
    
    class Config:
        from_attributes = True

# Chat Schemas
class ChatMessage(BaseModel):
    profile_id: int
    user_message: str

class ChatResponse(BaseModel):
    id: int
    user_message: str
    ai_response: str
    emotion_detected: Optional[str] = None
    response_time: float
    created_at: datetime
    
    class Config:
        from_attributes = True

# Persona Schemas
class PersonaDataBase(BaseModel):
    profile_id: int
    writing_style: Optional[Dict[str, Any]] = None
    vocabulary_patterns: Optional[Dict[str, Any]] = None
    emotional_tone: Optional[Dict[str, Any]] = None

class PersonaData(PersonaDataBase):
    id: int
    persona_prompt: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Progress Tracking
class ProgressUpdate(BaseModel):
    task_id: str
    profile_id: int
    current_step: str
    progress: float  # 0-100
    message: str
    estimated_time: Optional[float] = None

# API Response Schemas
class APIResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None
    error: Optional[str] = None

class BulkUploadResponse(BaseModel):
    total_files: int
    successful_uploads: int
    failed_uploads: List[Dict[str, str]]