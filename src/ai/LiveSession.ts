import { AudioStreamer } from '../audio/AudioStreamer';
import { AudioPlayer } from '../audio/AudioPlayer';
import { ToolManager } from './ToolManager';
import { AnnaStatus, StructuredSymptomSummary, EmergencyInfo } from '../types/anna';

export interface LiveSessionConfig {
  toolManager: ToolManager;
  onStatusChange: (status: AnnaStatus, message?: string) => void;
  onAudioLevelChange?: (level: number, source: 'user' | 'anna') => void;
  onTranscription?: (role: 'user' | 'anna', text: string) => void;
  onEmergency?: (info: EmergencyInfo) => void;
  onSummary?: (summary: StructuredSymptomSummary) => void;
}

export class LiveSession {
  private ws: WebSocket | null = null;
  private streamer: AudioStreamer;
  private player: AudioPlayer;
  private toolManager: ToolManager;
  private status: AnnaStatus = 'disconnected';
  private config: LiveSessionConfig;
  private isManualClose = false;
  private pingInterval: any = null;
  private levelPollInterval: any = null;

  constructor(config: LiveSessionConfig) {
    this.config = config;
    this.toolManager = config.toolManager;
    this.streamer = new AudioStreamer();
    this.player = new AudioPlayer();

    // Hook playback state changes
    this.player.onPlaybackStateChange = (isPlaying) => {
      if (isPlaying) {
        this.setStatus('speaking', 'Anna is speaking...');
      } else if (this.status === 'speaking') {
        this.setStatus('listening', 'Anna is listening. Speak whenever you are ready.');
      }
    };
  }

  public async connect(): Promise<boolean> {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return true;
    }

    this.isManualClose = false;
    this.setStatus('connecting', 'Connecting to Anna voice service...');

    // Resume audio player context on user gesture
    await this.player.resume();

    return new Promise((resolve) => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let savedLang = 'en';
        try {
          savedLang = localStorage.getItem('language') || localStorage.getItem('medikiosk_language') || 'en';
        } catch (e) {
          // Ignore localStorage security errors in sandboxed iframes
        }
        const wsUrl = `${protocol}//${window.location.host}/live?lang=${savedLang}`;

        console.log(`[LiveSession] Connecting to ${wsUrl} (Language: ${savedLang})`);
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = async () => {
          console.log('[LiveSession] WebSocket connected.');
          this.setStatus('listening', 'Connected. Setting up microphone...');

          // Start ping heartbeat
          this.startHeartbeat();

          // Start microphone audio streaming
          const micStarted = await this.startMicrophone();
          if (micStarted) {
            this.setStatus('listening', 'Anna is listening. Speak naturally.');
            this.startLevelPolling();
            resolve(true);
          } else {
            this.setStatus('error', 'Microphone access denied. Please allow microphone permissions.');
            resolve(false);
          }
        };

        this.ws.onmessage = (event) => {
          this.handleServerMessage(event.data);
        };

        this.ws.onerror = (err) => {
          console.error('[LiveSession] WebSocket error:', err);
          this.setStatus('error', 'Connection error. Tap to retry.');
          resolve(false);
        };

        this.ws.onclose = () => {
          console.log('[LiveSession] WebSocket closed.');
          this.stopHeartbeat();
          this.stopLevelPolling();
          this.streamer.stop();
          this.player.interrupt();

          if (!this.isManualClose && this.status !== 'emergency') {
            this.setStatus('disconnected', 'Anna disconnected. Tap to reconnect.');
          }
        };
      } catch (err) {
        console.error('[LiveSession] Connection exception:', err);
        this.setStatus('error', 'Failed to connect to voice engine.');
        resolve(false);
      }
    });
  }

  private async startMicrophone(): Promise<boolean> {
    return await this.streamer.start(
      (base64Pcm16) => {
        // Send microphone chunk to server
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(
            JSON.stringify({
              type: 'audio',
              audio: base64Pcm16,
            })
          );
        }
      },
      (level) => {
        if (this.config.onAudioLevelChange && !this.player.playing) {
          this.config.onAudioLevelChange(level, 'user');
        }

        // Barge-in / interruption: if user speaks loudly while Anna is speaking, stop Anna immediately!
        if (level > 0.25 && this.player.playing) {
          console.log('[LiveSession] User barged in (speaking over Anna). Interrupting playback.');
          this.player.interrupt();
          this.setStatus('listening', 'Anna stopped speaking to listen.');
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'interrupt' }));
          }
        }
      },
      (error) => {
        console.error('[LiveSession] Mic error:', error);
        this.setStatus('error', 'Microphone error: ' + error.message);
      }
    );
  }

  private handleServerMessage(raw: string) {
    try {
      const msg = JSON.parse(raw);

      switch (msg.type) {
        case 'status':
          if (msg.status === 'listening' && this.player.playing) {
            // keep speaking status while audio buffer is playing
            break;
          }
          this.setStatus(msg.status, msg.message);
          break;

        case 'audio':
          if (msg.audio) {
            this.player.queueAudioChunk(msg.audio);
          }
          break;

        case 'interrupted':
          this.player.interrupt();
          this.setStatus('interrupted', 'Interrupted. Anna is listening.');
          setTimeout(() => {
            if (this.status === 'interrupted') {
              this.setStatus('listening', 'Anna is listening.');
            }
          }, 400);
          break;

        case 'tool_call':
          console.log('[LiveSession] Tool call received from Anna:', msg.name, msg.args);
          this.toolManager.handleToolCall(msg.name, msg.args || {}, msg.result || {});
          if (msg.name === 'showEmergencyInformation') {
            this.setStatus('emergency', 'Emergency Alert Triggered');
            this.config.onEmergency?.({
              isEmergency: true,
              reason: msg.args?.emergencyReason || 'Critical symptom detected',
              recommendedAction:
                msg.args?.recommendedAction ||
                'Seek immediate emergency medical care. Call 112 or 108 immediately.',
              emergencyContacts: [
                { label: 'National Emergency', number: '112' },
                { label: 'Emergency Ambulance', number: '108' },
                { label: 'Hospital Emergency Unit', number: '+91 11 2999 1234' },
              ],
              timestamp: new Date().toISOString(),
            });
          } else if (msg.name === 'createSymptomSummary') {
            if (msg.result?.summaryId) {
              const summary: StructuredSymptomSummary = {
                id: msg.result.summaryId,
                timestamp: new Date().toISOString(),
                patientReported: {
                  chiefComplaint: msg.args?.chiefComplaint || 'Reported symptom',
                  onsetDuration: msg.args?.onsetDuration || 'Recent onset',
                  location: msg.args?.location || 'General',
                  severity: String(msg.args?.severity || 'Moderate'),
                  associatedSymptoms: msg.args?.associatedSymptoms || [],
                  additionalNotes: msg.args?.patientReportedNotes || '',
                },
                clinicalStructuring: {
                  triageCategory:
                    String(msg.args?.severity).toLowerCase().includes('severe') || Number(msg.args?.severity) >= 8
                      ? 'URGENT'
                      : 'ROUTINE',
                  recommendedDepartment: msg.args?.recommendedDepartment || 'General Medicine',
                  suggestedDoctors: ['Dr. Vivek Sharma, MD', 'Dr. Ananya Mukherjee, MD(Ayu)'],
                  suggestedQuestionsForDoctor: [
                    'What tests or investigations are recommended?',
                    'Are there warning signs I should watch for at home?',
                  ],
                  disclaimer:
                    'AI pre-consultation summary prepared for medical staff review. Final clinical judgment rests with the attending doctor.',
                },
              };
              this.config.onSummary?.(summary);
            }
          }
          break;

        case 'transcription':
          if (msg.text && this.config.onTranscription) {
            this.config.onTranscription(msg.role || 'anna', msg.text);
          }
          break;
      }
    } catch (err) {
      console.error('[LiveSession] Error handling message:', err);
    }
  }

  private startLevelPolling() {
    this.stopLevelPolling();
    this.levelPollInterval = setInterval(() => {
      if (this.player.playing) {
        const level = this.player.getAudioLevel();
        if (this.config.onAudioLevelChange) {
          this.config.onAudioLevelChange(level, 'anna');
        }
      }
    }, 50);
  }

  private stopLevelPolling() {
    if (this.levelPollInterval) {
      clearInterval(this.levelPollInterval);
      this.levelPollInterval = null;
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 20000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private setStatus(status: AnnaStatus, message?: string) {
    this.status = status;
    this.config.onStatusChange(status, message);
  }

  public disconnect(): void {
    this.isManualClose = true;
    this.stopHeartbeat();
    this.stopLevelPolling();
    this.streamer.stop();
    this.player.interrupt();

    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }

    this.setStatus('disconnected', 'Anna disconnected.');
  }

  public get currentStatus(): AnnaStatus {
    return this.status;
  }

  public get isPlayingAudio(): boolean {
    return this.player.playing;
  }

  public get isMicActive(): boolean {
    return this.streamer.recording;
  }
}
