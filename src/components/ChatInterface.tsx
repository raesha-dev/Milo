import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Camera, Plus, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { chatWithBot } from '@/lib/api';
import { createVoiceRecorder, VoiceRecorder } from '@/utils/voiceRecording.ts';
import { mockTranscription, SpeechToTextResult } from '@/lib/googleCloudSpeech';
import { useToast } from '@/hooks/use-toast';
import { getOrCreateUserId, loadUserData, saveUserData } from '@/lib/persistence';
import { AlertConfirmationModal } from './AlertConfirmationModal';
import { getEmergencySettings } from './EmergencyAlertSettings';
import { sendEmergencyAlert } from '@/lib/alertService';
import type { AlertRequest } from '@/lib/alertService';

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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isSending, setIsSending] = useState(false);
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const voiceRecorderRef = useRef<VoiceRecorder | null>(null);
  const { toast } = useToast();
  // Modal / pending alert state
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingAlert, setPendingAlert] = useState<AlertRequest | null>(null);

  const handleConfirmAlert = async () => {
    if (!pendingAlert) return;
    try {
      // Try server-side emergency endpoint first (safe: will require backend permissions)
      try {
        const response = await fetch('/api/emergency-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pendingAlert),
        });

        if (response.ok) {
          const json = await response.json();
          const alertId = json?.alertId || json?.id || 'unknown';
          toast({
            title: 'Alert created (server)',
            description: `Alert ${alertId} queued on server.`,
          });
          setModalOpen(false);
          setPendingAlert(null);
          return;
        }
        // Non-ok response falls through to fallback below
      } catch (networkErr) {
        console.warn('Server emergency endpoint failed, falling back to local mock', networkErr);
      }

      // Fallback to local mock alert service (offline / demo-safe)
      const res = await sendEmergencyAlert(pendingAlert);
      toast({
        title: 'Alert queued (local)',
        description: `Alert ${res.alertId} created (${res.status})`,
      });
    } catch (err: any) {
      toast({
        title: 'Failed to send alert',
        description: err?.message || String(err),
        variant: 'destructive',
      });
    } finally {
      setModalOpen(false);
      setPendingAlert(null);
    }
  };

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

        // If backend signaled immediate risk, prompt user for confirmation
        try {
          const risk = miloData?.riskAssessment;
          if (risk && risk.requiresImmediate) {
            // Build a helpful message for the alert modal including reasons if available
            const reasons = Array.isArray(risk.reasons) ? risk.reasons.join('; ') : risk.reasons || '';
            const alertMsg = reasons
              ? `Milo detected immediate safety concerns: ${reasons}`
              : `Milo detected potential immediate risk and recommends contacting your trusted contacts.`;

            // Prepare modal state via getEmergencySettings and local flow
            const settings = getEmergencySettings();
            // store pending modal details in window state (minimal, non-invasive)
            // Open modal by toggling a global event — instead of adding complex state here,
            // call the confirmation flow directly to keep change surface small.
            const request = {
              userId: getOrCreateUserId(),
              message: `${alertMsg}\n\nUser message: ${userMessage.text}`,
              severity: 'high' as const,
              contacts: settings.contacts,
              demo: settings.demoMode,
            };

            // Ask user via the AlertConfirmationModal flow: show modal and on confirm send
            // We'll trigger the modal imperatively by rendering it below; stash request in ref
            setPendingAlert(request);
            setModalOpen(true);
          }
        } catch (err) {
          // Non-blocking: if modal flow fails, ignore and continue
          console.warn('Failed to evaluate risk modal flow', err);
        }
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
        // Set the transcribed text as the message and focus the input so user can send or edit
        setNewMessage(transcription.transcript);
        // Focus and move caret to end (if input supports ref forwarding)
        try {
          const el = inputRef?.current as HTMLInputElement | null;
          if (el) {
            el.focus();
            const len = el.value?.length || 0;
            el.setSelectionRange(len, len);
          } else {
            // fallback: try to focus by querySelector
            const fallback = document.querySelector('input[placeholder="Message Milo..."]') as HTMLInputElement | null;
            if (fallback) {
              fallback.focus();
              const len = fallback.value?.length || 0;
              fallback.setSelectionRange(len, len);
            }
          }
        } catch (err) {
          console.warn('Failed to focus input after transcription', err);
        }
        
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
   * 
   * 1. Pass the audio data to the edge function
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
      {/* Alert confirmation modal (renders when server signals immediate risk) */}
      <AlertConfirmationModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setPendingAlert(null);
        }}
        onConfirm={handleConfirmAlert}
        contacts={pendingAlert?.contacts || []}
        isDemo={pendingAlert?.demo ?? true}
        message={pendingAlert?.message || ''}
      />
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
            ref={inputRef}
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
