export type AnnaStatus =
  | 'disconnected'
  | 'connecting'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'interrupted'
  | 'emergency'
  | 'error';

export interface AnnaToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface AnnaToolResponse {
  id: string;
  name: string;
  result: Record<string, any>;
}

export interface StructuredSymptomSummary {
  id: string;
  timestamp: string;
  patientReported: {
    chiefComplaint: string;
    onsetDuration: string;
    location: string;
    severity: string;
    associatedSymptoms: string[];
    additionalNotes?: string;
  };
  clinicalStructuring: {
    triageCategory: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
    recommendedDepartment: string;
    suggestedDoctors: string[];
    suggestedQuestionsForDoctor: string[];
    disclaimer: string;
  };
}

export interface EmergencyInfo {
  isEmergency: boolean;
  reason: string;
  recommendedAction: string;
  emergencyContacts: Array<{ label: string; number: string }>;
  timestamp: string;
}

export interface DoctorProfile {
  id: string;
  name: string;
  role: string;
  specialty: string;
  department: string;
  qualifications: string;
  experienceYears: number;
  availableDays: string[];
  opdTiming: string;
  languages: string[];
  rating: number;
  bio: string;
}

export interface MedicalDepartment {
  id: string;
  name: string;
  code: string;
  description: string;
  floor: string;
  wing: string;
  chiefDoctor: string;
  commonSymptoms: string[];
  isOpen: boolean;
}
