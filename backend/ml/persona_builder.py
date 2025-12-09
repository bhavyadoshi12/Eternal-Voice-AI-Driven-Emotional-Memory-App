import json
import re
from typing import Dict, List, Any, Optional
from collections import Counter
import openai
from openai import OpenAI
import logging
from sqlalchemy.orm import Session
from backend.settings import settings
from backend import models

logger = logging.getLogger(__name__)

class PersonaBuilder:
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None
        
    async def build_persona_from_transcripts(
        self, 
        profile_id: int, 
        db: Session
    ) -> Dict[str, Any]:
        """
        Build persona profile from transcripts and chat history
        """
        try:
            # Get all transcripts for this profile
            transcripts = db.query(models.Transcription).filter(
                models.Transcription.profile_id == profile_id
            ).all()
            
            # Get chat history if any
            chat_history = db.query(models.ChatHistory).filter(
                models.ChatHistory.profile_id == profile_id
            ).all()
            
            if not transcripts and not chat_history:
                raise ValueError("No data available to build persona")
            
            # Extract text content
            text_samples = []
            for transcript in transcripts:
                if transcript.cleaned_text:
                    text_samples.append(transcript.cleaned_text)
            
            for chat in chat_history:
                text_samples.extend([chat.user_message, chat.ai_response])
            
            if not text_samples:
                raise ValueError("No text content available for analysis")
            
            # Analyze writing style and patterns
            analysis = self._analyze_text_patterns(text_samples)
            
            # Generate persona prompt
            persona_prompt = self._generate_persona_prompt(analysis)
            
            # Create persona data
            persona_data = {
                "writing_style": analysis,
                "vocabulary_patterns": self._extract_vocabulary_patterns(text_samples),
                "emotional_tone": self._analyze_emotional_tone(text_samples),
                "common_phrases": self._extract_common_phrases(text_samples),
                "persona_prompt": persona_prompt
            }
            
            return persona_data
            
        except Exception as e:
            logger.error(f"Persona building failed: {e}")
            raise

    def _analyze_text_patterns(self, text_samples: List[str]) -> Dict[str, Any]:
        """Analyze text patterns and writing style"""
        if not text_samples:
            return {}
            
        combined_text = " ".join(text_samples)
        
        # Basic text analysis
        sentences = re.split(r'[.!?]+', combined_text)
        words = re.findall(r'\b\w+\b', combined_text.lower())
        
        avg_sentence_length = sum(len(sentence.split()) for sentence in sentences if sentence.strip()) / len(sentences) if sentences else 0
        avg_word_length = sum(len(word) for word in words) / len(words) if words else 0
        
        # Analyze punctuation usage
        punctuation_counts = {
            'commas': combined_text.count(','),
            'exclamations': combined_text.count('!'),
            'questions': combined_text.count('?'),
            'ellipses': combined_text.count('...')
        }
        
        # Analyze formality
        formal_words = ['therefore', 'however', 'moreover', 'furthermore', 'consequently']
        informal_words = ['like', 'you know', 'sort of', 'kind of', 'maybe']
        
        formality_score = sum(combined_text.lower().count(word) for word in formal_words) / len(text_samples)
        informality_score = sum(combined_text.lower().count(word) for word in informal_words) / len(text_samples)
        
        return {
            "avg_sentence_length": round(avg_sentence_length, 2),
            "avg_word_length": round(avg_word_length, 2),
            "vocabulary_size": len(set(words)),
            "punctuation_style": punctuation_counts,
            "formality_indicator": {
                "formal_score": formality_score,
                "informal_score": informality_score,
                "overall_tone": "formal" if formality_score > informality_score else "casual"
            },
            "complexity": "complex" if avg_sentence_length > 15 else "simple"
        }

    def _extract_vocabulary_patterns(self, text_samples: List[str]) -> Dict[str, Any]:
        """Extract vocabulary patterns and frequently used words"""
        if not text_samples:
            return {}
            
        combined_text = " ".join(text_samples).lower()
        words = re.findall(r'\b[a-z]{3,}\b', combined_text)
        
        # Remove common stop words
        stop_words = {'the', 'and', 'but', 'for', 'with', 'that', 'this', 'have', 'was', 'were', 'are', 'is'}
        meaningful_words = [word for word in words if word not in stop_words]
        
        word_freq = Counter(meaningful_words).most_common(20)
        
        return {
            "frequent_words": dict(word_freq),
            "unique_words_count": len(set(meaningful_words)),
            "word_diversity": len(set(meaningful_words)) / len(meaningful_words) if meaningful_words else 0
        }

    def _analyze_emotional_tone(self, text_samples: List[str]) -> Dict[str, Any]:
        """Analyze emotional tone from text samples"""
        if not text_samples:
            return {"primary_emotion": "neutral", "confidence": 0.0}
            
        combined_text = " ".join(text_samples)
        
        # Simple emotion detection based on keywords
        emotion_keywords = {
            'joy': ['happy', 'excited', 'wonderful', 'amazing', 'love', 'great'],
            'sadness': ['sad', 'unhappy', 'sorry', 'regret', 'miss', 'lost'],
            'anger': ['angry', 'mad', 'frustrated', 'annoyed', 'hate'],
            'fear': ['scared', 'afraid', 'worried', 'nervous', 'anxious'],
            'surprise': ['surprised', 'shocked', 'amazed', 'unexpected'],
            'neutral': ['okay', 'fine', 'good', 'well', 'alright']
        }
        
        emotion_scores = {}
        for emotion, keywords in emotion_keywords.items():
            score = sum(combined_text.lower().count(keyword) for keyword in keywords)
            emotion_scores[emotion] = score
            
        primary_emotion = max(emotion_scores.items(), key=lambda x: x[1])
        total_score = sum(emotion_scores.values())
        confidence = primary_emotion[1] / total_score if total_score > 0 else 0.0
        
        return {
            "primary_emotion": primary_emotion[0],
            "confidence": round(confidence, 2),
            "all_scores": emotion_scores
        }

    def _extract_common_phrases(self, text_samples: List[str]) -> List[str]:
        """Extract common phrases and expressions"""
        if not text_samples:
            return []
            
        combined_text = " ".join(text_samples).lower()
        
        # Extract 2-3 word phrases
        words = combined_text.split()
        phrases = []
        
        for i in range(len(words) - 2):
            phrase = " ".join(words[i:i+3])
            if len(phrase.split()) == 3 and len(phrase) > 10:
                phrases.append(phrase)
        
        phrase_counts = Counter(phrases)
        common_phrases = [phrase for phrase, count in phrase_counts.most_common(10) if count > 1]
        
        return common_phrases

    def _generate_persona_prompt(self, analysis: Dict[str, Any]) -> str:
        """Generate persona prompt for GPT based on analysis"""
        
        writing_style = analysis.get("writing_style", {})
        emotional_tone = analysis.get("emotional_tone", {})
        
        prompt_template = f"""
You are now embodying a persona with the following characteristics:

WRITING STYLE:
- Average sentence length: {writing_style.get('avg_sentence_length', 10)} words
- Vocabulary complexity: {writing_style.get('complexity', 'moderate')}
- Formality level: {writing_style.get('formality_indicator', {}).get('overall_tone', 'neutral')}

EMOTIONAL TONE:
- Primary emotion: {emotional_tone.get('primary_emotion', 'neutral')}
- Communication style: {self._get_communication_style(writing_style)}

KEY CHARACTERISTICS:
- Uses {writing_style.get('avg_sentence_length', 10)} words per sentence on average
- Prefers {writing_style.get('complexity', 'moderate')} vocabulary
- Communicates in a {emotional_tone.get('primary_emotion', 'neutral')} tone

Please respond in a way that matches this persona's communication style, vocabulary preferences, and emotional tone. Be consistent with these characteristics in all your responses.
"""
        return prompt_template.strip()

    def _get_communication_style(self, writing_style: Dict[str, Any]) -> str:
        """Determine communication style based on analysis"""
        formality = writing_style.get("formality_indicator", {}).get("overall_tone", "neutral")
        complexity = writing_style.get("complexity", "moderate")
        
        if formality == "formal" and complexity == "complex":
            return "detailed and structured"
        elif formality == "casual" and complexity == "simple":
            return "conversational and relaxed"
        else:
            return "balanced and clear"

    async def update_persona_data(
        self, 
        profile_id: int, 
        persona_data: Dict[str, Any], 
        db: Session
    ):
        """Update or create persona data in database"""
        try:
            # Check if persona data already exists
            existing_persona = db.query(models.PersonaData).filter(
                models.PersonaData.profile_id == profile_id
            ).first()
            
            if existing_persona:
                # Update existing
                existing_persona.writing_style = persona_data["writing_style"]
                existing_persona.vocabulary_patterns = persona_data["vocabulary_patterns"]
                existing_persona.emotional_tone = persona_data["emotional_tone"]
                existing_persona.common_phrases = persona_data["common_phrases"]
                existing_persona.persona_prompt = persona_data["persona_prompt"]
            else:
                # Create new
                new_persona = models.PersonaData(
                    profile_id=profile_id,
                    writing_style=persona_data["writing_style"],
                    vocabulary_patterns=persona_data["vocabulary_patterns"],
                    emotional_tone=persona_data["emotional_tone"],
                    common_phrases=persona_data["common_phrases"],
                    persona_prompt=persona_data["persona_prompt"]
                )
                db.add(new_persona)
            
            db.commit()
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to update persona data: {e}")
            raise

# Global persona builder instance
persona_builder = PersonaBuilder()