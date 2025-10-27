// Google Cloud Integration Services
// This file contains service functions for integrating with Google Cloud features

// ============================================================================
// GOOGLE CLOUD NLP - Sentiment Analysis
// ============================================================================

export interface SentimentAnalysis {
  score: number; // -1 (negative) to 1 (positive)
  magnitude: number; // 0 (neutral) to +inf (emotional)
  classification: 'positive' | 'neutral' | 'negative' | 'risky';
}

export async function analyzeSentiment(text: string): Promise<SentimentAnalysis> {
  try {
    // Call our backend API endpoint that handles Google Cloud NLP
    const response = await fetch('/api/sentiment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      throw new Error(`Sentiment analysis failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Map the backend response to our frontend SentimentAnalysis type
    const sentiment: SentimentAnalysis = {
      score: result.score,
      magnitude: result.magnitude,
      // Classify based on score ranges
      classification: result.score > 0.25 ? 'positive' :
                     result.score < -0.25 ? 'negative' :
                     result.magnitude > 0.6 ? 'risky' : 'neutral'
    };
    
    return sentiment;
  } catch (error) {
    console.error('Sentiment analysis error:', error);
    // Fallback to neutral sentiment for demo/development
    return {
      score: 0,
      magnitude: 0,
      classification: 'neutral'
    };
  }
}

interface RiskAssessment {
  isRisky: boolean;
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];
  requiresImmediate: boolean;
}

export async function detectRiskyContent(text: string): Promise<RiskAssessment> {
  try {
    // First, get sentiment analysis
    const sentiment = await analyzeSentiment(text);
    
    // Initial risk assessment based on keywords (fallback if API fails)
    const immediateRiskKeywords = [
      'suicide', 'kill myself', 'end my life', 'want to die',
      'hurt myself', 'self harm', 'cut myself'
    ];
    
    const moderateRiskKeywords = [
      'worthless', 'hopeless', 'can\'t take it', 'give up',
      'no point', 'better off without me', 'no hope'
    ];

    const hasImmediateRisk = immediateRiskKeywords.some(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    );

    const hasModerateRisk = moderateRiskKeywords.some(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    );

    // Call backend for advanced NLP analysis
    try {
      const response = await fetch('/api/risk-assessment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text,
          initialSentiment: sentiment 
        })
      });

      if (response.ok) {
        const nlpResult = await response.json();
        return {
          isRisky: nlpResult.isRisky,
          riskLevel: nlpResult.riskLevel,
          reasons: nlpResult.reasons,
          requiresImmediate: nlpResult.requiresImmediate
        };
      }
    } catch (error) {
      console.error('Risk assessment API error:', error);
      // Fall through to fallback assessment
    }

    // Fallback risk assessment if API fails
    const reasons: string[] = [];
    
    if (hasImmediateRisk) {
      reasons.push('Direct mentions of self-harm or suicide');
    }
    
    if (hasModerateRisk) {
      reasons.push('Expressions of hopelessness or giving up');
    }
    
    if (sentiment.score < -0.7) {
      reasons.push('Extremely negative emotional state detected');
    }
    
    if (sentiment.magnitude > 0.9) {
      reasons.push('High emotional intensity detected');
    }

    // Determine risk level based on combined factors
    let riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical' = 'none';
    
    if (hasImmediateRisk) {
      riskLevel = 'critical';
    } else if (hasModerateRisk && sentiment.score < -0.5) {
      riskLevel = 'high';
    } else if (hasModerateRisk || sentiment.score < -0.7) {
      riskLevel = 'medium';
    } else if (sentiment.score < -0.5 || sentiment.magnitude > 0.8) {
      riskLevel = 'low';
    }

    return {
      isRisky: riskLevel !== 'none',
      riskLevel,
      reasons,
      requiresImmediate: riskLevel === 'critical'
    };
  } catch (error) {
    console.error('Risk detection error:', error);
    // Ultimate fallback for complete failure - assume risky if we can't assess
    return {
      isRisky: true,
      riskLevel: 'medium',
      reasons: ['Unable to perform full risk assessment'],
      requiresImmediate: false
    };
  }
}

// ============================================================================
// GOOGLE CLOUD FIRESTORE - Data Storage
// ============================================================================

export interface MoodEntry {
  id?: string;
  userId: string; // Anonymous hash
  mood: string;
  timestamp: Date;
  sentiment?: SentimentAnalysis;
}

export interface AnonymousMessage {
  id?: string;
  roomId: string;
  message: string;
  mood: string;
  timestamp: Date;
  hearts: number;
}

export async function saveMoodEntry(mood: MoodEntry): Promise<void> {
  try {
    const response = await fetch('/api/mood', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...mood,
        timestamp: mood.timestamp.toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to save mood: ${response.statusText}`);
    }

    const result = await response.json();
    if (result.id) {
      mood.id = result.id; // Update the mood object with the new ID
    }
    // Update streak/rewards based on this mood entry (local-first)
    try {
      await updateStreakFromMood(mood);
    } catch (e) {
      console.warn('Failed to update streak after saving mood:', e);
    }
  } catch (error) {
    console.error('Error saving mood:', error);
    throw new Error('Failed to save mood entry. Please try again later.');
  }
}

export async function saveAnonymousMessage(message: AnonymousMessage): Promise<void> {
  try {
    const response = await fetch('/api/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...message,
        timestamp: message.timestamp.toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to save message: ${response.statusText}`);
    }

    const result = await response.json();
    if (result.id) {
      message.id = result.id; // Update the message object with the new ID
    }
  } catch (error) {
    console.error('Error saving message:', error);
    throw new Error('Failed to save message. Please try again later.');
  }
}

export async function getSupportRoomMessages(roomId: string): Promise<AnonymousMessage[]> {
  try {
    const response = await fetch(`/api/messages/${roomId}?limit=20`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch messages: ${response.statusText}`);
    }

    const result = await response.json();
    return result.messages.map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    }));
  } catch (error) {
    console.error('Error fetching support room messages:', error);
    return []; // Return empty array as fallback
  }
}

// ============================================================================
// STREAKS & REWARDS - Persistence helpers (localStorage-first, optional backend sync)
// ============================================================================

export interface Reward {
  id?: string;
  title: string;
  awardedAt: Date;
  tier?: string;
}

const STORAGE_PREFIX = 'milo_v1';

function storageKey(key: string, userId: string) {
  return `${STORAGE_PREFIX}_${userId}_${key}`;
}

function loadLocal<T>(key: string, userId: string): T | null {
  try {
    const raw = localStorage.getItem(storageKey(key, userId));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error('localStorage load error', e);
    return null;
  }
}

function saveLocal<T>(key: string, userId: string, value: T) {
  try {
    localStorage.setItem(storageKey(key, userId), JSON.stringify(value));
  } catch (e) {
    console.error('localStorage save error', e);
  }
}

export async function getStreak(userId: string): Promise<number> {
  // Prefer backend if available
  try {
    const resp = await fetch(`/api/streak?userId=${encodeURIComponent(userId)}`);
    if (resp.ok) {
      const data = await resp.json();
      if (typeof data.streak === 'number') return data.streak;
    }
  } catch (e) {
    // ignore and fallback
  }

  const local = loadLocal<{ streak: number }>('streak', userId);
  return local?.streak ?? 0;
}

export async function setStreak(userId: string, streak: number): Promise<void> {
  // Try backend sync (best-effort)
  try {
    await fetch('/api/streak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, streak })
    });
  } catch (e) {
    // ignore
  }
  saveLocal('streak', userId, { streak });
}

export async function getRewards(userId: string): Promise<Reward[]> {
  try {
    const resp = await fetch(`/api/rewards?userId=${encodeURIComponent(userId)}`);
    if (resp.ok) {
      const data = await resp.json();
      return (data.rewards || []).map((r: any) => ({ ...r, awardedAt: new Date(r.awardedAt) }));
    }
  } catch (e) {
    // fallback
  }
  const local = loadLocal<Reward[]>('rewards', userId);
  return (local || []).map(r => ({ ...r, awardedAt: new Date(r.awardedAt) }));
}

export async function addReward(userId: string, reward: Reward): Promise<void> {
  const r = { ...reward, id: reward.id || String(Date.now()), awardedAt: new Date(reward.awardedAt) };
  // Try backend
  try {
    await fetch('/api/reward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, reward: { ...r, awardedAt: r.awardedAt.toISOString() } })
    });
  } catch (e) {
    // ignore
  }

  const existing = loadLocal<Reward[]>('rewards', userId) || [];
  existing.push(r);
  saveLocal('rewards', userId, existing);
}

function utcDaysBetween(a: Date, b: Date) {
  const utcA = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const utcB = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.floor((utcB - utcA) / (24 * 60 * 60 * 1000));
}

export async function updateStreakFromMood(mood: MoodEntry): Promise<number> {
  const userId = mood.userId;
  try {
    // Load last mood date from local storage (fallback)
    const lastRaw = loadLocal<{ lastMoodISO: string }>('lastMood', userId);
    const lastDate = lastRaw?.lastMoodISO ? new Date(lastRaw.lastMoodISO) : null;
    const currentDate = new Date(mood.timestamp);

    let streak = await getStreak(userId);

    if (!lastDate) {
      // First entry
      streak = 1;
    } else {
      const days = utcDaysBetween(lastDate, currentDate);
      if (days === 0) {
        // same day - no change
      } else if (days === 1) {
        streak = (streak || 0) + 1;
      } else {
        // broke streak
        streak = 1;
      }
    }

    // persist
    saveLocal('lastMood', userId, { lastMoodISO: currentDate.toISOString() });
    await setStreak(userId, streak);

    // Award reward at two-week milestone
    if (streak >= 14) {
      const rewards = await getRewards(userId);
      const already = rewards.some(r => r.title === 'Two-week consistency');
      if (!already) {
        await addReward(userId, {
          title: 'Two-week consistency',
          awardedAt: new Date(),
          tier: 'bronze'
        });
      }
    }

    return streak;
  } catch (e) {
    console.error('updateStreakFromMood error', e);
    return await getStreak(mood.userId);
  }
}

// ============================================================================
// GOOGLE CLOUD TEXT-TO-SPEECH - Audio Guidance
// ============================================================================

export interface TTSOptions {
  text: string;
  voiceName?: string;
  languageCode?: string;
  speakingRate?: number;
}

export async function generateSpeech(options: TTSOptions): Promise<string> {
  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: options.text,
        voiceName: options.voiceName || 'en-US-Journey-F',
        languageCode: options.languageCode || 'en-US',
        speakingRate: options.speakingRate || 1.0
      })
    });

    if (!response.ok) {
      throw new Error(`Text-to-speech generation failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.audio_url) {
      throw new Error('No audio URL received from server');
    }

    // The backend returns a signed URL to the audio file in Cloud Storage
    return result.audio_url;
  } catch (error) {
    console.error('Text-to-speech error:', error);
    // For development/demo, return a placeholder audio
    if (!GOOGLE_CLOUD_CONFIG.tts.enabled) {
      return 'data:audio/mp3;base64,placeholder';
    }
    throw new Error('Failed to generate speech. Please try again later.');
  }
}

export async function playGuidedMeditation(meditationType: string): Promise<void> {
  // TODO: Generate and play meditation audio
  const meditationTexts = {
    breathing: "Let's begin by finding a comfortable position. Close your eyes gently and take a deep breath in through your nose for 4 counts...",
    gratitude: "Take a moment to settle in. We're going to explore gratitude together. Think of something small that brought you joy today...",
    bodyscan: "We'll start at the top of your head and slowly move through your entire body, noticing each part with kindness..."
  };
  
  const text = meditationTexts[meditationType as keyof typeof meditationTexts] || meditationTexts.breathing;
  const audioUrl = await generateSpeech({ text });
  
  // Play the audio (placeholder)
  console.log('Playing guided meditation:', meditationType);
}

// ============================================================================
// OPENAI INTEGRATION - Milo's Personality
// ============================================================================

export interface MiloResponse {
  message: string;
  sentiment: 'supportive' | 'encouraging' | 'concerned' | 'celebratory';
  suggestedActions?: string[];
}

// Helper function to generate suggested actions
function generateSuggestedActions(
  sentiment: SentimentAnalysis,
  riskAssessment: RiskAssessment,
  streak: number
): string[] {
  const actions: string[] = [];

  // Risk-based actions
  if (riskAssessment.isRisky) {
    actions.push('Talk to someone you trust');
    actions.push('View emergency resources');
    if (riskAssessment.riskLevel === 'critical') {
      actions.push('Call crisis helpline');
    }
  }

  // Sentiment-based actions
  if (sentiment.classification === 'negative') {
    actions.push('Try breathing exercise');
    actions.push('Share in support room');
    actions.push('Start guided meditation');
  } else if (sentiment.classification === 'positive') {
    actions.push('Share your progress');
    actions.push('Practice gratitude');
    if (streak > 7) {
      actions.push('View your growth garden');
    }
  }

  // Streak-based actions
  if (streak >= 14) {
    actions.push('Celebrate your milestone');
    actions.push('Share your journey');
  } else if (streak > 0) {
    actions.push('Keep the streak going');
    actions.push('Log your mood');
  }

  // Return 2-3 most relevant actions
  return actions.slice(0, 3);
}

export async function getMiloResponse(userMessage: string, context?: {
  recentMoods?: string[];
  currentStreak?: number;
}): Promise<MiloResponse> {
  try {
    // First, analyze the message sentiment to help with response selection
    const sentiment = await analyzeSentiment(userMessage);
    
    // Check for any risk factors
    const riskAssessment = await detectRiskyContent(userMessage);

    // Call our backend chat endpoint
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage,
        context: {
          ...context,
          sentiment,
          riskAssessment
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Chat response failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.response) {
      throw new Error('No valid response from chat service');
    }

    // Parse the response and determine sentiment
    const responseSentiment: MiloResponse['sentiment'] = 
      riskAssessment.isRisky ? 'concerned' :
      sentiment.classification === 'positive' ? 'celebratory' :
      sentiment.classification === 'negative' ? 'supportive' : 'encouraging';

    // Generate suggested actions based on context
    const suggestedActions = generateSuggestedActions(
      sentiment,
      riskAssessment,
      context?.currentStreak || 0
    );

    return {
      message: result.response,
      sentiment: responseSentiment,
      suggestedActions
    };
  } catch (error) {
    console.error('Chat error:', error);
    
    // Fallback responses for development/demo
    const responses: MiloResponse[] = [
      {
        message: "I hear you 💙 That sounds like a lot to handle. Want to talk more about it?",
        sentiment: 'supportive',
        suggestedActions: ['Try breathing exercise', 'Share in support room']
      },
      {
        message: "Thank you for sharing that with me 🌱 You're being really brave by opening up.",
        sentiment: 'encouraging',
        suggestedActions: ['Log your mood', 'Practice gratitude']
      },
      {
        message: "That's amazing! I love seeing you grow and feel positive 🌸",
        sentiment: 'celebratory',
        suggestedActions: ['Share in gratitude circle', 'Celebrate your progress']
      }
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }
  const responses: MiloResponse[] = [
    {
      message: "I hear you 💙 That sounds like a lot to handle. Want to talk more about it?",
      sentiment: 'supportive',
      suggestedActions: ['Try breathing exercise', 'Share in support room']
    },
    {
      message: "Thank you for sharing that with me 🌱 You're being really brave by opening up.",
      sentiment: 'encouraging',
      suggestedActions: ['Log your mood', 'Practice gratitude']
    },
    {
      message: "That's amazing! I love seeing you grow and feel positive 🌸",
      sentiment: 'celebratory',
      suggestedActions: ['Share in gratitude circle', 'Celebrate your progress']
    }
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

// ============================================================================
// PRIVACY & SAFETY
// ============================================================================

export function createAnonymousUserId(): string {
  // Generate a secure, anonymous user identifier
  return 'anon_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

export function sanitizeUserInput(input: string): string {
  // Remove any potential PII or sensitive information
  // This is a placeholder - implement proper sanitization
  return input.trim();
}

export function checkConsent(): boolean {
  // Check if user has given consent for data import.metaing
  return localStorage.getItem('milo_consent') === 'true';
}

export function recordConsent(): void {
  localStorage.setItem('milo_consent', 'true');
  localStorage.setItem('milo_consent_date', new Date().toISOString());
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export const GOOGLE_CLOUD_CONFIG = {
  // Add your Google Cloud project configuration here
  projectId: import.meta.env.VITE_GOOGLE_CLOUD_PROJECT_ID || '',
  region: import.meta.env.VITE_GOOGLE_CLOUD_REGION || 'us-central1',
  
  // NLP API settings
  nlp: {
    enabled: import.meta.env.VITE_ENABLE_NLP === 'true',
    endpoint: import.meta.env.VITE_NLP_ENDPOINT || ''
  },
  
  // Firestore settings
  firestore: {
    enabled: import.meta.env.VITE_ENABLE_FIRESTORE === 'true',
    database: import.meta.env.VITE_FIRESTORE_DATABASE || '(default)'
  },
  
  // TTS settings
  tts: {
    enabled: import.meta.env.VITE_ENABLE_TTS === 'true',
    defaultVoice: 'en-US-Journey-F',
    speakingRate: 1.0
  }
};

export const OPENAI_CONFIG = {
  enabled: import.meta.env.VITE_ENABLE_OPENAI === 'true',
  model: 'gpt-4o-mini',
  maxTokens: 150,
  temperature: 0.7
};

export default {
  analyzeSentiment,
  detectRiskyContent,
  saveMoodEntry,
  saveAnonymousMessage,
  getSupportRoomMessages,
  generateSpeech,
  playGuidedMeditation,
  getMiloResponse,
  createAnonymousUserId,
  sanitizeUserInput,
  checkConsent,
  recordConsent,
  GOOGLE_CLOUD_CONFIG,
  OPENAI_CONFIG
};