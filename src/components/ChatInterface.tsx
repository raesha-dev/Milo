import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Camera, Plus, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { chatWithBot } from '@/lib/api';
import { createVoiceRecorder, VoiceRecorder } from '@/utils/voiceRecording.ts';
import { mockTranscription, SpeechToTextResult } from '@/lib/googleCloudSpeech';
import { useToast } from '@/hooks/use-toast';
import { getOrCreateUserId, loadUserData, saveUserData } from '@/lib/persistence';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'milo';
  timestamp: Date;
  mood?: string;
}

interface ChatInterfaceProps {
  messageColor: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ messageColor }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hi there! I'm Milo, your digital buddy 🌸 I'm here to listen, support, and grow with you. How are you feeling today?",
      sender: 'milo',
      timestamp: new Date()
    }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isSending, setIsSending] = useState(false);
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const voiceRecorderRef = useRef<VoiceRecorder | null>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load persisted chat history per anonymous user on mount
  useEffect(() => {
    try {
      const userId = getOrCreateUserId();
      const persisted = loadUserData<any[]>(userId, 'chat_messages');
      if (persisted && persisted.length) {
        // map timestamps back to Date
        const parsed = persisted.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
        setMessages((prev) => {
          // merge persisted with initial bootstrap message, preferring persisted order
          const existingIds = new Set(prev.map(p => p.id));
          const merged = parsed.concat(prev.filter(p => !existingIds.has(p.id)));
          return merged;
        });
      }
    } catch (err) {
      console.warn('Failed to load persisted chat', err);
    }
  }, []);

  // Persist messages on change (debounced-ish)
  useEffect(() => {
    try {
      const userId = getOrCreateUserId();
      // store lightweight serializable form
      const serializable = messages.map(m => ({ ...m, timestamp: m.timestamp.toISOString() }));
      saveUserData(userId, 'chat_messages', serializable);
    } catch (err) {
      console.warn('Failed to persist chat messages', err);
    }
  }, [messages]);

  const getMessageGradient = (color: string) => {
    const gradients: Record<string, string> = {
      pink: 'var(--gradient-pink)',
      ocean: 'var(--gradient-ocean)',
      sunset: 'var(--gradient-sunset)',
      forest: 'var(--gradient-forest)',
      lavender: 'var(--gradient-lavender)',
      rose: 'var(--gradient-rose)'
    };
    return gradients[color] || gradients.pink;
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: newMessage,
      sender: 'user',
      timestamp: new Date()
    };

    // optimistic add user message once
    setMessages((prev) => [...prev, userMessage]);
    setNewMessage('');
    setIsSending(true);

    // retry with exponential backoff for rate limits/network hiccups
    const maxRetries = 3;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const miloData = await chatWithBot(userMessage.text);

        const miloResponse: Message = {
          id: (Date.now() + 1 + attempt).toString(),
          text: miloData?.response || String(miloData),
          sender: 'milo',
          timestamp: new Date()
        };

        setMessages((prev) => [...prev, miloResponse]);
        break; // success
      } catch (err: any) {
        attempt += 1;

        // Inspect common indicators for rate-limit
        const status = err?.status || err?.response?.status;
        const message = (err && err.message) ? String(err.message).toLowerCase() : '';

        const isRateLimit = status === 429 || message.includes('rate') || message.includes('limit');

        if (isRateLimit && attempt <= maxRetries) {
          // exponential backoff
          const delay = 500 * Math.pow(2, attempt);
          await new Promise((res) => setTimeout(res, delay));
          continue;
        }

        // final failure
        const errorMessage: Message = {
          id: (Date.now() + 100 + attempt).toString(),
          text: "Sorry, Milo is having trouble responding right now.",
          sender: 'milo',
          timestamp: new Date()
        };
        setMessages((prev) => [...prev, errorMessage]);
        break;
      } finally {
        if (attempt > maxRetries) setIsSending(false);
      }
    }

    // ensure sending flag cleared
    setIsSending(false);
  };

  /**
   * Handle voice recording toggle
   * Starts or stops voice recording and processes the audio
   */
  const handleVoiceRecording = async () => {
    if (isRecording) {
      // Stop recording
      await stopVoiceRecording();
    } else {
      // Start recording
      await startVoiceRecording();
    }
  };

  /**
   * Start voice recording
   */
  const startVoiceRecording = async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser doesn't support voice input");
      }

      if (!voiceRecorderRef.current) {
        voiceRecorderRef.current = createVoiceRecorder();
      }

      await voiceRecorderRef.current.startRecording();
      setIsRecording(true);
      
      toast({
        title: "🎤 Recording started",
        description: "Speak now... Tap the microphone again to stop.",
      });
    } catch (error) {
      console.error('Error starting voice recording:', error);
      toast({
        title: "Microphone Error",
        description: error instanceof Error ? error.message : "Failed to access microphone",
        variant: "destructive",
      });
    }
  };

  /**
   * Stop voice recording and process the audio
   */
  const stopVoiceRecording = async () => {
    if (!voiceRecorderRef.current) return;

    try {
      setIsRecording(false);
      setIsProcessingVoice(true);

      // Stop recording and get audio blob
      const audioBlob = await voiceRecorderRef.current.stopRecording();

      toast({
        title: "🔄 Processing...",
        description: "Converting your voice to text...",
      });

      // Process audio with Google Cloud Speech-to-Text
      // For now, using mock transcription - replace with actual API call
      const transcription: SpeechToTextResult = await processVoiceToText(audioBlob);

      if (transcription.transcript) {
        // Set the transcribed text as the message
        setNewMessage(transcription.transcript);
        
        toast({
          title: "✅ Voice processed",
          description: `Confidence: ${Math.round(transcription.confidence * 100)}%`,
        });

        // Optionally, auto-send the message
        // Uncomment the following lines to auto-send:
        // setTimeout(() => {
        //   handleSendMessage();
        // }, 500);
      } else {
        throw new Error('No transcription received');
      }
    } catch (error) {
      console.error('Error processing voice:', error);
      toast({
        title: "Processing Error",
        description: "Failed to process voice input. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingVoice(false);
    }
  };

  /**
   * Process voice audio to text using Google Cloud Speech-to-Text
   * 
   * INTEGRATION POINT: Replace mockTranscription with actual Google Cloud API call
   * 
   * To integrate with Google Cloud:
   * 1. Set up a Lovable Cloud edge function to handle the API call
   * 2. Pass the audio data to the edge function
   * 3. The edge function calls Google Cloud Speech-to-Text API
   * 4. Return the transcription result
   * 
   * Example edge function call:
   * const response = await supabase.functions.invoke('google-cloud-speech', {
   *   body: { audioData: base64Audio }
   * });
   */
  const processVoiceToText = async (audioBlob: Blob): Promise<SpeechToTextResult> => {
    // Prepare audio payload for backend speech-to-text endpoint
    try {
      if (voiceRecorderRef.current) {
        const googleCloudData = await voiceRecorderRef.current.prepareForGoogleCloud(audioBlob);
        console.log('📤 Audio prepared for Google Cloud:', {
          audioSize: googleCloudData.content.length,
          config: googleCloudData.config
        });

        // POST to backend endpoint which will call Google Cloud Speech-to-Text securely
        const response = await fetch('/api/speech-to-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(googleCloudData)
        });

        if (response.ok) {
          const json = await response.json();
          // Expecting { transcript: string, confidence: number }
          return {
            transcript: json.transcript || '',
            confidence: typeof json.confidence === 'number' ? json.confidence : 0
          } as SpeechToTextResult;
        }
      }
    } catch (err) {
      console.warn('Speech-to-text backend failed:', err);
    }

    // Fallback: use mock transcription for demo/local
    return mockTranscription(audioBlob);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (voiceRecorderRef.current?.isRecording()) {
        voiceRecorderRef.current.cancelRecording();
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-white/10 backdrop-blur-sm">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                message.sender === 'user'
                  ? 'text-white shadow-lg'
                  : 'bg-white/90 text-gray-800 shadow-lg'
              }`}
              style={message.sender === 'user' ? { background: getMessageGradient(messageColor) } : {}}
            >
              <p className="text-sm whitespace-pre-wrap">{message.text}</p>
              <p className={`text-xs mt-1 ${
                message.sender === 'user' ? 'text-white/70' : 'text-gray-500'
              }`}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-2">
        <div className="flex space-x-2 mb-3">
          <Button
            size="sm"
            variant="secondary"
            className="text-xs bg-white/20 text-white border-white/30 hover:bg-white/30"
            onClick={() => setNewMessage("😊 I'm feeling good")}
            disabled={isSending}
          >
            😊 I'm feeling good
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="text-xs bg-white/20 text-white border-white/30 hover:bg-white/30"
            onClick={() => setNewMessage("😔 Having a tough day")}
            disabled={isSending}
          >
            😔 Having a tough day
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="text-xs bg-white/20 text-white border-white/30 hover:bg-white/30"
            onClick={() => setNewMessage("🤗 Need some support")}
            disabled={isSending}
          >
            🤗 Need some support
          </Button>
        </div>
      </div>

      {/* Message Input */}
      <div className="bg-cream border-t border-cream/20 p-4">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-cream-foreground hover:bg-cream-foreground/10"
            disabled={isSending}
          >
            <Plus className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-cream-foreground hover:bg-cream-foreground/10"
            disabled={isSending}
          >
            <Camera className="w-4 h-4" />
          </Button>
          <Input
            placeholder="Message Milo..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            className="flex-1 bg-white border-cream/30 text-cream-foreground placeholder:text-cream-foreground/50"
            disabled={isSending}
          />
          <Button
            variant="ghost"
            size="sm"
            className={`text-cream-foreground hover:bg-cream-foreground/10 transition-all ${
              isRecording ? 'bg-red-500/20 animate-pulse' : ''
            }`}
            onClick={handleVoiceRecording}
            disabled={isSending || isProcessingVoice}
            title={isRecording ? 'Stop recording' : 'Start voice input'}
          >
            {isRecording ? (
              <MicOff className="w-4 h-4 text-red-500" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </Button>
          <Button
            onClick={handleSendMessage}
            size="sm"
            className="text-white"
            style={{ background: getMessageGradient(messageColor) }}
            disabled={isSending || !newMessage.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
