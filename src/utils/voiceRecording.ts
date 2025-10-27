/**
 * Voice Recording Utility
 * Handles audio recording and prepares audio data for Google Cloud Speech-to-Text API
 * 
 * Google Cloud Speech-to-Text Requirements:
 * - Audio format: LINEAR16, FLAC, or WEBM_OPUS
 * - Sample rate: 16000 Hz (recommended) or 8000 Hz
 * - Encoding: PCM 16-bit
 */

export interface AudioRecordingConfig {
  sampleRate?: number;
  channelCount?: number;
  mimeType?: string;
}

export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  
  // Default config optimized for Google Cloud Speech-to-Text
  private config: AudioRecordingConfig = {
    sampleRate: 16000,  // Google Cloud recommended sample rate
    channelCount: 1,     // Mono audio
    mimeType: 'audio/webm'  // Compatible format
  };

  constructor(config?: Partial<AudioRecordingConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Start recording audio from the user's microphone
   */
  async startRecording(): Promise<void> {
    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channelCount,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      // Determine best supported MIME type
      const mimeType = this.getSupportedMimeType();
      
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        audioBitsPerSecond: 16000
      });

      this.audioChunks = [];

      // Collect audio data
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
      console.log('🎤 Voice recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      throw new Error('Failed to access microphone. Please check permissions.');
    }
  }

  /**
   * Stop recording and return the audio blob
   */
  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No active recording'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { 
          type: this.getSupportedMimeType() 
        });
        
        // Clean up
        this.cleanup();
        
        console.log('🎤 Voice recording stopped. Size:', audioBlob.size, 'bytes');
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Cancel recording and clean up resources
   */
  cancelRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.cleanup();
    console.log('🎤 Voice recording cancelled');
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  /**
   * Convert audio blob to base64 for API transmission
   * Useful for sending to Google Cloud Speech-to-Text API
   */
  async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove data URL prefix to get pure base64
        const base64Data = base64String.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Prepare audio data for Google Cloud Speech-to-Text API
   * Returns base64-encoded audio data
   */
  async prepareForGoogleCloud(audioBlob: Blob): Promise<{
    content: string;
    config: {
      encoding: string;
      sampleRateHertz: number;
      languageCode: string;
      enableAutomaticPunctuation: boolean;
    };
  }> {
    const base64Audio = await this.blobToBase64(audioBlob);
    
    return {
      content: base64Audio,
      config: {
        encoding: 'WEBM_OPUS',  // Audio encoding format
        sampleRateHertz: this.config.sampleRate || 16000,
        languageCode: 'en-US',  // Can be made configurable
        enableAutomaticPunctuation: true,
      }
    };
  }

  /**
   * Get best supported MIME type for this browser
   */
  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm'; // Fallback
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}

/**
 * Helper function to create a voice recorder instance
 */
export const createVoiceRecorder = (config?: Partial<AudioRecordingConfig>): VoiceRecorder => {
  return new VoiceRecorder(config);
};
