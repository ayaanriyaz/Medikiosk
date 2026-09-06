import { useState, useEffect } from 'react';
import { AnnaStatus, StructuredSymptomSummary, EmergencyInfo, DoctorProfile } from '../types/anna';

export interface AnnaAppState {
  isOpen: boolean;
  status: AnnaStatus;
  statusMessage: string;
  audioLevel: number;
  audioSource: 'user' | 'anna';
  transcripts: Array<{ id: string; role: 'user' | 'anna'; text: string; timestamp: string }>;
  activeEmergency: EmergencyInfo | null;
  activeSummary: StructuredSymptomSummary | null;
  activeDoctor: DoctorProfile | null;
  activeDepartment: string | null;
}

const initialState: AnnaAppState = {
  isOpen: false,
  status: 'disconnected',
  statusMessage: 'Tap microphone to speak with Anna',
  audioLevel: 0,
  audioSource: 'user',
  transcripts: [],
  activeEmergency: null,
  activeSummary: null,
  activeDoctor: null,
  activeDepartment: null,
};

type Listener = (state: AnnaAppState) => void;

class StateStore {
  private state: AnnaAppState = { ...initialState };
  private listeners: Set<Listener> = new Set();

  public getState(): AnnaAppState {
    return this.state;
  }

  public setState(updates: Partial<AnnaAppState>): void {
    this.state = { ...this.state, ...updates };
    this.notify();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  public addTranscript(role: 'user' | 'anna', text: string) {
    if (!text.trim()) return;
    const item = {
      id: `TR-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role,
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    const transcripts = [...this.state.transcripts.slice(-8), item];
    this.setState({ transcripts });
  }

  public clearTranscripts() {
    this.setState({ transcripts: [] });
  }

  public setEmergency(emergency: EmergencyInfo | null) {
    this.setState({ activeEmergency: emergency });
  }

  public setSummary(summary: StructuredSymptomSummary | null) {
    this.setState({ activeSummary: summary });
  }

  public reset() {
    this.state = { ...initialState };
    this.notify();
  }
}

export const annaStore = new StateStore();

export function useAnnaState(): AnnaAppState {
  const [state, setState] = useState<AnnaAppState>(annaStore.getState());

  useEffect(() => {
    return annaStore.subscribe((newState) => {
      setState(newState);
    });
  }, []);

  return state;
}
