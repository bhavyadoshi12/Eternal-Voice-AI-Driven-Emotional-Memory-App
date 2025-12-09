import os
import tempfile
from pathlib import Path
from typing import Dict, Any, Optional
import openai
from openai import OpenAI
import whisper
from whisper.utils import get_writer
import time
import logging
from backend.settings import settings

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WhisperTranscriber:
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None
        self.local_model = None
        self.model_loaded = False
        
    def load_local_model(self):
        """Load local Whisper model as fallback"""
        try:
            if not self.model_loaded:
                logger.info(f"Loading local Whisper model: {settings.WHISPER_MODEL}")
                self.local_model = whisper.load_model(settings.WHISPER_MODEL)
                self.model_loaded = True
                logger.info("Local Whisper model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load local Whisper model: {e}")
            raise

    async def transcribe_audio(
        self, 
        audio_path: Path, 
        use_api: bool = True,
        language: str = "en"
    ) -> Dict[str, Any]:
        """
        Transcribe audio using Whisper (API preferred, local fallback)
        """
        try:
            # Try API first if available and requested
            if use_api and self.client:
                return await self._transcribe_with_api(audio_path, language)
            else:
                return await self._transcribe_locally(audio_path, language)
                
        except Exception as e:
            logger.error(f"Transcription failed for {audio_path}: {e}")
            raise

    async def _transcribe_with_api(self, audio_path: Path, language: str) -> Dict[str, Any]:
        """Transcribe using OpenAI Whisper API"""
        try:
            start_time = time.time()
            
            with open(audio_path, "rb") as audio_file:
                response = self.client.audio.transcriptions.create(
                    file=audio_file,
                    model="whisper-1",
                    language=language,
                    response_format="verbose_json"
                )
            
            processing_time = time.time() - start_time
            
            return {
                "text": response.text,
                "language": response.language,
                "duration": response.duration,
                "confidence": getattr(response, 'confidence', 0.9),
                "processing_time": processing_time,
                "method": "whisper_api",
                "segments": getattr(response, 'segments', [])
            }
            
        except Exception as e:
            logger.warning(f"API transcription failed, falling back to local: {e}")
            return await self._transcribe_locally(audio_path, language)

    async def _transcribe_locally(self, audio_path: Path, language: str) -> Dict[str, Any]:
        """Transcribe using local Whisper model"""
        try:
            if not self.model_loaded:
                self.load_local_model()

            start_time = time.time()
            
            # Transcribe with local model
            result = self.local_model.transcribe(
                str(audio_path),
                language=language,
                verbose=False
            )
            
            processing_time = time.time() - start_time
            
            return {
                "text": result["text"],
                "language": result.get("language", "en"),
                "duration": self._get_audio_duration(audio_path),
                "confidence": self._calculate_confidence(result.get("segments", [])),
                "processing_time": processing_time,
                "method": "whisper_local",
                "segments": result.get("segments", [])
            }
            
        except Exception as e:
            logger.error(f"Local transcription failed: {e}")
            raise

    def _calculate_confidence(self, segments: list) -> float:
        """Calculate overall confidence from segments"""
        if not segments:
            return 0.9
            
        confidences = [seg.get("confidence", 0.9) for seg in segments if seg.get("confidence")]
        return sum(confidences) / len(confidences) if confidences else 0.9

    def _get_audio_duration(self, audio_path: Path) -> float:
        """Get audio duration in seconds"""
        try:
            import librosa
            duration = librosa.get_duration(filename=str(audio_path))
            return duration
        except:
            return 0.0

    def save_transcription(self, text: str, output_path: Path):
        """Save transcription to file"""
        try:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(text)
        except Exception as e:
            logger.error(f"Failed to save transcription: {e}")

    def cleanup_temp_files(self):
        """Clean up temporary files"""
        pass  # Implement if needed

# Global transcriber instance
transcriber = WhisperTranscriber()