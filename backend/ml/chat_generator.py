import openai
from openai import OpenAI
from typing import Dict, List, Any, Optional
import logging
import time
from sqlalchemy.orm import Session
from backend.settings import settings
from backend import models

logger = logging.getLogger(__name__)

class ChatGenerator:
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None
        self.conversation_history = {}
        
    async def generate_response(
        self,
        profile_id: int,
        user_message: str,
        db: Session,
        temperature: float = 0.7,
        max_tokens: int = 500
    ) -> Dict[str, Any]:
        """
        Generate AI response using GPT with persona context
        """
        try:
            if not self.client:
                raise ValueError("OpenAI client not configured")
            
            start_time = time.time()
            
            # Get persona data
            persona_data = db.query(models.PersonaData).filter(
                models.PersonaData.profile_id == profile_id
            ).first()
            
            # Get recent conversation history
            conversation_context = self._get_conversation_context(profile_id, db)
            
            # Prepare messages for GPT
            messages = self._prepare_messages(persona_data, conversation_context, user_message)
            
            # Generate response
            response = self.client.chat.completions.create(
                model=settings.GPT_MODEL,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=False
            )
            
            ai_response = response.choices[0].message.content
            processing_time = time.time() - start_time
            
            # Detect emotion in response
            emotion_detected = self._detect_emotion(ai_response)
            
            # Save to chat history
            self._save_chat_history(profile_id, user_message, ai_response, emotion_detected, processing_time, db)
            
            return {
                "response": ai_response,
                "processing_time": round(processing_time, 2),
                "emotion_detected": emotion_detected,
                "tokens_used": response.usage.total_tokens if response.usage else 0
            }
            
        except Exception as e:
            logger.error(f"Chat generation failed: {e}")
            raise

    def _get_conversation_context(self, profile_id: int, db: Session, limit: int = 10) -> List[Dict[str, str]]:
        """Get recent conversation history for context"""
        try:
            recent_chats = db.query(models.ChatHistory).filter(
                models.ChatHistory.profile_id == profile_id
            ).order_by(models.ChatHistory.created_at.desc()).limit(limit).all()
            
            # Reverse to get chronological order
            recent_chats.reverse()
            
            context = []
            for chat in recent_chats:
                context.extend([
                    {"role": "user", "content": chat.user_message},
                    {"role": "assistant", "content": chat.ai_response}
                ])
            
            return context
            
        except Exception as e:
            logger.error(f"Failed to get conversation context: {e}")
            return []

    def _prepare_messages(
        self, 
        persona_data: Optional[models.PersonaData],
        conversation_context: List[Dict[str, str]],
        user_message: str
    ) -> List[Dict[str, str]]:
        """Prepare messages array for GPT"""
        messages = []
        
        # System message with persona
        if persona_data and persona_data.persona_prompt:
            system_message = persona_data.persona_prompt
        else:
            system_message = """You are a helpful AI assistant that communicates in a warm, conversational manner. 
            Respond naturally and empathetically to the user's messages."""
        
        messages.append({"role": "system", "content": system_message})
        
        # Add conversation context
        messages.extend(conversation_context)
        
        # Add current user message
        messages.append({"role": "user", "content": user_message})
        
        return messages

    def _detect_emotion(self, text: str) -> str:
        """Simple emotion detection from text"""
        text_lower = text.lower()
        
        emotion_keywords = {
            'joy': ['happy', 'excited', 'wonderful', 'amazing', 'love', 'great', 'fantastic'],
            'sadness': ['sad', 'unhappy', 'sorry', 'regret', 'miss', 'lost', 'unfortunate'],
            'anger': ['angry', 'mad', 'frustrated', 'annoyed', 'hate', 'upset'],
            'fear': ['scared', 'afraid', 'worried', 'nervous', 'anxious', 'concerned'],
            'surprise': ['surprised', 'shocked', 'amazed', 'unexpected', 'wow'],
            'neutral': ['okay', 'fine', 'good', 'well', 'alright', 'understand']
        }
        
        emotion_scores = {}
        for emotion, keywords in emotion_keywords.items():
            score = sum(text_lower.count(keyword) for keyword in keywords)
            emotion_scores[emotion] = score
            
        # Get emotion with highest score
        primary_emotion = max(emotion_scores.items(), key=lambda x: x[1])
        
        return primary_emotion[0] if primary_emotion[1] > 0 else 'neutral'

    def _save_chat_history(
        self,
        profile_id: int,
        user_message: str,
        ai_response: str,
        emotion_detected: str,
        processing_time: float,
        db: Session
    ):
        """Save chat conversation to database"""
        try:
            chat_entry = models.ChatHistory(
                profile_id=profile_id,
                user_message=user_message,
                ai_response=ai_response,
                emotion_detected=emotion_detected,
                response_time=processing_time
            )
            
            db.add(chat_entry)
            db.commit()
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to save chat history: {e}")

    async def get_conversation_summary(self, profile_id: int, db: Session) -> Dict[str, Any]:
        """Get summary of conversation history"""
        try:
            all_chats = db.query(models.ChatHistory).filter(
                models.ChatHistory.profile_id == profile_id
            ).order_by(models.ChatHistory.created_at.asc()).all()
            
            if not all_chats:
                return {"total_messages": 0, "recent_activity": "No conversations yet"}
            
            total_messages = len(all_chats)
            recent_chats = all_chats[-5:]  # Last 5 messages
            
            # Calculate average response time
            avg_response_time = sum(chat.response_time for chat in all_chats) / total_messages
            
            # Get most common emotions
            emotions = [chat.emotion_detected for chat in all_chats if chat.emotion_detected]
            emotion_counts = {}
            for emotion in emotions:
                emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
            
            dominant_emotion = max(emotion_counts.items(), key=lambda x: x[1])[0] if emotion_counts else "neutral"
            
            return {
                "total_messages": total_messages,
                "avg_response_time": round(avg_response_time, 2),
                "dominant_emotion": dominant_emotion,
                "conversation_start": all_chats[0].created_at.isoformat(),
                "recent_messages": [
                    {
                        "user_message": chat.user_message[:100] + "..." if len(chat.user_message) > 100 else chat.user_message,
                        "ai_response": chat.ai_response[:100] + "..." if len(chat.ai_response) > 100 else chat.ai_response,
                        "timestamp": chat.created_at.isoformat(),
                        "emotion": chat.emotion_detected
                    }
                    for chat in recent_chats
                ]
            }
            
        except Exception as e:
            logger.error(f"Failed to get conversation summary: {e}")
            return {"total_messages": 0, "error": str(e)}

# Global chat generator instance
chat_generator = ChatGenerator()