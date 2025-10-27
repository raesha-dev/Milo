import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Send } from 'lucide-react';
import { 
  Users, Heart, MessageCircle, Shield, Hash, 
  Search, UserPlus, Settings, ChevronDown,
  MoreVertical, Plus, Bell, BellOff, Palette
} from 'lucide-react';
import { toast } from 'sonner';
import { getOrCreateUserId, loadUserData, saveUserData, appendUserArray } from '@/lib/persistence';
import { 
  saveAnonymousMessage, 
  createAnonymousUserId,
  sanitizeUserInput,
  type AnonymousMessage as CloudMessage
} from '@/services/googleCloud';

interface SupportRoom {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  icon: string;
  theme: string;
  recentMoods: { mood: string; count: number; emoji: string }[];
}

interface AnonymousMessage {
  id: string;
  message: string;
  mood: string;
  timestamp: Date;
  hearts: number;
  likedBy: string[]; // Track user IDs who liked this message
}

interface FriendSuggestion {
  id: string;
  username: string;
  avatar: string;
  status: 'online' | 'idle' | 'offline';
  commonRooms: number;
  bio: string;
  interests: string[];
  favoriteAnime?: string;
  mood?: string;
}

// Backend API base URL (configurable via env)
const API_ROOT = import.meta.env.VITE_BACKEND_API || "http://localhost:8080/api";

// use central getOrCreateUserId from persistence helper

// Fetch support rooms data from backend Firestore collection
async function fetchSupportRooms(): Promise<SupportRoom[]> {
  return [
    {
      id: '1',
      name: 'Daily Check-ins',
      description: "Share how you're feeling today in a safe space",
      memberCount: 247,
      icon: '🌅',
      theme: 'from-blue-400 to-purple-500',
      recentMoods: [
        { mood: 'okay', count: 12, emoji: '😐' },
        { mood: 'anxious', count: 8, emoji: '😰' },
        { mood: 'happy', count: 15, emoji: '😊' },
      ],
    },
    {
      id: '2',
      name: 'Student Support',
      description: 'Connect with others navigating school and study stress',
      memberCount: 189,
      icon: '📚',
      theme: 'from-green-400 to-blue-500',
      recentMoods: [
        { mood: 'stressed', count: 18, emoji: '😤' },
        { mood: 'determined', count: 9, emoji: '💪' },
        { mood: 'tired', count: 11, emoji: '😴' },
      ],
    },
    {
      id: '3',
      name: 'Anxiety Garden',
      description: 'A gentle space for those dealing with worry and anxiety',
      memberCount: 156,
      icon: '🌸',
      theme: 'from-pink-400 to-purple-500',
      recentMoods: [
        { mood: 'anxious', count: 14, emoji: '😰' },
        { mood: 'relaxed', count: 7, emoji: '🫁' },
        { mood: 'hopeful', count: 6, emoji: '🌈' },
      ],
    },
    {
      id: '4',
      name: 'Gratitude Circle',
      description: "Share what you're grateful for and spread positivity",
      memberCount: 203,
      icon: '🙏',
      theme: 'from-yellow-400 to-orange-500',
      recentMoods: [
        { mood: 'grateful', count: 22, emoji: '🙏' },
        { mood: 'blessed', count: 11, emoji: '✨' },
        { mood: 'content', count: 9, emoji: '😌' },
      ],
    },
  ];
}

// Fetch anonymous messages for a given room from backend Firestore collection
async function fetchMessages(roomId: string): Promise<AnonymousMessage[]> {
  try {
    const res = await fetch(`${API_ROOT}/anonymousMessages?roomId=${roomId}`, {
      method: 'GET',
    });
    if (!res.ok) throw new Error('Failed to fetch messages');
    const data = await res.json();
    return data.map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
      likedBy: msg.likedBy || [],
    }));
  } catch {
    // Fallback to mock data for demo
    return generateMockMessages(roomId);
  }
}

// Generate mock messages based on room theme
function generateMockMessages(roomId: string): AnonymousMessage[] {
  const messagesByRoom: Record<string, AnonymousMessage[]> = {
    '1': [
      {
        id: 'msg-1-1',
        message: "Today was tough but I'm grateful I made it through. One day at a time 💪",
        mood: 'hopeful',
        timestamp: new Date(Date.now() - 1000 * 60 * 15),
        hearts: 24,
        likedBy: []
      },
      {
        id: 'msg-1-2',
        message: "Feeling anxious about tomorrow but trying to stay present. This community helps so much ❤️",
        mood: 'anxious',
        timestamp: new Date(Date.now() - 1000 * 60 * 45),
        hearts: 18,
        likedBy: []
      },
      {
        id: 'msg-1-3',
        message: "Small win today - I actually left my room and took a walk! Baby steps count 🌈",
        mood: 'proud',
        timestamp: new Date(Date.now() - 1000 * 60 * 120),
        hearts: 31,
        likedBy: []
      }
    ],
    '2': [
      {
        id: 'msg-2-1',
        message: "Finals week is killing me but at least I'm not alone in this struggle 📚😭",
        mood: 'stressed',
        timestamp: new Date(Date.now() - 1000 * 60 * 20),
        hearts: 45,
        likedBy: []
      },
      {
        id: 'msg-2-2',
        message: "Just finished my essay! Feeling so relieved. You all can do this too! 💪✨",
        mood: 'accomplished',
        timestamp: new Date(Date.now() - 1000 * 60 * 60),
        hearts: 28,
        likedBy: []
      },
      {
        id: 'msg-2-3',
        message: "Study group on Discord tonight really helped. Sometimes we just need to vent and study together 📖",
        mood: 'grateful',
        timestamp: new Date(Date.now() - 1000 * 60 * 180),
        hearts: 22,
        likedBy: []
      }
    ],
    '3': [
      {
        id: 'msg-3-1',
        message: "Tried the breathing exercise someone shared last week. It actually helped during my panic attack today 🫁",
        mood: 'relieved',
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        hearts: 36,
        likedBy: []
      },
      {
        id: 'msg-3-2',
        message: "Some days feel impossible but then I remember this safe space exists. Thank you all 💜",
        mood: 'anxious',
        timestamp: new Date(Date.now() - 1000 * 60 * 90),
        hearts: 41,
        likedBy: []
      },
      {
        id: 'msg-3-3',
        message: "Watching Ghibli films and petting my cat. Finding peace in small moments 🌸",
        mood: 'peaceful',
        timestamp: new Date(Date.now() - 1000 * 60 * 150),
        hearts: 29,
        likedBy: []
      }
    ],
    '4': [
      {
        id: 'msg-4-1',
        message: "Grateful for morning coffee, good music, and this supportive community ☕🎵",
        mood: 'grateful',
        timestamp: new Date(Date.now() - 1000 * 60 * 25),
        hearts: 33,
        likedBy: []
      },
      {
        id: 'msg-4-2',
        message: "Today I'm thankful for: sunshine, my best friend's text, and finishing my anime series! 🌞",
        mood: 'happy',
        timestamp: new Date(Date.now() - 1000 * 60 * 75),
        hearts: 27,
        likedBy: []
      },
      {
        id: 'msg-4-3',
        message: "Grateful I found this space where I can be real. You all are amazing souls ✨🙏",
        mood: 'blessed',
        timestamp: new Date(Date.now() - 1000 * 60 * 200),
        hearts: 39,
        likedBy: []
      }
    ]
  };

  return messagesByRoom[roomId] || [];
}

// Send "heart" increment action to backend
async function sendHeart(messageId: string, userId: string) {
  try {
    await fetch(`${API_ROOT}/anonymousMessages/${messageId}/heart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });
  } catch (error) {
    console.error('Error sending heart:', error);
  }
}

// Mock friend suggestions (integrate with real API later)
function generateFriendSuggestions(): FriendSuggestion[] {
  return [
    {
      id: 'friend-1',
      username: 'Luna',
      avatar: '🌙',
      status: 'online',
      commonRooms: 2,
      bio: "Night owl who loves stargazing and lo-fi beats. Here to support and be supported 💜",
      interests: ['Anime', 'Art', 'Music', 'Night walks'],
      favoriteAnime: 'Your Name',
      mood: 'Peaceful tonight'
    },
    {
      id: 'friend-2',
      username: 'Alex',
      avatar: '⭐',
      status: 'online',
      commonRooms: 1,
      bio: "Gamer & anime enthusiast. Always down to chat about JRPGs or share memes 🎮",
      interests: ['Gaming', 'Anime', 'Manga', 'Coding'],
      favoriteAnime: 'Attack on Titan',
      mood: 'Grinding today!'
    },
    {
      id: 'friend-3',
      username: 'Sakura',
      avatar: '🌸',
      status: 'online',
      commonRooms: 3,
      bio: "Art student & shoujo manga lover. Let's talk about feelings and creative stuff! 🎨",
      interests: ['Drawing', 'Anime', 'K-pop', 'Fashion'],
      favoriteAnime: 'Fruits Basket',
      mood: 'Drawing vibes'
    },
    {
      id: 'friend-4',
      username: 'Jordan',
      avatar: '🦋',
      status: 'idle',
      commonRooms: 2,
      bio: "Psychology student who loves slice-of-life anime. Here to listen and share 🦋",
      interests: ['Anime', 'Books', 'Psychology', 'Coffee'],
      favoriteAnime: 'March Comes in Like a Lion',
      mood: 'Studying mode'
    },
    {
      id: 'friend-5',
      username: 'Casey',
      avatar: '🌈',
      status: 'online',
      commonRooms: 1,
      bio: "Proud otaku & cosplay enthusiast! Life is better with friends and good anime 🌈✨",
      interests: ['Cosplay', 'Anime', 'Photography', 'Conventions'],
      favoriteAnime: 'My Hero Academia',
      mood: 'Convention hype!'
    },
    {
      id: 'friend-6',
      username: 'Riley',
      avatar: '✨',
      status: 'idle',
      commonRooms: 2,
      bio: "Aspiring writer & fantasy anime fan. Let's share stories and support each other! 📖",
      interests: ['Writing', 'Anime', 'Fantasy', 'Reading'],
      favoriteAnime: 'Fullmetal Alchemist',
      mood: 'Writing chapter 5'
    },
    {
      id: 'friend-7',
      username: 'Morgan',
      avatar: '🌺',
      status: 'offline',
      commonRooms: 1,
      bio: "Music lover & Ghibli enthusiast. Finding peace through art and animation 🎵",
      interests: ['Music', 'Ghibli films', 'Cooking', 'Nature'],
      favoriteAnime: 'Howl\'s Moving Castle',
      mood: 'Offline - back soon!'
    },
    {
      id: 'friend-8',
      username: 'Avery',
      avatar: '🎨',
      status: 'offline',
      commonRooms: 3,
      bio: "Digital artist obsessed with anime aesthetics. Always creating something new! 🖌️",
      interests: ['Digital Art', 'Anime', 'Character Design', 'Illustration'],
      favoriteAnime: 'Violet Evergarden',
      mood: 'Creating magic ✨'
    },
  ];
}

type BackgroundTheme = 'violet' | 'rose' | 'mint' | 'peach' | 'sky' | 'lavender' | 'sage' | 'pearl';

export const SupportRooms: React.FC = () => {
  const [selectedRoom, setSelectedRoom] = useState<SupportRoom | null>(null);
  const [supportRooms, setSupportRooms] = useState<SupportRoom[]>([]);
  const [messages, setMessages] = useState<AnonymousMessage[]>([]);
  const [friendSuggestions] = useState<FriendSuggestion[]>(generateFriendSuggestions());
  const [showFindFriends, setShowFindFriends] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [backgroundTheme, setBackgroundTheme] = useState<BackgroundTheme>(() => {
    return (localStorage.getItem('bg-theme') as BackgroundTheme) || 'violet';
  });
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showCommunityPulse, setShowCommunityPulse] = useState(true);
  
  // NEW: Message input state
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  // NEW: Notification preference (stored in localStorage)
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem('milo-notifications-enabled');
    return saved !== null ? saved === 'true' : true; // Default: enabled
  });
  
  // Get current user ID
  const userId = getOrCreateUserId();

  // message refs for deterministic ordering and offline queue
  const messageRefs = useRef<Map<string, AnonymousMessage>>(new Map<string, AnonymousMessage>());
  const offlineQueue = useRef<AnonymousMessage[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  const themeOptions: { value: BackgroundTheme; label: string; color: string }[] = [
    { value: 'violet', label: '💜 Violet Dream', color: 'bg-gradient-to-br from-purple-200 to-violet-100' },
    { value: 'rose', label: '🌹 Rose Garden', color: 'bg-gradient-to-br from-rose-200 to-pink-100' },
    { value: 'mint', label: '🌿 Fresh Mint', color: 'bg-gradient-to-br from-emerald-200 to-teal-100' },
    { value: 'peach', label: '🍑 Peachy Keen', color: 'bg-gradient-to-br from-orange-200 to-amber-100' },
    { value: 'sky', label: '☁️ Sky Blue', color: 'bg-gradient-to-br from-sky-200 to-blue-100' },
    { value: 'lavender', label: '💐 Lavender Fields', color: 'bg-gradient-to-br from-purple-300 to-violet-100' },
    { value: 'sage', label: '🌾 Sage Green', color: 'bg-gradient-to-br from-green-200 to-lime-100' },
    { value: 'pearl', label: '🤍 Pearl White', color: 'bg-gradient-to-br from-gray-100 to-slate-50' },
  ];

  useEffect(() => {
    localStorage.setItem('bg-theme', backgroundTheme);
    document.body.className = `theme-${backgroundTheme}`;
  }, [backgroundTheme]);

  useEffect(() => {
    (async () => {
      const rooms = await fetchSupportRooms();
      setSupportRooms(rooms);
      if (rooms.length > 0) {
        setSelectedRoom(rooms[0]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedRoom) {
      setMessages([]);
      return;
    }
    (async () => {
      const msgs = await fetchMessages(selectedRoom.id);
      // populate refs and set ordered messages
  messageRefs.current.clear();
  msgs.forEach((m: AnonymousMessage) => messageRefs.current.set(m.id, m));
  const vals = Array.from(messageRefs.current.values());
  const sorted = (vals as AnonymousMessage[]).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  // merge with any locally persisted room messages for this user
  try {
    const persisted = loadUserData<AnonymousMessage[]>(userId, `room_${selectedRoom.id}_messages`);
    if (persisted && persisted.length) {
      const parsed = persisted.map(p => ({ ...p, timestamp: new Date(p.timestamp) }));
      // merge and dedupe by id, prefer persisted (more recent local) then backend
      const map = new Map<string, AnonymousMessage>();
      parsed.forEach(p => map.set(p.id, p));
      sorted.forEach(s => { if (!map.has(s.id)) map.set(s.id, s); });
      const merged = Array.from(map.values()).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      messageRefs.current.clear();
      merged.forEach((m) => messageRefs.current.set(m.id, m));
      setMessages(merged);
    } else {
      setMessages(sorted);
    }
  } catch (e) {
    console.warn('Failed to merge persisted room messages', e);
    setMessages(sorted);
  }
    })();
  }, [selectedRoom]);

  // Persist messages per-room for this user whenever messages change
  useEffect(() => {
    try {
      if (!selectedRoom) return;
      // store serializable form
      const serializable = messages.map(m => ({ ...m, timestamp: m.timestamp.toISOString() }));
      saveUserData(userId, `room_${selectedRoom.id}_messages`, serializable);
    } catch (err) {
      console.warn('Failed to persist room messages', err);
    }
  }, [messages, selectedRoom, userId]);

  // NEW: Handle sending a message
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedRoom || isSending) return;
    
    setIsSending(true);
    
    try {
      // Sanitize input
      const sanitizedMessage = sanitizeUserInput(messageInput);
      
      // Create new message
      const newMessage: AnonymousMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message: sanitizedMessage,
        mood: 'hopeful', // Default mood, can be made dynamic
        timestamp: new Date(),
        hearts: 0,
        likedBy: []
      };
      
      // Add message to state immediately (optimistic update)
      // store in refs for deterministic order
      messageRefs.current.set(newMessage.id, newMessage);
      setMessages(prev => [newMessage, ...prev]);
      
      // Clear input field immediately
      setMessageInput('');
      
      // Save to backend/Firestore
      const cloudMessage: CloudMessage = {
        roomId: selectedRoom.id,
        message: sanitizedMessage,
        mood: newMessage.mood,
        timestamp: newMessage.timestamp,
        hearts: 0
      };
      
      // send message (handles offline queuing)
      await sendMessage(newMessage, cloudMessage);
      
      if (notificationsEnabled) {
        toast.success('Message sent! 💜', {
          description: 'Your message has been shared with the community',
        });
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message', {
        description: 'Please try again',
      });
      // Remove the optimistic message on error
      messageRefs.current.delete(messages[0]?.id || '');
      setMessages(prev => prev.slice(1));
    } finally {
      setIsSending(false);
    }
  };

  // sendMessage wrapper handles offline queueing and backend save
  const sendMessage = async (local: AnonymousMessage, cloudMessage: CloudMessage) => {
    if (!navigator.onLine) {
      offlineQueue.current.push(local);
      localStorage.setItem('offline_room_queue', JSON.stringify(offlineQueue.current));
      toast.success('Offline', { description: 'Message queued and will be sent when online.' });
      // persist queued message to user's room history
      try { appendUserArray(userId, `room_${selectedRoom?.id}_messages`, { ...local, timestamp: local.timestamp.toISOString() }, 1000); } catch (e) { /* ignore */ }
      return;
    }

    try {
      await saveAnonymousMessage(cloudMessage);
      // on success, ensure messageRefs is up to date (backend may have canonical id)
      try { appendUserArray(userId, `room_${selectedRoom?.id}_messages`, { ...local, timestamp: local.timestamp.toISOString() }, 1000); } catch (e) { /* ignore */ }
    } catch (err) {
      console.error('Error saving to backend, queueing locally', err);
      offlineQueue.current.push(local);
      localStorage.setItem('offline_room_queue', JSON.stringify(offlineQueue.current));
    }
  };

  // automatically try to flush offline queue when back online
  useEffect(() => {
    const flush = async () => {
      setIsOnline(navigator.onLine);
      if (!navigator.onLine) return;
      const raw = localStorage.getItem('offline_room_queue');
      const queued: AnonymousMessage[] = raw ? JSON.parse(raw) : [];
      if (queued.length === 0) return;
      for (const q of queued) {
        try {
          await saveAnonymousMessage({ roomId: selectedRoom?.id || '', message: q.message, mood: q.mood, timestamp: q.timestamp, hearts: q.hearts });
        } catch (e) {
          console.warn('Failed to flush queued message', e);
        }
      }
      localStorage.removeItem('offline_room_queue');
      offlineQueue.current = [];
    };

    window.addEventListener('online', flush);
    if (navigator.onLine) flush();
    return () => window.removeEventListener('online', flush);
  }, [selectedRoom]);

  // NEW: Handle heart/like with toggle (Like/Unlike)
  const handleSendHeart = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    
    if (!message) return;
    
    // Check if user already liked this message
    const userHasLiked = message.likedBy.includes(userId);
    
    if (userHasLiked) {
      // Unlike: Remove user from likedBy array and decrease heart count
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId 
            ? { 
                ...msg, 
                hearts: Math.max(0, msg.hearts - 1), // Prevent negative hearts
                likedBy: msg.likedBy.filter(id => id !== userId)
              } 
            : msg
        )
      );
      
      // Send unlike to backend
      sendHeart(messageId, userId);
      
      if (notificationsEnabled) {
        toast.info('Like removed 💙', {
          description: 'Click again to like',
        });
      }
    } else {
      // Like: Add user to likedBy array and increase heart count
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId 
            ? { 
                ...msg, 
                hearts: msg.hearts + 1,
                likedBy: [...msg.likedBy, userId]
              } 
            : msg
        )
      );
      
      // Send like to backend
      sendHeart(messageId, userId);
      
      if (notificationsEnabled) {
        toast.success('Liked! ❤️', {
          description: 'Click again to unlike',
        });
      }
    }
  };
  
  // NEW: Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // NEW: Toggle notifications
  const toggleNotifications = (checked: boolean) => {
    setNotificationsEnabled(checked);
    localStorage.setItem('milo-notifications-enabled', String(checked));
    if (checked) {
      toast.success('Notifications enabled 🔔');
    } else {
      toast.info('Notifications disabled 🔕');
    }
  };

  const getStatusColor = (status: 'online' | 'idle' | 'offline') => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'idle': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-400';
    }
  };

  const filteredFriends = friendSuggestions.filter(friend =>
    friend.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.interests.some(interest => interest.toLowerCase().includes(searchQuery.toLowerCase())) ||
    friend.bio.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (friend.favoriteAnime && friend.favoriteAnime.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex h-full bg-background">
      {/* Server Sidebar - Discord Style */}
      <div className="w-20 bg-sidebar flex flex-col items-center py-4 space-y-3">
        {/* Home/Main Server Icon */}
        <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-2xl cursor-pointer hover:rounded-xl transition-all duration-200 shadow-lg">
          🏠
        </div>
        
        <div className="w-10 h-0.5 bg-sidebar-border rounded-full" />
        
        {/* Room Icons */}
        <ScrollArea className="flex-1 w-full">
          <div className="flex flex-col items-center space-y-3 px-3">
            {supportRooms.map((room) => (
              <div
                key={room.id}
                onClick={() => setSelectedRoom(room)}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl cursor-pointer transition-all duration-200 hover:rounded-xl ${
                  selectedRoom?.id === room.id
                    ? 'bg-primary rounded-xl shadow-lg'
                    : 'bg-sidebar-accent hover:bg-sidebar-accent-foreground/10'
                }`}
              >
                {room.icon}
              </div>
            ))}
            
            {/* Add Server Button */}
            <div className="w-14 h-14 bg-sidebar-accent rounded-2xl flex items-center justify-center cursor-pointer hover:rounded-xl hover:bg-green-600 transition-all duration-200 text-green-400 hover:text-white">
              <Plus className="w-6 h-6" />
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-16 border-b border-border bg-card px-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3">
            <Hash className="w-6 h-6 text-muted-foreground" />
            <span className="font-semibold text-lg">{selectedRoom?.name || 'Support Rooms'}</span>
            {selectedRoom && (
              <Badge variant="secondary" className="ml-2">
                {selectedRoom.memberCount} members
              </Badge>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Toggle button to hide/show the Community Pulse bar */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowCommunityPulse(!showCommunityPulse)}
              title={showCommunityPulse ? 'Hide Community Pulse' : 'Show Community Pulse'}
            >
              {showCommunityPulse ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </Button>

            <div className="relative">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setShowThemePicker(!showThemePicker)}
              >
                <Palette className="w-5 h-5" />
              </Button>
              
              {showThemePicker && (
                <Card className="absolute top-12 right-0 w-64 z-50 shadow-xl">
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-3">Choose Your Vibe</h3>
                    <div className="space-y-2">
                      {themeOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setBackgroundTheme(option.value);
                            setShowThemePicker(false);
                          }}
                          className={`w-full flex items-center space-x-3 p-2 rounded-lg transition-all ${
                            backgroundTheme === option.value
                              ? 'bg-primary/10 border-2 border-primary'
                              : 'hover:bg-accent'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-lg ${option.color}`} />
                          <span className="text-sm">{option.label}</span>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
            
            {/* Notification Toggle */}
            <div className="flex items-center gap-2 px-2">
              <Label htmlFor="notifications" className="cursor-pointer">
                {notificationsEnabled ? (
                  <Bell className="w-5 h-5 text-primary" />
                ) : (
                  <BellOff className="w-5 h-5 text-muted-foreground" />
                )}
              </Label>
              <Switch
                id="notifications"
                checked={notificationsEnabled}
                onCheckedChange={toggleNotifications}
              />
            </div>
            
            <Button variant="ghost" size="icon"><Search className="w-5 h-5" /></Button>
            <Button variant="ghost" size="icon"><Users className="w-5 h-5" /></Button>
          </div>
        </div>

        {/* Channel Description & Community Pulse */}
        {selectedRoom && (
          <div className="bg-card border-b border-border px-6 py-4">
            <div className="max-w-4xl">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <Shield className="w-5 h-5 text-primary" />
                  <p className="text-sm text-muted-foreground">{selectedRoom.description}</p>
                </div>
              </div>
              
              {/* Conditionally render Community Pulse card */}
              {showCommunityPulse && (
                <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-primary flex items-center">
                        <Users className="w-3.5 h-3.5 mr-1.5" />
                        Today's Community Pulse
                      </h4>
                      <Badge variant="secondary" className="text-xs">
                        Live Analysis
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedRoom.recentMoods.map((mood, idx) => (
                        <div key={idx} className="flex items-center space-x-1.5 bg-background/60 px-2.5 py-1 rounded-full">
                          <span className="text-sm">{mood.emoji}</span>
                          <span className="text-xs font-medium">{mood.count} people</span>
                          <span className="text-xs text-muted-foreground">feeling {mood.mood}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      💜 You're not alone - {selectedRoom.memberCount} members are here with you
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Messages Area */}
        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-4 max-w-4xl">
            {messages.map((message) => {
              const userHasLiked = message.likedBy.includes(userId);
              
              return (
                <Card key={message.id} className="hover:shadow-md transition-shadow border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      {/* Instagram-style Avatar with Story Ring */}
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-400 via-purple-500 to-indigo-500 p-0.5">
                          <div className="w-full h-full rounded-full bg-card flex items-center justify-center text-lg">
                            😊
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-semibold text-sm">Anonymous</span>
                          <Badge variant="outline" className="text-xs">
                            {message.mood}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {getTimeAgo(message.timestamp)}
                          </span>
                        </div>
                        
                        <p className="text-sm mb-2">{message.message}</p>
                        
                        <div className="flex items-center space-x-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSendHeart(message.id)}
                            className={`-ml-2 transition-all ${
                              userHasLiked 
                                ? 'text-red-500 hover:text-red-400 hover:bg-red-50/50' 
                                : 'text-muted-foreground hover:text-red-500 hover:bg-red-50/50'
                            }`}
                            title={userHasLiked ? 'Click to unlike' : 'Click to like'}
                          >
                            <Heart className={`w-4 h-4 mr-1 ${userHasLiked ? 'fill-current' : ''}`} />
                            {message.hearts}
                          </Button>
                          
                          <Button variant="ghost" size="sm" className="-ml-2">
                            <MessageCircle className="w-4 h-4 mr-1" />
                            Reply
                          </Button>
                        </div>
                      </div>
                      
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">💬</div>
                <h3 className="font-semibold text-lg mb-2">No messages yet</h3>
                <p className="text-sm text-muted-foreground">
                  Be the first to share in this room!
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Message Input */}
        <div className="border-t border-border bg-card px-6 py-4">
          <div className="max-w-4xl space-y-3">
            
            {/* Main Input */}
            <div className="flex items-center space-x-2 bg-muted/30 rounded-lg px-4 py-3">
              <Plus className="w-5 h-5 text-muted-foreground cursor-pointer hover:text-foreground" />
              <Input
                placeholder={`Share something in #${selectedRoom?.name || 'room'}...`}
                className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isSending}
              />
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  😊
                </Button>
                <Button 
                  size="sm" 
                  className="bg-primary hover:bg-primary/90"
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || isSending}
                >
                  <Send className="w-4 h-4 mr-1" />
                  Send
                </Button>
              </div>
            </div>
            
            <div className="flex items-center justify-between px-1">
              <p className="text-xs text-muted-foreground">
                💜 Anonymous & safe - share openly
              </p>
              <p className="text-xs text-muted-foreground">
                Talk to {selectedRoom?.memberCount || 0} people here
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Members & Find Friends */}
      <div className="w-64 border-l border-border bg-card flex flex-col">
        {/* Tab Header */}
        <div className="h-16 border-b border-border px-4 flex items-center justify-between">
          <Button
            variant={!showFindFriends ? "default" : "ghost"}
            size="sm"
            onClick={() => setShowFindFriends(false)}
            className="flex-1 mr-1"
          >
            <Users className="w-4 h-4 mr-1" />
            Members
          </Button>
          <Button
            variant={showFindFriends ? "default" : "ghost"}
            size="sm"
            onClick={() => setShowFindFriends(true)}
            className="flex-1 ml-1"
          >
            <UserPlus className="w-4 h-4 mr-1" />
            Find
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          {!showFindFriends ? (
            /* Members List */
            <div className="p-4 space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                  Online — {friendSuggestions.filter(f => f.status === 'online').length}
                </h3>
                <div className="space-y-1">
                  {friendSuggestions
                    .filter(f => f.status === 'online')
                    .map((friend) => (
                      <div
                        key={friend.id}
                        className="flex items-center space-x-3 px-2 py-1.5 rounded hover:bg-accent/50 cursor-pointer group"
                      >
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center text-sm">
                            {friend.avatar}
                          </div>
                          <div className={`absolute bottom-0 right-0 w-3 h-3 ${getStatusColor(friend.status)} rounded-full border-2 border-card`} />
                        </div>
                        <span className="text-sm font-medium">{friend.username}</span>
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                  Offline — {friendSuggestions.filter(f => f.status !== 'online').length}
                </h3>
                <div className="space-y-1">
                  {friendSuggestions
                    .filter(f => f.status !== 'online')
                    .map((friend) => (
                      <div
                        key={friend.id}
                        className="flex items-center space-x-3 px-2 py-1.5 rounded hover:bg-accent/50 cursor-pointer opacity-60 hover:opacity-100"
                      >
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm">
                            {friend.avatar}
                          </div>
                          <div className={`absolute bottom-0 right-0 w-3 h-3 ${getStatusColor(friend.status)} rounded-full border-2 border-card`} />
                        </div>
                        <span className="text-sm">{friend.username}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            /* Find Friends */
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Discover Friends</h3>
                <p className="text-xs text-muted-foreground">
                  Connect with awesome people who share your interests! 🌟
                </p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or interests..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="space-y-3 pr-2">
                  {filteredFriends.map((friend) => (
                    <Card key={friend.id} className="hover:shadow-md transition-all border-2 hover:border-primary/30">
                      <CardContent className="p-4">
                        {/* Header with avatar and status */}
                        <div className="flex items-start space-x-3 mb-3">
                          <div className="relative flex-shrink-0">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-400 via-purple-400 to-pink-400 p-0.5">
                              <div className="w-full h-full rounded-full bg-card flex items-center justify-center text-xl">
                                {friend.avatar}
                              </div>
                            </div>
                            <div className={`absolute bottom-0 right-0 w-4 h-4 ${getStatusColor(friend.status)} rounded-full border-2 border-card shadow-sm`} />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-bold text-base truncate">{friend.username}</h4>
                              <Badge variant="secondary" className="text-xs shrink-0">
                                {friend.commonRooms} room{friend.commonRooms !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                            {friend.mood && (
                              <p className="text-xs text-muted-foreground italic">
                                {friend.mood}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Bio */}
                        <p className="text-sm text-foreground/90 mb-3 leading-relaxed">
                          {friend.bio}
                        </p>

                        {/* Favorite Anime */}
                        {friend.favoriteAnime && (
                          <div className="mb-3 p-2 rounded-lg bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/10">
                            <p className="text-xs font-medium text-primary">
                              ⭐ Fave Anime: {friend.favoriteAnime}
                            </p>
                          </div>
                        )}

                        {/* Interests */}
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-muted-foreground mb-2">
                            Interests
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {friend.interests.map((interest, idx) => (
                              <Badge 
                                key={idx} 
                                variant="outline" 
                                className="text-xs bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950 border-violet-200 dark:border-violet-800"
                              >
                                {interest}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Action Button */}
                        <Button 
                          size="sm" 
                          className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity shadow-md"
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Connect & Chat
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>

              {filteredFriends.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-3">🔍</div>
                  <h4 className="font-semibold mb-1">No matches found</h4>
                  <p className="text-sm text-muted-foreground">
                    Try different search terms!
                  </p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};

function getTimeAgo(timestamp: Date) {
  const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / (1000 * 60));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
