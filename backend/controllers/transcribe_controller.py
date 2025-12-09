from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from pathlib import Path

from backend.database import get_db
from backend import models, schemas
from backend.ml.whisper_handler import transcriber
from backend.utils.progress_tracker import progress_tracker

router = APIRouter()

@router.post("/{file_id}", response_model=schemas.APIResponse)
async def transcribe_audio_file(
    file_id: int,
    background_tasks: BackgroundTasks,
    use_api: bool = True,
    language: str = "en",
    db: Session = Depends(get_db)
):
    """
    Transcribe an audio file using Whisper
    """
    try:
        # Get file from database
        file = db.query(models.UploadedFile).filter(models.UploadedFile.id == file_id).first()
        if not file:
            raise HTTPException(status_code=404, detail="File not found")
        
        if file.file_type != "audio":
            raise HTTPException(status_code=400, detail="File is not an audio file")
        
        # Create progress tracking task
        task_id = str(uuid.uuid4())
        progress_tracker.create_task(task_id, 1, file.profile_id, "transcription")
        
        # Start transcription in background
        background_tasks.add_task(
            process_transcription, 
            file_id, file.profile_id, Path(file.file_path), use_api, language, task_id, db
        )
        
        return {
            "success": True,
            "message": "Transcription started",
            "data": {"task_id": task_id}
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

async def process_transcription(
    file_id: int,
    profile_id: int,
    file_path: Path,
    use_api: bool,
    language: str,
    task_id: str,
    db: Session
):
    """Background task to process transcription"""
    try:
        progress_tracker.update_progress(task_id, 10, "Starting transcription...")
        
        # Perform transcription
        result = await transcriber.transcribe_audio(file_path, use_api, language)
        
        progress_tracker.update_progress(task_id, 80, "Saving transcription...")
        
        # Save to database
        transcription = models.Transcription(
            file_id=file_id,
            profile_id=profile_id,
            original_text=result["text"],
            cleaned_text=result["text"],  # In a real app, you might clean this
            confidence=result["confidence"],
            transcription_method=result["method"],
            processing_time=result["processing_time"]
        )
        
        db.add(transcription)
        
        # Mark file as processed
        file = db.query(models.UploadedFile).filter(models.UploadedFile.id == file_id).first()
        if file:
            file.processed = True
        
        db.commit()
        
        progress_tracker.complete_task(task_id, "Transcription completed successfully")
        
    except Exception as e:
        progress_tracker.fail_task(task_id, str(e))
        db.rollback()

@router.post("/batch/{profile_id}", response_model=schemas.APIResponse)
async def transcribe_all_audio_files(
    profile_id: int,
    background_tasks: BackgroundTasks,
    use_api: bool = True,
    language: str = "en",
    db: Session = Depends(get_db)
):
    """
    Transcribe all audio files for a profile
    """
    try:
        # Get all unprocessed audio files for profile
        audio_files = db.query(models.UploadedFile).filter(
            models.UploadedFile.profile_id == profile_id,
            models.UploadedFile.file_type == "audio",
            models.UploadedFile.processed == False
        ).all()
        
        if not audio_files:
            raise HTTPException(status_code=404, detail="No unprocessed audio files found")
        
        # Create progress tracking task
        task_id = str(uuid.uuid4())
        progress_tracker.create_task(task_id, len(audio_files), profile_id, "batch_transcription")
        
        # Start batch processing
        for index, file in enumerate(audio_files):
            background_tasks.add_task(
                process_transcription, 
                file.id, profile_id, Path(file.file_path), use_api, language, task_id, db
            )
        
        return {
            "success": True,
            "message": f"Started transcription for {len(audio_files)} files",
            "data": {"task_id": task_id, "file_count": len(audio_files)}
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch transcription failed: {str(e)}")

@router.get("/progress/{task_id}")
async def get_transcription_progress(task_id: str):
    """Get transcription progress"""
    progress = progress_tracker.get_progress(task_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {
        "success": True,
        "data": progress
    }

@router.get("/results/{profile_id}")
async def get_transcription_results(profile_id: int, db: Session = Depends(get_db)):
    """Get all transcription results for a profile"""
    try:
        transcripts = db.query(models.Transcription).filter(
            models.Transcription.profile_id == profile_id
        ).all()
        
        return {
            "success": True,
            "data": transcripts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get transcripts: {str(e)}")