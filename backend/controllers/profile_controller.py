# backend/api/profilecontroller.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from backend.database import get_db
from backend import models

router = APIRouter(tags=["profiles"])


def profile_to_dict(db: Session, p: models.Profile) -> Dict[str, Any]:
    """
    Convert a SQLAlchemy Profile instance into a JSON-serializable dict.
    Also compute some lightweight related counts (files, conversations) safely.
    """
    try:
        file_count = db.query(models.UploadedFile).filter(models.UploadedFile.profile_id == p.id).count()
    except Exception:
        file_count = 0

    try:
        conv_count = db.query(models.ChatHistory).filter(models.ChatHistory.profile_id == p.id).count()
    except Exception:
        conv_count = 0

    return {
        "id": p.id,
        "name": p.name,
        "relationship": p.relationship,
        "description": p.description,
        "consent_given": bool(p.consent_given),
        "created_at": p.created_at.isoformat() if getattr(p, "created_at", None) else None,
        "file_count": file_count,
        "conversation_count": conv_count
    }


@router.get("/", status_code=200)
def list_profiles(db: Session = Depends(get_db)):
    """
    Return list of profiles as JSON-serializable dicts.
    """
    try:
        profiles = db.query(models.Profile).order_by(models.Profile.created_at.desc()).all()
        data = [profile_to_dict(db, p) for p in profiles]
        return {"success": True, "data": data}
    except Exception as e:
        # log server-side if you have logger (omitted to keep example simple)
        raise HTTPException(status_code=500, detail="Failed to fetch profiles")


@router.post("/", status_code=201)
def create_profile(payload: dict, db: Session = Depends(get_db)):
    """
    Create a new profile.
    Expects JSON payload with keys: name (required), relationship, description, consent_given (bool)
    Returns created profile dict.
    """
    try:
        name = payload.get("name", "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="Profile name is required")
        consent = bool(payload.get("consent_given", False))
        if not consent:
            raise HTTPException(status_code=400, detail="Consent is required to create profile")

        # Prevent duplicate profile names
        existing = db.query(models.Profile).filter(models.Profile.name == name).first()
        if existing:
            raise HTTPException(status_code=400, detail="A profile with this name already exists")

        relationship = payload.get("relationship")
        description = payload.get("description")

        new_profile = models.Profile(
            name=name,
            relationship=relationship,
            description=description,
            consent_given=consent
        )

        db.add(new_profile)
        db.commit()
        db.refresh(new_profile)

        return {"success": True, "data": profile_to_dict(db, new_profile)}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create profile")


@router.get("/{profile_id}", status_code=200)
def get_profile(profile_id: int, db: Session = Depends(get_db)):
    """
    Get a single profile by ID (serialized).
    """
    try:
        p = db.query(models.Profile).filter(models.Profile.id == profile_id).first()
        if not p:
            raise HTTPException(status_code=404, detail="Profile not found")
        return {"success": True, "data": profile_to_dict(db, p)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch profile")


@router.put("/{profile_id}", status_code=200)
def update_profile(profile_id: int, payload: dict, db: Session = Depends(get_db)):
    """
    Update profile fields. Accepts name, relationship, description (consent shouldn't be toggled here).
    """
    try:
        p = db.query(models.Profile).filter(models.Profile.id == profile_id).first()
        if not p:
            raise HTTPException(status_code=404, detail="Profile not found")

        name = payload.get("name")
        if name is not None:
            name = name.strip()
            if name == "":
                raise HTTPException(status_code=400, detail="Profile name cannot be empty")
            p.name = name

        if "relationship" in payload:
            p.relationship = payload.get("relationship")

        if "description" in payload:
            p.description = payload.get("description")

        # Do not allow toggling consent here unless you explicitly want that behavior.
        db.add(p)
        db.commit()
        db.refresh(p)

        return {"success": True, "data": profile_to_dict(db, p)}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update profile")


@router.delete("/{profile_id}", status_code=200)
def delete_profile(profile_id: int, db: Session = Depends(get_db)):
    """
    Delete a profile and optionally cascade or clean up related records.
    Here we simply delete the profile. If your DB has FK cascades, uploaded files / chat history
    may be removed automatically — otherwise you may need to delete them explicitly.
    """
    try:
        p = db.query(models.Profile).filter(models.Profile.id == profile_id).first()
        if not p:
            raise HTTPException(status_code=404, detail="Profile not found")

        # Optional: remove_uploaded_files_and_records(db, p.id)  <-- implement if needed

        db.delete(p)
        db.commit()
        return {"success": True, "message": "Profile deleted"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete profile")


@router.get("/stats/dashboard", status_code=200)
def get_dashboard_stats(db: Session = Depends(get_db)):
    """
    Return dashboard statistics: profiles count, files count, conversations count, memory hours.
    """
    try:
        profiles_count = db.query(models.Profile).count()
        files_count = db.query(models.UploadedFile).count()
        conversations_count = db.query(models.ChatHistory).count()

        # Memory hours: sum of durations from GeneratedAudio (assuming that's what it represents)
        from sqlalchemy import func
        total_duration = db.query(func.sum(models.GeneratedAudio.duration)).scalar()
        memory_hours = round((total_duration or 0) / 3600, 1)  # convert seconds to hours

        return {
            "success": True,
            "data": {
                "profiles_count": profiles_count,
                "files_count": files_count,
                "conversations_count": conversations_count,
                "memory_hours": memory_hours
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch dashboard stats")
