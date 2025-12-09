from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Float, JSON
from sqlalchemy.sql import func
from backend.database import Base

class Profile(Base):
    __tablename__ = "profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    relationship = Column(String(100))
    description = Column(Text)
    consent_given = Column(Boolean, default=False)
    consent_timestamp = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class UploadedFile(Base):
    __tablename__ = "uploaded_files"
    
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, nullable=False)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)  # audio, text, image
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer)  # in bytes
    upload_date = Column(DateTime(timezone=True), server_default=func.now())
    processed = Column(Boolean, default=False)

class Transcription(Base):
    __tablename__ = "transcriptions"
    
    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, nullable=False)
    profile_id = Column(Integer, nullable=False)
    original_text = Column(Text)
    cleaned_text = Column(Text)
    confidence = Column(Float)
    transcription_method = Column(String(50))  # whisper_api, whisper_local
    processing_time = Column(Float)  # in seconds
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class PersonaData(Base):
    __tablename__ = "persona_data"
    
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, nullable=False, unique=True)
    writing_style = Column(JSON)  # Store style characteristics as JSON
    vocabulary_patterns = Column(JSON)
    emotional_tone = Column(JSON)
    common_phrases = Column(JSON)
    persona_prompt = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class ChatHistory(Base):
    __tablename__ = "chat_history"
    
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, nullable=False)
    user_message = Column(Text, nullable=False)
    ai_response = Column(Text, nullable=False)
    emotion_detected = Column(String(50))
    response_time = Column(Float)  # in seconds
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class GeneratedAudio(Base):
    __tablename__ = "generated_audio"
    
    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer)
    profile_id = Column(Integer, nullable=False)
    text_content = Column(Text, nullable=False)
    audio_path = Column(String(500))
    tts_engine = Column(String(50))
    duration = Column(Float)  # in seconds
    created_at = Column(DateTime(timezone=True), server_default=func.now())