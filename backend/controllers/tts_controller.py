from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pathlib import Path
import uuid

from backend.database import get_db
from backend import models, schemas
from backend.ml.tts_engine import tts_engine
from backend.settings import settings

router = APIRouter()

@router.post("/generate", response_model=schemas.APIResponse)
async def generate_speech(
    tts_data: schemas.ChatResponse,
    db: Session = Depends(get_db)
):
    """
    Generate speech from text
    """
    try:
        # Create unique filename
        filename = f"tts_{uuid.uuid4().hex}.wav"
        output_path = settings.GENERATED_DIR / "tts" / filename
        
        # Generate speech
        result = tts_engine.generate_speech(tts_data.ai_response, output_path)
        
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["error"])
        
        # Save to database
        audio_entry = models.GeneratedAudio(
            chat_id=tts_data.id,
            profile_id=tts_data.profile_id,
            text_content=tts_data.ai_response,
            audio_path=result["audio_path"],
            tts_engine=result["engine"],
            duration=0.0  # Would need to calculate this
        )
        
        db.add(audio_entry)
        db.commit()
        db.refresh(audio_entry)
        
        return {
            "success": True,
            "message": "Speech generated successfully",
            "data": {
                "audio_id": audio_entry.id,
                "audio_path": result["audio_path"],
                "file_size": result["file_size"]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Speech generation failed: {str(e)}")

@router.get("/audio/{audio_id}")
async def get_audio_file(audio_id: int, db: Session = Depends(get_db)):
    """
    Get generated audio file
    """
    try:
        audio = db.query(models.GeneratedAudio).filter(models.GeneratedAudio.id == audio_id).first()
        if not audio:
            raise HTTPException(status_code=404, detail="Audio file not found")
        
        audio_path = Path(audio.audio_path)
        if not audio_path.exists():
            raise HTTPException(status_code=404, detail="Audio file not found on disk")
        
        return FileResponse(
            path=audio_path,
            media_type="audio/wav",
            filename=f"speech_{audio_id}.wav"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get audio file: {str(e)}")

@router.get("/voices")
async def get_available_voices():
    """
    Get available TTS voices
    """
    try:
        voices = tts_engine.get_available_voices()
        
        return {
            "success": True,
            "data": voices
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get voices: {str(e)}")

@router.get("/engine-info")
async def get_engine_info():
    """
    Get TTS engine information
    """
    try:
        info = tts_engine.get_engine_info()
        
        return {
            "success": True,
            "data": info
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get engine info: {str(e)}")

@router.post("/preview")
async def preview_voice(text: str = "Hello, this is a voice preview."):
    """
    Preview TTS voice (plays audio directly)
    """
    try:
        tts_engine.preview_voice(text)
        
        return {
            "success": True,
            "message": "Voice preview played"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice preview failed: {str(e)}")

@router.delete("/audio/{audio_id}")
async def delete_audio_file(audio_id: int, db: Session = Depends(get_db)):
    """
    Delete generated audio file
    """
    try:
        audio = db.query(models.GeneratedAudio).filter(models.GeneratedAudio.id == audio_id).first()
        if not audio:
            raise HTTPException(status_code=404, detail="Audio file not found")
        
        # Delete physical file
        audio_path = Path(audio.audio_path)
        if audio_path.exists():
            audio_path.unlink()
        
        # Delete database record
        db.delete(audio)
        db.commit()
        
        return {
            "success": True,
            "message": "Audio file deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete audio file: {str(e)}")