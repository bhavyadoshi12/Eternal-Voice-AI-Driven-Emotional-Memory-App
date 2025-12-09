from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List
import logging
from datetime import datetime, timedelta
from collections import Counter
import json

from backend.database import get_db
from backend import models, schemas

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/data/{profile_id}", response_model=schemas.APIResponse)
async def get_visualization_data(profile_id: int, db: Session = Depends(get_db)):
    """
    Get comprehensive visualization data for a profile
    """
    try:
        # Verify profile exists
        profile = db.query(models.Profile).filter(models.Profile.id == profile_id).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        # Get all data for visualization
        visualization_data = await generate_comprehensive_visualization(profile_id, db)
        
        return {
            "success": True,
            "data": visualization_data
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get visualization data: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get visualization data: {str(e)}")

async def generate_comprehensive_visualization(profile_id: int, db: Session) -> Dict[str, Any]:
    """
    Generate comprehensive visualization data from all available sources
    """
    # Get chat history
    chats = db.query(models.ChatHistory).filter(
        models.ChatHistory.profile_id == profile_id
    ).all()

    # Get transcripts
    transcripts = db.query(models.Transcription).filter(
        models.Transcription.profile_id == profile_id
    ).all()

    # Get persona data
    persona_data = db.query(models.PersonaData).filter(
        models.PersonaData.profile_id == profile_id
    ).first()

    # Generate different types of visualizations
    emotion_data = generate_emotion_analysis(chats)
    word_data = generate_word_analysis(chats, transcripts)
    timeline_data = generate_timeline_analysis(chats)
    conversation_data = generate_conversation_analysis(chats)
    persona_insights = generate_persona_insights(persona_data)

    return {
        "emotion_analysis": emotion_data,
        "word_analysis": word_data,
        "timeline_analysis": timeline_data,
        "conversation_analysis": conversation_data,
        "persona_insights": persona_insights,
        "summary_stats": generate_summary_stats(chats, transcripts, persona_data)
    }

def generate_emotion_analysis(chats: List[models.ChatHistory]) -> Dict[str, Any]:
    """Generate emotion distribution and patterns"""
    if not chats:
        return get_sample_emotion_data()
    
    emotion_counts = Counter()
    emotion_timeline = {}
    
    for chat in chats:
        if chat.emotion_detected:
            emotion_counts[chat.emotion_detected] += 1
            
            # Group by date for timeline
            date_key = chat.created_at.strftime("%Y-%m-%d")
            if date_key not in emotion_timeline:
                emotion_timeline[date_key] = Counter()
            emotion_timeline[date_key][chat.emotion_detected] += 1
    
    # Convert to percentage
    total = sum(emotion_counts.values())
    emotion_percentages = {
        emotion: round((count / total) * 100, 2)
        for emotion, count in emotion_counts.items()
    }
    
    # Prepare timeline data
    timeline_labels = sorted(emotion_timeline.keys())
    timeline_datasets = {}
    
    # Get all unique emotions
    all_emotions = set()
    for date_data in emotion_timeline.values():
        all_emotions.update(date_data.keys())
    
    for emotion in all_emotions:
        timeline_datasets[emotion] = [
            emotion_timeline[date].get(emotion, 0) for date in timeline_labels
        ]
    
    return {
        "distribution": emotion_percentages,
        "timeline": {
            "labels": timeline_labels,
            "datasets": timeline_datasets
        },
        "primary_emotion": emotion_counts.most_common(1)[0][0] if emotion_counts else "neutral",
        "emotion_diversity": len(emotion_counts)
    }

def generate_word_analysis(chats: List[models.ChatHistory], transcripts: List[models.Transcription]) -> Dict[str, Any]:
    """Generate word frequency and text analysis"""
    if not chats and not transcripts:
        return get_sample_word_data()
    
    all_text = ""
    
    # Combine text from chats
    for chat in chats:
        all_text += f" {chat.user_message} {chat.ai_response}"
    
    # Combine text from transcripts
    for transcript in transcripts:
        if transcript.cleaned_text:
            all_text += f" {transcript.cleaned_text}"
    
    # Basic text processing
    words = [word.lower() for word in all_text.split() if len(word) > 3]
    word_freq = Counter(words)
    
    # Remove common stop words
    stop_words = {'that', 'with', 'this', 'have', 'from', 'they', 'were', 'been', 'will', 'your', 'there'}
    meaningful_words = {word: count for word, count in word_freq.items() 
                       if word not in stop_words and count > 1}
    
    # Get top words
    top_words = dict(sorted(meaningful_words.items(), key=lambda x: x[1], reverse=True)[:20])
    
    # Text statistics
    total_words = len(words)
    unique_words = len(set(words))
    avg_word_length = sum(len(word) for word in words) / total_words if total_words > 0 else 0
    
    return {
        "word_frequency": top_words,
        "text_statistics": {
            "total_words": total_words,
            "unique_words": unique_words,
            "vocabulary_diversity": round((unique_words / total_words) * 100, 2) if total_words > 0 else 0,
            "average_word_length": round(avg_word_length, 2)
        },
        "common_phrases": extract_common_phrases(all_text)
    }

def generate_timeline_analysis(chats: List[models.ChatHistory]) -> Dict[str, Any]:
    """Generate timeline and temporal patterns"""
    if not chats:
        return get_sample_timeline_data()
    
    # Group by hour of day
    hourly_activity = Counter()
    daily_activity = Counter()
    monthly_activity = Counter()
    
    for chat in chats:
        hour = chat.created_at.hour
        day = chat.created_at.strftime("%A")
        month = chat.created_at.strftime("%Y-%m")
        
        hourly_activity[hour] += 1
        daily_activity[day] += 1
        monthly_activity[month] += 1
    
    # Convert to arrays for charts
    hours = list(range(24))
    hourly_counts = [hourly_activity.get(hour, 0) for hour in hours]
    
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    daily_counts = [daily_activity.get(day, 0) for day in days]
    
    return {
        "hourly_activity": {
            "labels": [f"{h:02d}:00" for h in hours],
            "data": hourly_counts
        },
        "daily_activity": {
            "labels": days,
            "data": daily_counts
        },
        "monthly_activity": {
            "labels": list(monthly_activity.keys()),
            "data": list(monthly_activity.values())
        },
        "peak_hours": [hour for hour, count in hourly_activity.most_common(3)],
        "peak_days": [day for day, count in daily_activity.most_common(2)]
    }

def generate_conversation_analysis(chats: List[models.ChatHistory]) -> Dict[str, Any]:
    """Generate conversation patterns and metrics"""
    if not chats:
        return get_sample_conversation_data()
    
    response_times = [chat.response_time for chat in chats if chat.response_time]
    message_lengths = []
    
    for chat in chats:
        message_lengths.append(len(chat.user_message.split()))
        message_lengths.append(len(chat.ai_response.split()))
    
    conversation_duration = None
    if chats:
        start_time = min(chat.created_at for chat in chats)
        end_time = max(chat.created_at for chat in chats)
        conversation_duration = (end_time - start_time).total_seconds() / 3600  # in hours
    
    return {
        "response_time_stats": {
            "average": round(sum(response_times) / len(response_times), 2) if response_times else 0,
            "min": min(response_times) if response_times else 0,
            "max": max(response_times) if response_times else 0
        },
        "message_length_stats": {
            "average": round(sum(message_lengths) / len(message_lengths), 2) if message_lengths else 0,
            "min": min(message_lengths) if message_lengths else 0,
            "max": max(message_lengths) if message_lengths else 0
        },
        "conversation_metrics": {
            "total_messages": len(chats) * 2,  # user + AI
            "conversation_duration_hours": round(conversation_duration, 2) if conversation_duration else 0,
            "messages_per_hour": round((len(chats) * 2) / conversation_duration, 2) if conversation_duration else 0
        }
    }

def generate_persona_insights(persona_data: models.PersonaData) -> Dict[str, Any]:
    """Generate insights from persona data"""
    if not persona_data:
        return get_sample_persona_insights()
    
    writing_style = persona_data.writing_style or {}
    emotional_tone = persona_data.emotional_tone or {}
    vocabulary_patterns = persona_data.vocabulary_patterns or {}
    
    return {
        "writing_style": {
            "sentence_complexity": writing_style.get("complexity", "moderate"),
            "avg_sentence_length": writing_style.get("avg_sentence_length", 0),
            "formality_level": writing_style.get("formality_indicator", {}).get("overall_tone", "neutral")
        },
        "emotional_profile": {
            "primary_emotion": emotional_tone.get("primary_emotion", "neutral"),
            "confidence": emotional_tone.get("confidence", 0),
            "emotional_range": len(emotional_tone.get("all_scores", {}))
        },
        "vocabulary_insights": {
            "unique_words": vocabulary_patterns.get("unique_words_count", 0),
            "word_diversity": vocabulary_patterns.get("word_diversity", 0),
            "top_words": list(vocabulary_patterns.get("frequent_words", {}).keys())[:5]
        },
        "common_phrases": persona_data.common_phrases or []
    }

def generate_summary_stats(chats: List[models.ChatHistory], transcripts: List[models.Transcription], persona_data: models.PersonaData) -> Dict[str, Any]:
    """Generate summary statistics"""
    return {
        "total_conversations": len(chats),
        "total_transcripts": len(transcripts),
        "total_words": sum(len(chat.user_message.split()) + len(chat.ai_response.split()) for chat in chats),
        "persona_available": persona_data is not None,
        "data_richness": calculate_data_richness(chats, transcripts),
        "engagement_level": calculate_engagement_level(chats)
    }

def calculate_data_richness(chats: List[models.ChatHistory], transcripts: List[models.Transcription]) -> str:
    """Calculate data richness level"""
    total_items = len(chats) + len(transcripts)
    
    if total_items == 0:
        return "No Data"
    elif total_items < 10:
        return "Basic"
    elif total_items < 50:
        return "Moderate"
    elif total_items < 100:
        return "Rich"
    else:
        return "Very Rich"

def calculate_engagement_level(chats: List[models.ChatHistory]) -> str:
    """Calculate engagement level based on conversation frequency"""
    if not chats:
        return "No Activity"
    
    # Check if conversations are recent and frequent
    recent_chats = [chat for chat in chats 
                   if (datetime.now() - chat.created_at).days < 30]
    
    if len(recent_chats) == 0:
        return "Inactive"
    elif len(recent_chats) < 10:
        return "Occasional"
    elif len(recent_chats) < 30:
        return "Active"
    else:
        return "Highly Active"

def extract_common_phrases(text: str, min_length: int = 3) -> List[str]:
    """Extract common phrases from text"""
    words = text.lower().split()
    phrases = []
    
    for i in range(len(words) - min_length + 1):
        phrase = " ".join(words[i:i + min_length])
        if len(phrase) > 10:  # Only consider meaningful phrases
            phrases.append(phrase)
    
    phrase_counts = Counter(phrases)
    return [phrase for phrase, count in phrase_counts.most_common(10) if count > 2]

# Sample data for when no real data is available
def get_sample_emotion_data():
    return {
        "distribution": {"joy": 35, "neutral": 25, "sadness": 15, "surprise": 12, "fear": 8, "anger": 5},
        "timeline": {
            "labels": ["2023-01", "2023-02", "2023-03", "2023-04", "2023-05", "2023-06"],
            "datasets": {
                "joy": [65, 59, 80, 81, 56, 55],
                "neutral": [45, 25, 36, 48, 25, 42],
                "sadness": [28, 48, 40, 19, 86, 27]
            }
        },
        "primary_emotion": "joy",
        "emotion_diversity": 6
    }

def get_sample_word_data():
    return {
        "word_frequency": {
            "love": 12, "family": 9, "happy": 8, "remember": 7, "time": 6,
            "life": 5, "good": 4, "home": 3, "friend": 3, "hope": 2
        },
        "text_statistics": {
            "total_words": 1500,
            "unique_words": 450,
            "vocabulary_diversity": 30.0,
            "average_word_length": 4.5
        },
        "common_phrases": ["I remember when", "that was wonderful", "good times", "family gathering"]
    }

def get_sample_timeline_data():
    return {
        "hourly_activity": {
            "labels": [f"{h:02d}:00" for h in range(24)],
            "data": [2, 1, 0, 0, 0, 1, 3, 5, 8, 12, 15, 18, 20, 18, 15, 12, 10, 8, 6, 4, 3, 2, 2, 1]
        },
        "daily_activity": {
            "labels": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
            "data": [15, 18, 20, 22, 25, 30, 28]
        },
        "monthly_activity": {
            "labels": ["2023-01", "2023-02", "2023-03", "2023-04", "2023-05", "2023-06"],
            "data": [45, 52, 48, 55, 60, 65]
        },
        "peak_hours": [12, 13, 11],
        "peak_days": ["Saturday", "Friday"]
    }

def get_sample_conversation_data():
    return {
        "response_time_stats": {
            "average": 2.5,
            "min": 1.2,
            "max": 4.8
        },
        "message_length_stats": {
            "average": 15.5,
            "min": 3,
            "max": 45
        },
        "conversation_metrics": {
            "total_messages": 47,
            "conversation_duration_hours": 8.5,
            "messages_per_hour": 5.5
        }
    }

def get_sample_persona_insights():
    return {
        "writing_style": {
            "sentence_complexity": "moderate",
            "avg_sentence_length": 12.5,
            "formality_level": "casual"
        },
        "emotional_profile": {
            "primary_emotion": "joy",
            "confidence": 0.85,
            "emotional_range": 5
        },
        "vocabulary_insights": {
            "unique_words": 245,
            "word_diversity": 0.65,
            "top_words": ["love", "family", "happy", "remember", "wonderful"]
        },
        "common_phrases": ["I remember when", "that was wonderful", "good times"]
    }