import pytesseract
from PIL import Image, ImageEnhance, ImageFilter
import io
from pathlib import Path
from sqlalchemy.orm import Session
from backend import models

def extract_text_from_image(image_path: Path, file_id: int, profile_id: int, db: Session):
    """
    Extract text from image using OCR and save to database
    """
    try:
        # Open and preprocess image
        image = Image.open(image_path)
        
        # Preprocess image for better OCR
        image = preprocess_image_for_ocr(image)
        
        # Extract text using Tesseract
        extracted_text = pytesseract.image_to_string(image)
        
        # Clean extracted text
        cleaned_text = clean_ocr_text(extracted_text)
        
        if cleaned_text.strip():
            # Save to transcriptions table
            transcription = models.Transcription(
                file_id=file_id,
                profile_id=profile_id,
                original_text=extracted_text,
                cleaned_text=cleaned_text,
                transcription_method="tesseract_ocr",
                processing_time=0.0  # We don't track time for OCR
            )
            
            db.add(transcription)
            db.commit()
            
            # Mark file as processed
            file = db.query(models.UploadedFile).filter(models.UploadedFile.id == file_id).first()
            if file:
                file.processed = True
                db.commit()
        
        return cleaned_text
        
    except Exception as e:
        print(f"OCR processing failed for {image_path}: {e}")
        return ""

def preprocess_image_for_ocr(image: Image.Image) -> Image.Image:
    """
    Preprocess image to improve OCR accuracy
    """
    try:
        # Convert to grayscale
        if image.mode != 'L':
            image = image.convert('L')
        
        # Enhance contrast
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(2.0)
        
        # Enhance sharpness
        enhancer = ImageEnhance.Sharpness(image)
        image = enhancer.enhance(2.0)
        
        # Apply slight blur to reduce noise
        image = image.filter(ImageFilter.MedianFilter())
        
        return image
        
    except Exception as e:
        print(f"Image preprocessing failed: {e}")
        return image

def clean_ocr_text(text: str) -> str:
    """
    Clean and normalize OCR-extracted text
    """
    import re
    
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)
    
    # Remove special characters but keep basic punctuation
    text = re.sub(r'[^\w\s.,!?;:()\-]', '', text)
    
    # Fix common OCR errors
    replacements = {
        '|': 'I',
        '0': 'O',
        '1': 'I',
        '5': 'S',
        '8': 'B'
    }
    
    for wrong, correct in replacements.items():
        text = text.replace(wrong, correct)
    
    return text.strip()

def get_image_dimensions(image_path: Path) -> tuple:
    """
    Get image dimensions
    """
    try:
        with Image.open(image_path) as img:
            return img.size
    except Exception as e:
        print(f"Failed to get image dimensions: {e}")
        return (0, 0)

def is_image_readable(image_path: Path) -> bool:
    """
    Check if image is readable and not corrupted
    """
    try:
        with Image.open(image_path) as img:
            img.verify()
        return True
    except Exception:
        return False