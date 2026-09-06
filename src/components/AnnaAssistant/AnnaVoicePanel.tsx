import React, { useEffect, useState } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  X,
  Shield,
  Activity,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { AnnaStatus, StructuredSymptomSummary, EmergencyInfo, DoctorProfile } from '../../types/anna';
import { useLanguage } from '../../i18n/LanguageContext';
import { AnnaWaveform } from './AnnaWaveform';
import { AnnaEmergencyBanner } from './AnnaEmergencyBanner';
import { AnnaSummaryModal } from './AnnaSummaryModal';
import { AnnaDoctorCard } from './AnnaDoctorCard';

interface AnnaVoicePanelProps {
  status: AnnaStatus;
  statusMessage: string;
  audioLevel: number;
  audioSource: 'user' | 'anna';
  transcripts: Array<{ id: string; role: 'user' | 'anna'; text: string; timestamp: string }>;
  emergency: EmergencyInfo | null;
  summary: StructuredSymptomSummary | null;
  doctor: DoctorProfile | { name: string; department: string } | null;
  onToggleVoice: () => void;
  onClose: () => void;
  onDismissEmergency: () => void;
  onDismissSummary: () => void;
  onDismissDoctor: () => void;
  onProceedToKiosk?: () => void;
}

export const AnnaVoicePanel: React.FC<AnnaVoicePanelProps> = ({
  status,
  statusMessage,
  audioLevel,
  audioSource,
  transcripts,
  emergency,
  summary,
  doctor,
  onToggleVoice,
  onClose,
  onDismissEmergency,
  onDismissSummary,
  onDismissDoctor,
  onProceedToKiosk,
}) => {
  const [showTips, setShowTips] = useState(false);
  const { language, t } = useLanguage();

  const isConnected = status !== 'disconnected' && status !== 'error';
  const isSpeaking = status === 'speaking';
  const isListening = status === 'listening';
  const isConnecting = status === 'connecting';
  const isEmergency = status === 'emergency' || !!emergency;

  // Status color helpers
  const getStatusBadge = () => {
    switch (status) {
      case 'listening':
        return {
          bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          dot: 'bg-emerald-400 animate-pulse',
          label: t.annaStatusListening || 'Listening to you',
        };
      case 'speaking':
        return {
          bg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
          dot: 'bg-cyan-400 animate-ping',
          label: t.annaStatusSpeaking || 'Anna is speaking',
        };
      case 'connecting':
        return {
          bg: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
          dot: 'bg-purple-400 animate-spin',
          label: t.annaStatusConnecting || 'Connecting voice...',
        };
      case 'interrupted':
        return {
          bg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          dot: 'bg-amber-400',
          label: t.annaStatusInterrupted || 'Listening...',
        };
      case 'emergency':
        return {
          bg: 'bg-red-500/25 text-red-300 border-red-500/40',
          dot: 'bg-red-500 animate-ping',
          label: t.annaStatusEmergency || 'Emergency Alert',
        };
      case 'error':
        return {
          bg: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          dot: 'bg-rose-400',
          label: t.annaStatusError || 'Connection Issue',
        };
      default:
        return {
          bg: 'bg-slate-800 text-slate-400 border-slate-700',
          dot: 'bg-slate-500',
          label: t.annaStatusReady || 'Ready to speak',
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <div
      id="anna-voice-assistant-panel"
      className="fixed inset-x-3 bottom-3 top-auto z-50 flex flex-col overflow-hidden rounded-3xl border border-teal-500/30 bg-slate-950/95 shadow-2xl backdrop-blur-2xl text-slate-100 sm:bottom-6 sm:right-6 sm:left-auto sm:w-[460px] sm:max-h-[88vh] transition-all duration-300 animate-in fade-in slide-in-from-bottom-6"
    >
      {/* Background ambient lighting */}
      <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-slate-800/80 px-5 py-3.5 bg-slate-900/40">
        <div className="flex items-center gap-3">
          {/* Anna Avatar with multi-layer animated aura */}
          <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-teal-600 via-cyan-600 to-emerald-500 p-0.5 shadow-lg shadow-teal-500/20">
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-950">
              <Activity className="h-5 w-5 text-teal-400 animate-pulse-subtle" />
            </div>
            {isConnected && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-teal-500 border border-slate-950" />
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold tracking-tight text-white">{t.annaPanelTitle}</h3>
              <span className="rounded-full bg-teal-500/15 border border-teal-500/30 px-2 py-0.5 text-[10px] font-semibold text-teal-300">
                {t.annaPanelSubtitle}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">{t.annaLanguagesPill}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowTips(!showTips)}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            title="Spoken Example Guidance"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            title="Minimize Anna"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main scrollable body */}
      <div className="relative z-10 flex-1 overflow-y-auto px-5 py-4 space-y-4 max-h-[70vh]">
        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${badge.bg}`}
          >
            <span className={`h-2 w-2 rounded-full ${badge.dot}`} />
            <span>{badge.label}</span>
          </div>

          <span className="text-[11px] font-medium text-slate-400">
            {isSpeaking ? (t.annaInterruptHint || 'Tap mic to interrupt') : isListening ? (t.annaSpeakFreely || 'Speak freely') : (t.annaRealtimeAudio || 'Real-time audio')}
          </span>
        </div>

        {/* Emergency Banner Alert (if triggered) */}
        {emergency && (
          <AnnaEmergencyBanner emergency={emergency} onDismiss={onDismissEmergency} />
        )}

        {/* Structured Symptom Summary (if generated) */}
        {summary && (
          <AnnaSummaryModal
            summary={summary}
            onClose={onDismissSummary}
            onProceedToKiosk={onProceedToKiosk}
          />
        )}

        {/* Doctor Card (if recommended) */}
        {doctor && (
          <AnnaDoctorCard
            doctor={doctor}
            onClose={onDismissDoctor}
            onBookConsultation={() => onProceedToKiosk?.()}
          />
        )}

        {/* Visualizer Area */}
        <div className="relative flex flex-col items-center justify-center py-2">
          <AnnaWaveform
            status={status}
            audioLevel={audioLevel}
            audioSource={audioSource}
          />

          {/* Central Interactive Voice Control */}
          <div className="relative my-3 flex items-center justify-center">
            {/* Pulsing halo rings */}
            {isConnected && (
              <>
                <div
                  className={`absolute h-28 w-28 rounded-full transition-all duration-300 opacity-25 ${
                    isSpeaking
                      ? 'bg-cyan-500 animate-ping'
                      : isListening
                      ? 'bg-teal-500 animate-pulse'
                      : 'bg-slate-700'
                  }`}
                  style={{
                    transform: `scale(${1 + audioLevel * 0.4})`,
                  }}
                />
                <div
                  className={`absolute h-24 w-24 rounded-full transition-all duration-200 opacity-35 ${
                    isSpeaking ? 'bg-cyan-400' : isListening ? 'bg-teal-400' : 'bg-slate-800'
                  }`}
                  style={{
                    transform: `scale(${1 + audioLevel * 0.25})`,
                  }}
                />
              </>
            )}

            <button
              id="anna-mic-toggle-btn"
              onClick={onToggleVoice}
              disabled={isConnecting}
              className={`relative z-10 flex h-20 w-20 items-center justify-center rounded-full shadow-2xl transition-all duration-200 active:scale-95 cursor-pointer ${
                isSpeaking
                  ? 'bg-gradient-to-tr from-cyan-600 to-sky-500 text-white shadow-cyan-500/40 ring-4 ring-cyan-400/30'
                  : isListening
                  ? 'bg-gradient-to-tr from-teal-600 to-emerald-500 text-white shadow-teal-500/40 ring-4 ring-teal-400/30'
                  : isConnecting
                  ? 'bg-purple-600 text-white opacity-80 ring-4 ring-purple-400/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-teal-400 ring-4 ring-slate-700/50'
              }`}
            >
              {isSpeaking ? (
                <Volume2 className="h-8 w-8 animate-pulse" />
              ) : isListening ? (
                <Mic className="h-8 w-8 animate-bounce-short" />
              ) : isConnecting ? (
                <div className="h-7 w-7 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <MicOff className="h-8 w-8 text-slate-400" />
              )}
            </button>
          </div>

          <p className="text-center text-xs font-medium text-slate-300 max-w-[320px] leading-relaxed mt-1">
            {statusMessage}
          </p>
        </div>

        {/* Live spoken captions / accessibility transcript */}
        {transcripts.length > 0 && (
          <div className="rounded-2xl bg-slate-900/60 p-3.5 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold border-b border-slate-800/80 pb-1.5">
              <span>{t.annaLiveTranscriptTitle}</span>
              <span className="text-[10px] text-teal-400">Speech-to-Speech</span>
            </div>
            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
              {transcripts.slice(-3).map((tr) => (
                <div
                  key={tr.id}
                  className={`text-xs leading-relaxed rounded-xl p-2 ${
                    tr.role === 'anna'
                      ? 'bg-cyan-950/30 text-cyan-200 border-l-2 border-cyan-400'
                      : 'bg-slate-800/40 text-slate-200 border-l-2 border-teal-400'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider block opacity-70 mb-0.5">
                    {tr.role === 'anna' ? 'Anna' : (language === 'hi' ? 'आप' : 'You')} • {tr.timestamp}
                  </span>
                  <p>{tr.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Spoken Guidance Tips Dropdown */}
        {showTips && (
          <div className="rounded-2xl bg-slate-900/80 p-4 border border-teal-500/20 space-y-2.5 text-xs text-slate-300 animate-fadeIn">
            <div className="flex items-center gap-2 text-teal-300 font-bold">
              <Sparkles className="h-4 w-4" />
              <span>{t.annaSpokenTipsTitle}</span>
            </div>
            <p className="text-[11px] text-slate-400">
              {t.annaSpokenTipsDesc}
            </p>
            <div className="space-y-1.5 text-[11px]">
              <div className="rounded-lg bg-slate-950/60 p-2 border border-slate-800 text-teal-200">
                💬 <span className="font-semibold">{language === 'hi' ? 'हिन्दी/हिंग्लिश:' : 'Hinglish:'}</span> "Mere stomach mein kal se pain ho raha hai."
              </div>
              <div className="rounded-lg bg-slate-950/60 p-2 border border-slate-800 text-cyan-200">
                💬 <span className="font-semibold">{language === 'hi' ? 'अंग्रेजी:' : 'English:'}</span> "I have been feeling dizzy and nauseous since morning."
              </div>
              <div className="rounded-lg bg-slate-950/60 p-2 border border-slate-800 text-purple-200">
                💬 <span className="font-semibold">{language === 'hi' ? 'डॉक्टर प्रश्न:' : 'Doctor Query:'}</span> "Mujhe kis doctor se consult karna chahiye?"
              </div>
              <div className="rounded-lg bg-slate-950/60 p-2 border border-slate-800 text-emerald-200">
                💬 <span className="font-semibold">{language === 'hi' ? 'पंजीकरण:' : 'Check-in:'}</span> "Please open the OPD Kiosk registration."
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Medical Disclaimer */}
      <div className="relative z-10 border-t border-slate-800/80 bg-slate-950/80 px-5 py-2.5">
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <Shield className="h-3.5 w-3.5 text-teal-400 shrink-0" />
          <p className="leading-tight">
            {t.annaDisclaimer}
          </p>
        </div>
      </div>
    </div>
  );
};
