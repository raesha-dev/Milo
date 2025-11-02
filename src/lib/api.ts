/**
 * API Communication Module
 * Handles communication with the chatbot backend and mood tracking
 * Optimized for Google Cloud Speech-to-Text, NLP, Translation, and Sentiment Analysis integration
 */

// Normalize backend API root: accept either with or without trailing `/api`
const _API_RAW = import.meta.env.VITE_BACKEND_API || '';
let API_ROOT = '';
if (_API_RAW && _API_RAW.length > 0) {
  API_ROOT = _API_RAW.endsWith('/api') ? _API_RAW : _API_RAW.replace(/\/$/, '') + '/api';
} else {
  API_ROOT = '/api';
}

// ============= INTERFACES =============

export interface ChatBotResponse {
  response: string;
  mood?: string;
  confidence?: number;
}

export interface RiskAssessment {
  isRisky?: boolean;
  riskLevel?: 'low' | 'medium' | 'high' | string;
  reasons?: string[] | string;
  requiresImmediate?: boolean;
  sentimentScore?: number;
  sentimentMagnitude?: number;
}

// When the backend detects safety concerns it may attach this metadata
export interface ChatBotResponseWithRisk extends ChatBotResponse {
  riskAssessment?: RiskAssessment;
  alertId?: string;
}

export interface MoodEntry {
  id: string;
  mood: string;
  emoji: string;
  timestamp: string;
  note?: string;
  userId?: string;
  sentiment?: {
    score: number;
    magnitude: number;
    classification: string;
  };
}

export interface StreakData {
  currentStreak: number;
  weekNumber: number;
  dayOfWeek: number;
  totalDays: number;
  lastLogDate: string;
  rewardEarned: boolean;
}

export interface SentimentResult {
  score: number;
  label: string;
}

// ============= LOCAL STORAGE KEYS =============

const MOODS_KEY = 'mood_logger_moods';
const STREAK_KEY = 'mood_logger_streak';

// ============= HELPER FUNCTIONS =============

async function checkResponse(res: Response) {
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API error ${res.status}: ${errorText || res.statusText}`);
  }
  return res.json();
}

/**
 * Mock responses for development/testing
 */
function getMockResponse(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('good') || lowerMessage.includes('great') || lowerMessage.includes('😊')) {
    return "That's wonderful to hear! 🌸 I'm so glad you're feeling good. What's been making you happy today?";
  }
  
  if (lowerMessage.includes('tough') || lowerMessage.includes('sad') || lowerMessage.includes('😔')) {
    return "I'm here for you 💙 It's okay to have tough days. Would you like to talk about what's on your mind?";
  }
  
  if (lowerMessage.includes('support') || lowerMessage.includes('help') || lowerMessage.includes('🤗')) {
    return "You're not alone 🤗 I'm here to support you. Take your time, and share whatever feels right to you.";
  }
  
  return "Thank you for sharing that with me. I'm listening and here to support you however I can. 🌸";
}

// ============= CHATBOT API =============

/**
 * Send a message to the chatbot and get a response
 * 
 * @param message - User message text
 * @returns Bot response
 */
export async function chatWithBot(message: string): Promise<ChatBotResponseWithRisk> {
  try {
    // Try backend API endpoint first
    const response = await fetch(`${API_ROOT}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error communicating with chatbot:', error);
    
    // Fallback mock response for development
    return {
      response: getMockResponse(message),
      mood: 'supportive',
      // No risk in mock fallback
      riskAssessment: undefined,
      alertId: undefined,
    } as ChatBotResponseWithRisk;
  }
}

// ============= SENTIMENT ANALYSIS =============

/**
 * Analyze sentiment of text using backend API or local keyword analysis
 * Compatible with Google Cloud Natural Language API integration
 * 
 * @param text - Text to analyze
 * @returns Sentiment result with score and label
 */
export async function analyzeSentiment(text: string): Promise<SentimentResult> {
  // Try backend API first (can integrate Google Cloud Natural Language)
  if (API_ROOT) {
    try {
      const res = await fetch(`${API_ROOT}/sentiment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      return checkResponse(res);
    } catch (error) {
      console.warn('Backend sentiment API failed, using local analysis:', error);
    }
  }
  
  // Fallback: Simple sentiment analysis based on keywords
  const positiveWords = ['happy', 'great', 'good', 'amazing', 'wonderful', 'peaceful', 'calm', 'joy', 'love', 'excited'];
  const negativeWords = ['sad', 'bad', 'angry', 'tired', 'anxious', 'worried', 'stressed', 'upset', 'depressed', 'frustrated'];
  
  const lowerText = text.toLowerCase();
  let score = 0;
  
  positiveWords.forEach(word => {
    if (lowerText.includes(word)) score += 0.3;
  });
  
  negativeWords.forEach(word => {
    if (lowerText.includes(word)) score -= 0.3;
  });
  
  // Clamp between -1 and 1
  score = Math.max(-1, Math.min(1, score));
  
  return {
    score,
    label: score > 0.3 ? 'positive' : score < -0.3 ? 'negative' : 'neutral'
  };
}

// ============= TEXT-TO-SPEECH =============

/**
 * Generate text-to-speech audio
 * Can integrate with Google Cloud Text-to-Speech API
 * 
 * @param text - Text to convert to speech
 * @returns Audio URL
 */
export async function generateTTS(text: string): Promise<{ audio_url: string }> {
  const res = await fetch(`${API_ROOT}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return checkResponse(res);
}

/**
 * Plays audio from the provided URL.
 * Returns a Promise that resolves when audio finishes playing or rejects on error.
 *
 * @param url - The URL of the audio to play
 */
export function playAudioFromUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error("Failed to play audio."));
    audio.play().catch(reject);
  });
}

// ============= MOOD TRACKING =============

/**
 * Save mood entry to backend and localStorage
 * 
 * @param mood - Mood entry to save
 */
export async function saveMood(mood: MoodEntry): Promise<void> {
  // Save to backend if available
  if (API_ROOT) {
    try {
      const res = await fetch(`${API_ROOT}/mood`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mood),
      });
      await checkResponse(res);
    } catch (error) {
      console.warn('Backend mood save failed, using localStorage:', error);
    }
  }
  
  // Always save to localStorage as well
  const moods = await getRecentMoods();
  const updatedMoods = [mood, ...moods];
  localStorage.setItem(MOODS_KEY, JSON.stringify(updatedMoods));
}

/**
 * Get recent mood entries from backend or localStorage
 * 
 * @returns Array of mood entries
 */
export async function getRecentMoods(): Promise<MoodEntry[]> {
  // Try backend first
  if (API_ROOT) {
    try {
      const res = await fetch(`${API_ROOT}/mood`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      // Backend historically returned an array, but newer server returns
      // an object { moods: [...], count, status }. Normalize both shapes
      const data = await checkResponse(res);
      if (Array.isArray(data)) return data as MoodEntry[];
      if (data && Array.isArray((data as any).moods)) return (data as any).moods as MoodEntry[];
      // Unexpected shape: try to be defensive
      return [];
    } catch (error) {
      console.warn('Backend mood fetch failed, using localStorage:', error);
    }
  }
  
  // Fallback to localStorage
  const stored = localStorage.getItem(MOODS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

// ============= STREAK TRACKING =============

/**
 * Get streak data from localStorage
 * 
 * @returns Streak data
 */
export async function getStreakData(): Promise<StreakData> {
  const stored = localStorage.getItem(STREAK_KEY);
  if (!stored) {
    return {
      currentStreak: 0,
      weekNumber: 0,
      dayOfWeek: 0,
      totalDays: 0,
      lastLogDate: '',
      rewardEarned: false
    };
  }
  try {
    return JSON.parse(stored);
  } catch {
    return {
      currentStreak: 0,
      weekNumber: 0,
      dayOfWeek: 0,
      totalDays: 0,
      lastLogDate: '',
      rewardEarned: false
    };
  }
}

/**
 * Update streak data in localStorage
 * 
 * @param data - Updated streak data
 */
export async function updateStreakData(data: StreakData): Promise<void> {
  localStorage.setItem(STREAK_KEY, JSON.stringify(data));
}
