# backend/server.py
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import JSONResponse, FileResponse
import os
from pathlib import Path

from backend.settings import settings, BASE_DIR
from backend.database import init_db, get_db, engine
from backend import models

# Import controllers
from backend.controllers import (
    profile_controller,
    upload_controller,
    transcribe_controller,
    chat_controller,
    tts_controller,
    visualize_controller
)

# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Eternal Voice - AI System for Reconstructing Emotional Voice Memories"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, set actual domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static and Templates directories
static_dir = BASE_DIR / "web" / "static"
templates_dir = BASE_DIR / "web" / "templates"

# mount /static for assets
app.mount("/static", StaticFiles(directory=static_dir), name="static")
app.mount("/templates", StaticFiles(directory=templates_dir), name="templates")
# DO NOT mount templates as static — templates are rendered by Jinja2Templates
templates = Jinja2Templates(directory=templates_dir)

# Include routers (API endpoints)
app.include_router(profile_controller.router, prefix="/api/profiles", tags=["Profiles"])
app.include_router(upload_controller.router, prefix="/api/upload", tags=["File Upload"])
app.include_router(transcribe_controller.router, prefix="/api/transcribe", tags=["Transcription"])
app.include_router(chat_controller.router, prefix="/api/chat", tags=["Chat"])
app.include_router(tts_controller.router, prefix="/api/tts", tags=["Text-to-Speech"])
app.include_router(visualize_controller.router, prefix="/api/visualize", tags=["Visualization"])


# Root page: render base.html
@app.get("/")
async def root(request: Request):
    return templates.TemplateResponse("base.html", {"request": request})


# Health check

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": "development" if settings.DEBUG else "production"
    }



# Favicon
@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    file_path = BASE_DIR / "web" / "static" / "assets" / "images" / "logo.png"
    if file_path.exists():
        return FileResponse(file_path)
    return JSONResponse(status_code=404, content={"message": "No icon found"})


# Startup: ensure DB init and useful logs
@app.on_event("startup")
async def startup_event():
    # Initialize DB tables
    init_db()

    # Helpful runtime information
    print(f"🚀 {settings.APP_NAME} v{settings.APP_VERSION} starting up...")
    print(f"📁 Project BASE_DIR: {BASE_DIR}")
    # If engine.url is present, print it
    try:
        print("Using DB URL:", engine.url)
    except Exception:
        pass
    print(f"🌐 Server running on: http://{settings.HOST}:{settings.PORT}")


# Global error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": exc.detail}
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "Internal server error"}
    )


# Serve SPA-like frontend routes (map several routes to base.html)
@app.get("/{path:path}")
async def serve_frontend(request: Request, path: str):
    frontend_routes = ["", "dashboard", "profiles", "upload", "transcription", "chat", "visualization"]

    if path in frontend_routes or path.split('/')[0] in frontend_routes:
        return templates.TemplateResponse("base.html", {"request": request})

    raise HTTPException(status_code=404, detail="Page not found")


# If run directly
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.server:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
