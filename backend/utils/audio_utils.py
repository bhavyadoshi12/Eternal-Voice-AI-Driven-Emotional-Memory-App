import librosa
import soundfile as sf
from pydub import AudioSegment
from pathlib import Path
import numpy as np
import tempfile
import os

def preprocess_audio_file(audio_path: Path, target_sr: int = 16000):
    """
    Preprocess audio file for better transcription
    """
    try:
        # Create processed directory
        processed_dir = Path("data/processed/audio")
        processed_dir.mkdir(parents=True, exist_ok=True)
        
        output_path = processed_dir / f"processed_{audio_path.name}"
        
        # Load audio
        audio, sr = librosa.load(audio_path, sr=target_sr)
        
        # Normalize audio
        audio = librosa.util.normalize(audio)
        
        # Remove silence (optional)
        # audio, _ = librosa.effects.trim(audio)
        
        # Save processed audio
        sf.write(output_path, audio, sr)
        
        return output_path
        
    except Exception as e:
        print(f"Audio preprocessing failed for {audio_path}: {e}")
        return audio_path  # Return original path if processing fails

def get_audio_duration(audio_path: Path) -> float:
    """
    Get duration of audio file in seconds
    """
    try:
        audio = AudioSegment.from_file(audio_path)
        return len(audio) / 1000.0  # Convert to seconds
    except Exception as e:
        print(f"Failed to get audio duration: {e}")
        return 0.0

def convert_audio_format(input_path: Path, output_format: str = "wav"):
    """
    Convert audio file to different format
    """
    try:
        audio = AudioSegment.from_file(input_path)
        
        # Create output path
        output_path = input_path.with_suffix(f'.{output_format}')
        
        # Export
        audio.export(output_path, format=output_format)
        
        return output_path
        
    except Exception as e:
        print(f"Audio conversion failed: {e}")
        return None

def split_audio_file(audio_path: Path, segment_duration: int = 300):
    """
    Split audio file into segments (in seconds)
    """
    try:
        audio = AudioSegment.from_file(audio_path)
        duration_ms = len(audio)
        segment_ms = segment_duration * 1000
        
        segments = []
        for i in range(0, duration_ms, segment_ms):
            segment = audio[i:i + segment_ms]
            
            segment_path = audio_path.parent / f"{audio_path.stem}_part{i//segment_ms + 1}.wav"
            segment.export(segment_path, format="wav")
            segments.append(segment_path)
            
        return segments
        
    except Exception as e:
        print(f"Audio splitting failed: {e}")
        return []

def get_audio_info(audio_path: Path) -> dict:
    """
    Get detailed audio file information
    """
    try:
        audio = AudioSegment.from_file(audio_path)
        
        return {
            'duration_seconds': len(audio) / 1000.0,
            'channels': audio.channels,
            'sample_width': audio.sample_width,
            'frame_rate': audio.frame_rate,
            'frame_count': audio.frame_count(),
            'max_amplitude': audio.max,
            'rms': audio.rms
        }
        
    except Exception as e:
        print(f"Failed to get audio info: {e}")
        return {}