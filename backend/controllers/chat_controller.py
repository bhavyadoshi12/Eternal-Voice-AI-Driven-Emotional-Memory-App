from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.database import get_db
from backend import models, schemas
from backend.ml.chat_generator import chat_generator
from backend.ml.persona_builder import persona_builder

router = APIRouter()

@router.post("/message", response_model=schemas.APIResponse)
async def send_chat_message(
    chat_data: schemas.ChatMessage,
    db: Session = Depends(get_db)
):
    """
    Send a message and get AI response
    """
    try:
        # Verify profile exists and has consent
        profile = db.query(models.Profile).filter(models.Profile.id == chat_data.profile_id).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        if not profile.consent_given:
            raise HTTPException(status_code=400, detail="Consent not given for this profile")
        
        # Generate AI response
        result = await chat_generator.generate_response(
            profile_id=chat_data.profile_id,
            user_message=chat_data.user_message,
            db=db
        )
        
        return {
            "success": True,
            "message": "Response generated successfully",
            "data": {
                "response": result["response"],
                "processing_time": result["processing_time"],
                "emotion_detected": result["emotion_detected"]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")

@router.post("/build-persona/{profile_id}", response_model=schemas.APIResponse)
async def build_persona_profile(
    profile_id: int,
    db: Session = Depends(get_db)
):
    """
    Build or rebuild persona profile from available data
    """
    try:
        # Verify profile exists
        profile = db.query(models.Profile).filter(models.Profile.id == profile_id).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        # Build persona
        persona_data = await persona_builder.build_persona_from_transcripts(profile_id, db)
        
        # Save to database
        await persona_builder.update_persona_data(profile_id, persona_data, db)
        
        return {
            "success": True,
            "message": "Persona profile built successfully",
            "data": persona_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Persona building failed: {str(e)}")

@router.get("/history/{profile_id}", response_model=schemas.APIResponse)
async def get_chat_history(
    profile_id: int,
    limit: Optional[int] = 50,
    db: Session = Depends(get_db)
):
    """
    Get chat history for a profile
    """
    try:
        chats = db.query(models.ChatHistory).filter(
            models.ChatHistory.profile_id == profile_id
        ).order_by(models.ChatHistory.created_at.desc()).limit(limit).all()
        
        # Reverse to get chronological order
        chats.reverse()
        
        return {
            "success": True,
            "data": chats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get chat history: {str(e)}")

@router.get("/summary/{profile_id}", response_model=schemas.APIResponse)
async def get_conversation_summary(
    profile_id: int,
    db: Session = Depends(get_db)
):
    """
    Get conversation summary and statistics
    """
    try:
        summary = await chat_generator.get_conversation_summary(profile_id, db)
        
        return {
            "success": True,
            "data": summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get conversation summary: {str(e)}")

@router.delete("/history/{profile_id}", response_model=schemas.APIResponse)
async def clear_chat_history(
    profile_id: int,
    db: Session = Depends(get_db)
):
    """
    Clear chat history for a profile
    """
    try:
        # Delete all chat history for profile
        deleted_count = db.query(models.ChatHistory).filter(
            models.ChatHistory.profile_id == profile_id
        ).delete()
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Cleared {deleted_count} chat messages",
            "data": {"deleted_count": deleted_count}
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to clear chat history: {str(e)}")

@router.get("/persona/{profile_id}", response_model=schemas.APIResponse)
async def get_persona_data(
    profile_id: int,
    db: Session = Depends(get_db)
):
    """
    Get persona data for a profile
    """
    try:
        persona_data = db.query(models.PersonaData).filter(
            models.PersonaData.profile_id == profile_id
        ).first()
        
        if not persona_data:
            raise HTTPException(status_code=404, detail="Persona data not found")
        
        return {
            "success": True,
            "data": persona_data
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get persona data: {str(e)}")