from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
import shutil
import os
from pathlib import Path
from typing import List, Optional
import uuid
from datetime import datetime

from backend.database import get_db
from backend import models, schemas
from backend.settings import settings
from backend.utils.file_utils import validate_file_type, get_file_size, create_secure_filename
from backend.utils.progress_tracker import ProgressTracker
from backend.utils.image_utils import extract_text_from_image
from backend.utils.audio_utils import preprocess_audio_file

router = APIRouter()

# Initialize progress tracker
progress_tracker = ProgressTracker()

@router.post("/multiple", response_model=schemas.APIResponse)
async def upload_multiple_files(
    background_tasks: BackgroundTasks,
    profile_id: int = Form(...),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    """
    Handle multiple file uploads with progress tracking
    """
    try:
        # Validate profile exists
        profile = db.query(models.Profile).filter(models.Profile.id == profile_id).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        if not profile.consent_given:
            raise HTTPException(status_code=400, detail="Consent not given for this profile")

        uploaded_files = []
        failed_uploads = []

        # Create task for progress tracking
        task_id = str(uuid.uuid4())
        progress_tracker.create_task(task_id, len(files), profile_id, "file_upload")

        for index, file in enumerate(files):
            try:
                # Validate file type
                if not validate_file_type(file.filename, file.content_type):
                    failed_uploads.append({
                        "filename": file.filename,
                        "error": "Invalid file type"
                    })
                    continue

                # Create secure filename
                secure_filename = create_secure_filename(file.filename)
                file_type = "audio" if file.filename.lower().endswith(('.wav', '.mp3', '.m4a', '.flac')) else \
                           "image" if file.filename.lower().endswith(('.jpg', '.jpeg', '.png', '.gif')) else "text"

                # Create upload directory if it doesn't exist
                upload_dir = settings.UPLOAD_DIR / file_type
                upload_dir.mkdir(parents=True, exist_ok=True)
                
                file_path = upload_dir / secure_filename

                # Save file
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)

                # Get file size
                file_size = get_file_size(file_path)

                # Create database record
                db_file = models.UploadedFile(
                    profile_id=profile_id,
                    filename=secure_filename,
                    file_type=file_type,
                    file_path=str(file_path),
                    file_size=file_size
                )
                
                db.add(db_file)
                db.commit()
                db.refresh(db_file)

                uploaded_files.append({
                    "id": db_file.id,
                    "filename": secure_filename,
                    "file_type": file_type,
                    "size": file_size
                })

                # Update progress
                progress_tracker.update_progress(
                    task_id, 
                    (index + 1) / len(files) * 100,
                    f"Uploaded {secure_filename} ({index + 1}/{len(files)})"
                )

                # Preprocess audio files if needed
                if file_type == "audio":
                    background_tasks.add_task(preprocess_audio_file, file_path)

            except Exception as e:
                failed_uploads.append({
                    "filename": file.filename,
                    "error": str(e)
                })
                continue

        # Mark task as completed
        progress_tracker.complete_task(task_id)

        return {
            "success": True,
            "message": f"Successfully uploaded {len(uploaded_files)} files",
            "data": {
                "uploaded_files": uploaded_files,
                "failed_uploads": failed_uploads,
                "task_id": task_id
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.post("/single", response_model=schemas.APIResponse)
async def upload_single_file(
    background_tasks: BackgroundTasks,
    profile_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Handle single file upload
    """
    try:
        # Validate profile exists
        profile = db.query(models.Profile).filter(models.Profile.id == profile_id).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        if not profile.consent_given:
            raise HTTPException(status_code=400, detail="Consent not given for this profile")

        # Validate file type
        if not validate_file_type(file.filename, file.content_type):
            raise HTTPException(status_code=400, detail="Invalid file type")

        # Create secure filename
        secure_filename = create_secure_filename(file.filename)
        file_type = "audio" if file.filename.lower().endswith(('.wav', '.mp3', '.m4a', '.flac')) else \
                   "image" if file.filename.lower().endswith(('.jpg', '.jpeg', '.png', '.gif')) else "text"

        # Create upload directory
        upload_dir = settings.UPLOAD_DIR / file_type
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        file_path = upload_dir / secure_filename

        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Get file size
        file_size = get_file_size(file_path)

        # Create database record
        db_file = models.UploadedFile(
            profile_id=profile_id,
            filename=secure_filename,
            file_type=file_type,
            file_path=str(file_path),
            file_size=file_size
        )
        
        db.add(db_file)
        db.commit()
        db.refresh(db_file)

        # Preprocess if needed
        if file_type == "audio":
            background_tasks.add_task(preprocess_audio_file, file_path)
        elif file_type == "image":
            background_tasks.add_task(extract_text_from_image, file_path, db_file.id, profile_id, db)

        return {
            "success": True,
            "message": "File uploaded successfully",
            "data": db_file
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.get("/progress/{task_id}")
async def get_upload_progress(task_id: str):
    """
    Get progress for a specific upload task
    """
    progress = progress_tracker.get_progress(task_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {
        "success": True,
        "data": progress
    }

@router.get("/files/{profile_id}")
async def get_profile_files(profile_id: int, db: Session = Depends(get_db)):
    """
    Get all files for a specific profile
    """
    try:
        files = db.query(models.UploadedFile).filter(
            models.UploadedFile.profile_id == profile_id
        ).order_by(models.UploadedFile.upload_date.desc()).all()

        return {
            "success": True,
            "data": files
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get files: {str(e)}")

@router.delete("/file/{file_id}")
async def delete_file(file_id: int, db: Session = Depends(get_db)):
    """
    Delete a specific file
    """
    try:
        file = db.query(models.UploadedFile).filter(models.UploadedFile.id == file_id).first()
        if not file:
            raise HTTPException(status_code=404, detail="File not found")

        # Delete physical file
        file_path = Path(file.file_path)
        if file_path.exists():
            file_path.unlink()

        # Delete database record
        db.delete(file)
        db.commit()

        return {
            "success": True,
            "message": "File deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")

@router.post("/process-image/{file_id}")
async def process_image_file(
    file_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Process an image file to extract text using OCR
    """
    try:
        file = db.query(models.UploadedFile).filter(models.UploadedFile.id == file_id).first()
        if not file:
            raise HTTPException(status_code=404, detail="File not found")

        if file.file_type != "image":
            raise HTTPException(status_code=400, detail="File is not an image")

        # Process image in background
        background_tasks.add_task(extract_text_from_image, Path(file.file_path), file_id, file.profile_id, db)

        return {
            "success": True,
            "message": "Image processing started"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image processing failed: {str(e)}")