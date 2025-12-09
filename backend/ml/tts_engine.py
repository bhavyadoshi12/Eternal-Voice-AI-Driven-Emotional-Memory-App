import pyttsx3
import os
from pathlib import Path
from typing import Optional, Dict, Any
import logging
import tempfile
from backend.settings import settings

logger = logging.getLogger(__name__)

class TTSEngine:
    def __init__(self):
        self.engine = None
        self.initialized = False
        
    def initialize_engine(self):
        """Initialize the TTS engine"""
        try:
            if not self.initialized:
                self.engine = pyttsx3.init()
                
                # Configure voice settings
                voices = self.engine.getProperty('voices')
                
                # Prefer female voice if available
                for voice in voices:
                    if 'female' in voice.name.lower() or 'zira' in voice.name.lower():
                        self.engine.setProperty('voice', voice.id)
                        break
                
                # Set speech rate and volume
                self.engine.setProperty('rate', 150)  # Speech rate
                self.engine.setProperty('volume', 0.8)  # Volume level
                
                self.initialized = True
                logger.info("TTS engine initialized successfully")
                
        except Exception as e:
            logger.error(f"Failed to initialize TTS engine: {e}")
            raise

    def generate_speech(
        self, 
        text: str, 
        output_path: Optional[Path] = None,
        voice_params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate speech from text using pyttsx3
        """
        try:
            if not self.initialized:
                self.initialize_engine()
            
            # Create output directory if it doesn't exist
            if output_path:
                output_path.parent.mkdir(parents=True, exist_ok=True)
            else:
                # Create temporary file
                output_dir = settings.GENERATED_DIR / "tts"
                output_dir.mkdir(parents=True, exist_ok=True)
                output_path = output_dir / f"tts_{hash(text)}_{len(text)}.wav"
            
            # Apply voice parameters if provided
            if voice_params:
                self._apply_voice_settings(voice_params)
            
            # Save to file
            self.engine.save_to_file(text, str(output_path))
            self.engine.runAndWait()
            
            # Get file size
            file_size = output_path.stat().st_size
            
            return {
                "success": True,
                "audio_path": str(output_path),
                "file_size": file_size,
                "text_length": len(text),
                "engine": "pyttsx3"
            }
            
        except Exception as e:
            logger.error(f"Speech generation failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "engine": "pyttsx3"
            }

    def _apply_voice_settings(self, voice_params: Dict[str, Any]):
        """Apply custom voice settings"""
        try:
            if 'rate' in voice_params:
                self.engine.setProperty('rate', voice_params['rate'])
            
            if 'volume' in voice_params:
                self.engine.setProperty('volume', voice_params['volume'])
            
            if 'voice' in voice_params:
                voices = self.engine.getProperty('voices')
                for voice in voices:
                    if voice_params['voice'].lower() in voice.name.lower():
                        self.engine.setProperty('voice', voice.id)
                        break
                        
        except Exception as e:
            logger.warning(f"Failed to apply voice settings: {e}")

    def get_available_voices(self) -> list:
        """Get list of available voices"""
        try:
            if not self.initialized:
                self.initialize_engine()
            
            voices = self.engine.getProperty('voices')
            return [
                {
                    'id': voice.id,
                    'name': voice.name,
                    'gender': 'female' if 'female' in voice.name.lower() else 'male',
                    'languages': getattr(voice, 'languages', ['en'])
                }
                for voice in voices
            ]
        except Exception as e:
            logger.error(f"Failed to get available voices: {e}")
            return []

    def get_engine_info(self) -> Dict[str, Any]:
        """Get TTS engine information"""
        try:
            if not self.initialized:
                self.initialize_engine()
            
            return {
                "engine": "pyttsx3",
                "initialized": self.initialized,
                "rate": self.engine.getProperty('rate'),
                "volume": self.engine.getProperty('volume'),
                "voice": self.engine.getProperty('voice'),
                "available_voices": len(self.get_available_voices())
            }
        except Exception as e:
            return {
                "engine": "pyttsx3",
                "initialized": False,
                "error": str(e)
            }

    def preview_voice(self, text: str = "Hello, this is a voice preview."):
        """Play voice preview"""
        try:
            if not self.initialized:
                self.initialize_engine()
            
            self.engine.say(text)
            self.engine.runAndWait()
            
        except Exception as e:
            logger.error(f"Voice preview failed: {e}")

    def cleanup_old_files(self, max_age_hours: int = 24):
        """Clean up old generated audio files"""
        try:
            tts_dir = settings.GENERATED_DIR / "tts"
            if not tts_dir.exists():
                return
                
            import time
            current_time = time.time()
            
            for file_path in tts_dir.glob("*.wav"):
                file_age = current_time - file_path.stat().st_mtime
                if file_age > (max_age_hours * 3600):
                    try:
                        file_path.unlink()
                        logger.info(f"Cleaned up old TTS file: {file_path.name}")
                    except Exception as e:
                        logger.warning(f"Failed to delete {file_path}: {e}")
                        
        except Exception as e:
            logger.error(f"Cleanup failed: {e}")

# Global TTS engine instance
tts_engine = TTSEngine()