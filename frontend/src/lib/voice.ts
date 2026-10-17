import { PipecatClient, type BotOutputData, type TranscriptData } from '@pipecat-ai/client-js';
import { SmallWebRTCTransport } from '@pipecat-ai/small-webrtc-transport';

export type VoiceState = 'IDLE' | 'CONNECTING' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'ENDED';

export interface VoiceHandlers {
  onState(state: VoiceState): void;
  onUserText(text: string, final: boolean): void;
  /** Called for every update of a spoken sentence. The same `key` means the same sentence, so replace, never append. */
  onBotText(key: string, text: string): void;
  onNotice(message: string): void;
}

// Empty in dev (Vite proxies /start, /sessions, /api to the Pipecat runner).
// In production set VITE_PIPECAT_URL to the public URL of the bot server.
export const BOT_URL = ((import.meta.env.VITE_PIPECAT_URL as string | undefined) ?? '').replace(/\/$/, '');

export async function checkBackend(): Promise<boolean> {
  if (!BOT_URL) return false;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`${BOT_URL}/status`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

/** One browser <-> Pipecat bot voice session (Cartesia STT -> Groq LLM -> Cartesia TTS, over WebRTC). */
export class VoiceSession {
  private client: PipecatClient | null = null;
  private audio: HTMLAudioElement | null = null;

  constructor(private readonly handlers: VoiceHandlers) {}

  async start(): Promise<void> {
    const h = this.handlers;
    if (!BOT_URL) {
      throw new Error('VITE_PIPECAT_URL is not configured');
    }
    const audio = document.createElement('audio');
    audio.autoplay = true;
    this.audio = audio;

    const client = new PipecatClient({
      transport: new SmallWebRTCTransport(),
      enableMic: true,
      callbacks: {
        onTransportStateChanged: state => {
          if (state === 'initializing' || state === 'initialized' || state === 'authenticating' || state === 'authenticated' || state === 'connecting' || state === 'connected') h.onState('CONNECTING');
          if (state === 'disconnected' || state === 'error') h.onState('ENDED');
        },
        onBotReady: () => h.onState('LISTENING'),
        onUserStartedSpeaking: () => h.onState('LISTENING'),
        onUserStoppedSpeaking: () => h.onState('THINKING'),
        onBotStartedSpeaking: () => h.onState('SPEAKING'),
        onBotStoppedSpeaking: () => h.onState('LISTENING'),
        onUserTranscript: (data: TranscriptData) => h.onUserText(data.text, data.final),
        onBotOutput: (data: BotOutputData) => {
          // Word-level events repeat the sentence events; keep sentences only.
          if (data.aggregated_by === 'word' || data.will_be_spoken === false) return;
          if (data.text.trim()) h.onBotText(data.segment_id !== undefined ? String(data.segment_id) : data.text, data.text);
        },
        onTrackStarted: (track, participant) => {
          if (participant?.local || track.kind !== 'audio') return;
          audio.srcObject = new MediaStream([track]);
          void audio.play().catch(() => h.onNotice('Your browser blocked audio. Click anywhere on the page and try again.'));
        },
        onError: () => h.onNotice('The voice connection had a problem. Please start the session again.'),
      },
    });
    this.client = client;

    try {
      await client.startBotAndConnect({
        endpoint: `${BOT_URL}/start`,
        requestData: { transport: 'webrtc', enableDefaultIceServers: true },
      });
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  setMuted(muted: boolean): void {
    this.client?.enableMic(!muted);
  }

  async sendText(text: string): Promise<void> {
    await this.client?.sendText(text, { run_immediately: true, audio_response: true });
  }

  async stop(): Promise<void> {
    const client = this.client;
    this.client = null;
    if (this.audio) {
      this.audio.srcObject = null;
      this.audio = null;
    }
    try {
      await client?.disconnect();
    } catch {
      /* already disconnected */
    }
  }
}