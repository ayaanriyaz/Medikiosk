import React, { useState } from 'react';
import { Workspace, Intake } from './types';
import { useLanguage } from './i18n/LanguageContext';
import { useAuth } from './auth/AuthContext';
import { Header } from './components/Header';
import { HomeLanding } from './components/HomeLanding';
import { PatientKiosk } from './components/PatientKiosk';
import { DoctorWorkspace } from './components/DoctorWorkspace';
import { HospitalOperations } from './components/HospitalOperations';
import { DoctorAuthPage } from './components/DoctorAuthPage';
import { HospitalAuthPage } from './components/HospitalAuthPage';
import { FhirModal } from './components/FhirModal';
import { AnnaAssistant } from './components/AnnaAssistant/AnnaAssistant';

export default function App() {
  const [workspace, setWorkspaceState] = useState<Workspace>('home');
  const [history, setHistory] = useState<Workspace[]>([]);
  const { language, setLanguage } = useLanguage();
  const { doctor, hospital } = useAuth();
  const [selectedPatientForDoctor, setSelectedPatientForDoctor] = useState<string | null>(null);
  const [activeFhirIntakeId, setActiveFhirIntakeId] = useState<string | null>(null);

  const setWorkspace = (newWorkspace: Workspace) => {
    if (newWorkspace === 'demo') {
      newWorkspace = 'home';
    }
    if (newWorkspace !== workspace) {
      setHistory(prev => [...prev, workspace]);
      setWorkspaceState(newWorkspace);
    }
  };

  const handleGoBack = () => {
    if (history.length > 0) {
      const previous = history[history.length - 1];
      setHistory(h => h.slice(0, -1));
      setWorkspaceState(previous === 'demo' ? 'home' : previous);
    } else {
      setWorkspaceState('home');
    }
  };

  // When patient completes kiosk intake
  const handleIntakeCompleted = (intake: Intake) => {
    setSelectedPatientForDoctor(intake.id);
  };

  // Jump from Kiosk to Doctor workspace
  const handleNavigateToDoctor = (patientOrIntakeId: string) => {
    setSelectedPatientForDoctor(patientOrIntakeId);
    if (doctor) {
      setWorkspace('doctor-dashboard');
    } else {
      setWorkspace('doctor');
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 font-sans text-slate-900 overflow-hidden select-none">
      {/* Universal Header */}
      <Header
        currentWorkspace={workspace}
        setWorkspace={setWorkspace}
        language={language}
        setLanguage={setLanguage}
        onBack={handleGoBack}
        canGoBack={history.length > 0 || workspace !== 'home'}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden relative">
        {workspace === 'home' && (
          <HomeLanding
            setWorkspace={setWorkspace}
            language={language}
            setLanguage={setLanguage}
            onQuickDemoStart={() => setWorkspace('patient')}
          />
        )}

        {(workspace === 'kiosk' || workspace === 'patient') && (
          <PatientKiosk
            language={language}
            setLanguage={setLanguage}
            onIntakeCompleted={handleIntakeCompleted}
            onNavigateToDoctor={handleNavigateToDoctor}
          />
        )}

        {workspace === 'doctor-login' && (
          <DoctorAuthPage
            initialMode="login"
            onAuthSuccess={() => setWorkspace('doctor-dashboard')}
            onCancel={handleGoBack}
            onSwitchToRegister={() => setWorkspace('doctor-register')}
          />
        )}

        {workspace === 'doctor-register' && (
          <DoctorAuthPage
            initialMode="register"
            onAuthSuccess={() => setWorkspace('doctor-dashboard')}
            onCancel={handleGoBack}
            onSwitchToLogin={() => setWorkspace('doctor-login')}
          />
        )}

        {(workspace === 'doctor' || workspace === 'doctor-dashboard') && (
          <DoctorWorkspace
            language={language}
            onViewFhir={(id) => setActiveFhirIntakeId(id)}
            selectedPatientId={selectedPatientForDoctor}
            onBack={handleGoBack}
          />
        )}

        {workspace === 'hospital-login' && (
          <HospitalAuthPage
            initialMode="login"
            onAuthSuccess={() => setWorkspace('hospital-dashboard')}
            onCancel={handleGoBack}
            onSwitchToRegister={() => setWorkspace('hospital-register')}
          />
        )}

        {workspace === 'hospital-register' && (
          <HospitalAuthPage
            initialMode="register"
            onAuthSuccess={() => setWorkspace('hospital-dashboard')}
            onCancel={handleGoBack}
            onSwitchToLogin={() => setWorkspace('hospital-login')}
          />
        )}

        {(workspace === 'admin' || workspace === 'hospital-dashboard') && (
          <HospitalOperations
            language={language}
            onNavigateToPatient={handleNavigateToDoctor}
            onBack={handleGoBack}
          />
        )}
      </div>

      {/* FHIR R4 Modal Viewer */}
      {activeFhirIntakeId && (
        <FhirModal
          intakeId={activeFhirIntakeId}
          onClose={() => setActiveFhirIntakeId(null)}
        />
      )}

      {/* Anna Voice AI Assistant (Real-Time Voice-to-Voice) */}
      <AnnaAssistant
        language={language}
        onNavigate={(page) => setWorkspace(page)}
        onOpenIntake={() => {
          setWorkspace('patient');
        }}
      />
    </div>
  );
}

