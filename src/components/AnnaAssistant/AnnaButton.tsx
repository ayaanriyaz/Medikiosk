import React from 'react';
import { Mic, Activity, Sparkles } from 'lucide-react';
import { AnnaStatus } from '../../types/anna';
import { useLanguage } from '../../i18n/LanguageContext';

interface AnnaButtonProps {
  status: AnnaStatus;
  isOpen: boolean;
  onToggle: () => void;
}

export const AnnaButton: React.FC<AnnaButtonProps> = ({ status, isOpen, onToggle }) => {
  const { t } = useLanguage();
  const isSpeaking = status === 'speaking';
  const isListening = status === 'listening';
  const isEmergency = status === 'emergency';

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {/* Background ambient glow */}
      <div
        className={`absolute inset-0 -m-2 rounded-full blur-xl transition-all duration-500 opacity-60 ${
          isEmergency
            ? 'bg-red-500 animate-ping'
            : isSpeaking
            ? 'bg-cyan-500 animate-pulse'
            : isListening
            ? 'bg-emerald-500 animate-pulse'
            : 'bg-teal-500/40'
        }`}
      />

      <button
        id="anna-floating-trigger-btn"
        onClick={onToggle}
        className={`group relative flex items-center gap-3 rounded-full py-2.5 px-4.5 shadow-2xl transition-all duration-300 active:scale-95 border ${
          isOpen
            ? 'bg-slate-900 text-teal-300 border-teal-500/50 ring-2 ring-teal-500/30'
            : isEmergency
            ? 'bg-gradient-to-r from-red-700 to-red-900 text-white border-red-400 shadow-red-600/50'
            : isSpeaking
            ? 'bg-gradient-to-r from-cyan-600 via-sky-600 to-teal-600 text-white border-cyan-400 shadow-cyan-500/40 ring-4 ring-cyan-400/20'
            : isListening
            ? 'bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 text-white border-teal-300 shadow-teal-500/40 ring-4 ring-teal-400/20'
            : 'bg-gradient-to-r from-slate-900 via-slate-900 to-teal-950 text-white border-teal-500/40 hover:border-teal-400 shadow-teal-900/40 hover:shadow-teal-500/30'
        }`}
        aria-label="Toggle Anna Medical Voice Assistant"
      >
        {/* Anna Icon with glowing halo */}
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/20 text-teal-300 group-hover:scale-105 transition-transform">
          {isSpeaking ? (
            <Activity className="h-4.5 w-4.5 text-cyan-300 animate-pulse" />
          ) : isListening ? (
            <Mic className="h-4.5 w-4.5 text-emerald-300 animate-bounce-short" />
          ) : (
            <Sparkles className="h-4.5 w-4.5 text-teal-300" />
          )}

          {/* Online status indicator */}
          <span
            className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900 ${
              isEmergency
                ? 'bg-red-500 animate-ping'
                : isSpeaking
                ? 'bg-cyan-400 animate-ping'
                : isListening
                ? 'bg-emerald-400'
                : 'bg-teal-400'
            }`}
          />
        </div>

        {/* Text Details */}
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold tracking-tight text-white">Anna</span>
            <span className="rounded-full bg-teal-400/20 px-1.5 py-0.2 text-[9px] font-extrabold uppercase tracking-wider text-teal-200">
              Voice AI
            </span>
          </div>
          <span className="text-[10px] text-slate-300 font-medium">
            {isSpeaking
              ? (t.annaBtnSpeaking || 'Speaking...')
              : isListening
              ? (t.annaBtnListening || 'Listening...')
              : (t.annaBtnSpeakPrompt || 'Speak Health Query')}
          </span>
        </div>
      </button>
    </div>
  );
};
