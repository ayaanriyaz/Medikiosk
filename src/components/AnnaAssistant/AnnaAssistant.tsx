import React, { useEffect, useRef, useCallback } from 'react';
import { LiveSession } from '../../ai/LiveSession';
import { ToolManager } from '../../ai/ToolManager';
import { annaStore, useAnnaState } from '../../state/StateManager';
import { useLanguage } from '../../i18n/LanguageContext';
import { AnnaButton } from './AnnaButton';
import { AnnaVoicePanel } from './AnnaVoicePanel';
import { DoctorProfile } from '../../types/anna';
import { Language } from '../../types';

interface AnnaAssistantProps {
  language?: Language;
  onNavigate?: (page: 'home' | 'kiosk' | 'doctor' | 'admin') => void;
  onOpenIntake?: (department?: string, reason?: string) => void;
}

export const AnnaAssistant: React.FC<AnnaAssistantProps> = ({
  onNavigate,
  onOpenIntake,
}) => {
  const state = useAnnaState();
  const { t } = useLanguage();
  const sessionRef = useRef<LiveSession | null>(null);
  const toolManagerRef = useRef<ToolManager | null>(null);

  const getFallbackMessage = useCallback((status: string) => {
    switch (status) {
      case 'listening':
        return t.annaListeningPrompt || 'Anna is listening. Describe your health query naturally...';
      case 'speaking':
        return t.annaSpeakingPrompt || 'Anna is speaking...';
      case 'connecting':
        return t.annaConnectingPrompt || 'Connecting to Anna voice service...';
      case 'emergency':
        return t.annaEmergencyPrompt || 'Immediate medical attention advised.';
      case 'error':
        return t.annaErrorPrompt || 'Voice connection error. Tap mic to retry.';
      case 'interrupted':
        return t.annaStatusInterrupted || 'Interrupted. Listening...';
      default:
        return t.annaReadyPrompt || 'Tap microphone to speak with Anna';
    }
  }, [t]);

  // Initialize tool handlers & LiveSession
  useEffect(() => {
    const toolManager = new ToolManager({
      onNavigate: (page) => {
        console.log(`[AnnaAssistant] Tool action: Navigate to ${page}`);
        onNavigate?.(page as any);
      },
      onSelectDoctor: (doc) => {
        console.log(`[AnnaAssistant] Tool action: Selected doctor`, doc);
        annaStore.setState({ activeDoctor: doc as DoctorProfile });
      },
      onSelectDepartment: (dept) => {
        console.log(`[AnnaAssistant] Tool action: Selected department ${dept}`);
        annaStore.setState({ activeDepartment: dept });
      },
      onOpenAppointment: (dept, reason) => {
        console.log(`[AnnaAssistant] Tool action: Open intake for ${dept}`, reason);
        onOpenIntake?.(dept, reason);
      },
      onEmergencyAlert: (emergency) => {
        console.warn(`[AnnaAssistant] CRITICAL EMERGENCY DETECTED:`, emergency);
        annaStore.setEmergency(emergency);
      },
      onSymptomSummary: (summary) => {
        console.log(`[AnnaAssistant] Pre-consultation symptom summary ready:`, summary);
        annaStore.setSummary(summary);
      },
    });

    toolManagerRef.current = toolManager;

    // Create LiveSession
    const session = new LiveSession({
      toolManager,
      onStatusChange: (status, message) => {
        annaStore.setState({
          status,
          statusMessage: message || getFallbackMessage(status),
        });
      },
      onAudioLevelChange: (level, source) => {
        annaStore.setState({ audioLevel: level, audioSource: source });
      },
      onTranscription: (role, text) => {
        annaStore.addTranscript(role, text);
      },
      onEmergency: (emergency) => {
        annaStore.setEmergency(emergency);
      },
      onSummary: (summary) => {
        annaStore.setSummary(summary);
      },
    });

    sessionRef.current = session;

    return () => {
      session.disconnect();
      sessionRef.current = null;
    };
  }, [onNavigate, onOpenIntake, getFallbackMessage]);

  // Toggle voice session connection
  const handleToggleVoice = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;

    if (state.status === 'disconnected' || state.status === 'error') {
      await session.connect();
    } else if (state.status === 'speaking') {
      // User tapped mic while speaking -> barge-in / interrupt
      session.disconnect();
    } else {
      session.disconnect();
    }
  }, [state.status]);

  // Toggle panel visibility
  const handleTogglePanel = useCallback(async () => {
    const nextIsOpen = !state.isOpen;
    annaStore.setState({ isOpen: nextIsOpen });

    // When user opens panel for the first time, auto-connect voice session if disconnected
    if (nextIsOpen && state.status === 'disconnected') {
      const session = sessionRef.current;
      if (session) {
        await session.connect();
      }
    }
  }, [state.isOpen, state.status]);

  const handleProceedToKiosk = useCallback(() => {
    onNavigate?.('kiosk');
    if (state.activeSummary) {
      onOpenIntake?.(
        state.activeSummary.clinicalStructuring.recommendedDepartment,
        state.activeSummary.patientReported.chiefComplaint
      );
    }
  }, [onNavigate, onOpenIntake, state.activeSummary]);

  return (
    <>
      <AnnaButton
        status={state.status}
        isOpen={state.isOpen}
        onToggle={handleTogglePanel}
      />

      {state.isOpen && (
        <AnnaVoicePanel
          status={state.status}
          statusMessage={state.statusMessage}
          audioLevel={state.audioLevel}
          audioSource={state.audioSource}
          transcripts={state.transcripts}
          emergency={state.activeEmergency}
          summary={state.activeSummary}
          doctor={state.activeDoctor}
          onToggleVoice={handleToggleVoice}
          onClose={() => annaStore.setState({ isOpen: false })}
          onDismissEmergency={() => annaStore.setEmergency(null)}
          onDismissSummary={() => annaStore.setSummary(null)}
          onDismissDoctor={() => annaStore.setState({ activeDoctor: null })}
          onProceedToKiosk={handleProceedToKiosk}
        />
      )}
    </>
  );
};
