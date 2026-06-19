// Application Constants and Configuration

export const APP_CONFIG = {
  name: 'Milo',
  tagline: 'Your Digital Buddy & Support Garden',
  description: 'A safe, Instagram-style mental health companion for young people featuring mood tracking, mindfulness exercises, and anonymous support communities.',
  version: '1.0.0',
  
  // Theme configuration
  themes: {
    default: 'light',
    storageKey: 'milo-theme'
  },
  
  // Message color options
  messageColors: {
    default: 'pink',
    storageKey: 'milo-message-color'
  },
  
  // Growth system
  growth: {
    pointsPerMood: 10,
    pointsPerCalm: 15,
    pointsForMilestone: 100,
    plantStagePoints: 25
  },
  
  // Privacy and safety
  privacy: {
    consentKey: 'milo_consent',
    consentDateKey: 'milo_consent_date',
    anonymousIdKey: 'milo_anonymous_id'
  }
};

export const MOOD_TYPES = {
  amazing: { emoji: '🤩', label: 'Amazing', points: 15 },
  happy: { emoji: '😊', label: 'Happy', points: 12 },
  okay: { emoji: '😐', label: 'Okay', points: 10 },
  sad: { emoji: '😔', label: 'Sad', points: 8 },
  anxious: { emoji: '😰', label: 'Anxious', points: 10 },
  angry: { emoji: '😠', label: 'Angry', points: 8 }
} as const;

export const CALM_EXERCISES = {
  'breathing-30s': {
    title: '30s Deep Breathing',
    duration: 30,
    points: 10,
    icon: '🫁'
  },
  'gratitude-60s': {
    title: '1min Gratitude',
    duration: 60,
    points: 15,
    icon: '🙏'
  },
  'mindfulness-3min': {
    title: '3min Body Scan',
    duration: 180,
    points: 25,
    icon: '🧘‍♀️'
  }
} as const;

export const SUPPORT_ROOMS = {
  daily: {
    name: 'Daily Check-ins',
    description: 'Share how you\'re feeling today in a safe space',
    icon: '🌅',
    theme: 'from-blue-400 to-purple-500'
  },
  student: {
    name: 'Student Support',
    description: 'Connect with others navigating school and study stress',
    icon: '📚',
    theme: 'from-green-400 to-blue-500'
  },
  anxiety: {
    name: 'Anxiety Garden',
    description: 'A gentle space for those dealing with worry and anxiety',
    icon: '🌸',
    theme: 'from-pink-400 to-purple-500'
  },
  gratitude: {
    name: 'Gratitude Circle',
    description: 'Share what you\'re grateful for and spread positivity',
    icon: '🙏',
    theme: 'from-yellow-400 to-orange-500'
  }
} as const;

export const CRISIS_RESOURCES = [
  {
    id: 'crisis',
    title: '🚨 Crisis Hotline',
    subtitle: 'Available 24/7',
    phone: '988',
    description: 'Immediate support for thoughts of self-harm or suicide',
    urgent: true
  },
  {
    id: 'text',
    title: '💬 Crisis Text Line',
    subtitle: 'Text support available',
    phone: 'Text HOME to 741741',
    description: 'Free, confidential support via text message',
    urgent: true
  },
  {
    id: 'teen',
    title: '🌟 Teen Line',
    subtitle: 'Peer support',
    phone: '1-800-852-8336',
    description: 'Teens helping teens through difficult times',
    urgent: false
  }
] as const;

export const ACHIEVEMENTS = [
  {
    id: 'first-steps',
    title: 'First Steps',
    description: 'Log your first mood',
    icon: '👶',
    maxProgress: 1,
    category: 'mood'
  },
  {
    id: 'consistent-tracker',
    title: 'Consistent Tracker',
    description: 'Log moods for 7 days',
    icon: '📅',
    maxProgress: 7,
    category: 'mood'
  },
  {
    id: 'calm-master',
    title: 'Calm Master',
    description: 'Complete 10 calm sessions',
    icon: '🧘‍♀️',
    maxProgress: 10,
    category: 'calm'
  },
  {
    id: 'garden-keeper',
    title: 'Garden Keeper',
    description: 'Reach 200 growth points',
    icon: '🌻',
    maxProgress: 200,
    category: 'growth'
  },
  {
    id: 'supportive-friend',
    title: 'Supportive Friend',
    description: 'Send 25 hearts in support rooms',
    icon: '💝',
    maxProgress: 25,
    category: 'community'
  }
] as const;

// Risk detection keywords (placeholder for Google Cloud NLP)
export const RISK_KEYWORDS = [
  'hurt myself',
  'want to die',
  'end it all',
  'no hope',
  'suicide',
  'self harm',
  'kill myself',
  'better off dead'
] as const;

// SEO and Meta Information
export const SEO_CONFIG = {
  title: 'Milo - Your Digital Buddy & Support Garden',
  description: 'A safe, Instagram-style mental health companion for young people. Track moods, practice mindfulness, and connect with supportive communities anonymously.',
  keywords: [
    'mental health',
    'youth wellness',
    'mood tracking',
    'mindfulness',
    'anxiety support',
    'digital wellbeing',
    'peer support',
    'emotional wellness',
    'student mental health',
    'teen support'
  ],
  author: 'Milo Team',
  image: '/milo-og-image.png', // TODO: Generate this image
  url: 'https://yourdomain.com', // Update with actual domain
  twitterCard: 'summary_large_image'
};

export default {
  APP_CONFIG,
  MOOD_TYPES,
  CALM_EXERCISES,
  SUPPORT_ROOMS,
  CRISIS_RESOURCES,
  ACHIEVEMENTS,
  RISK_KEYWORDS,
  SEO_CONFIG
};