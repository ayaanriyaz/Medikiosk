import React, { useState, useEffect } from 'react';
import { Patient, Intake, Language, MedicalDocument, AyushData, Medication, Allergy, ClinicalReport } from '../types';
import { translations } from '../i18n';
import { useLanguage } from '../i18n/LanguageContext';
import { CLINICAL_ONTOLOGY_FLOW, AYUSH_ONTOLOGY_FLOW, QuestionPrompt } from '../clinicalOntology';
import { AIClinicalChatbot } from './AIClinicalChatbot';
import { PreConsultationReportView } from './PreConsultationReportView';
import { PatientDirectory } from './PatientDirectory';
import { PatientProfileView } from './PatientProfileView';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  FileText,
  Upload,
  QrCode,
  Search,
  UserPlus,
  ShieldCheck,
  Stethoscope,
  Sparkles,
  RefreshCw,
  Clock,
  HeartPulse,
  Eye,
  Check,
  FileCheck,
  Users,
  Layers,
} from 'lucide-react';

interface PatientKioskProps {
  language?: Language;
  setLanguage?: (l: Language) => void;
  onIntakeCompleted: (intake: Intake) => void;
  onNavigateToDoctor: (patientId: string) => void;
}

export const PatientKiosk: React.FC<PatientKioskProps> = ({
  language: propLanguage,
  setLanguage: propSetLanguage,
  onIntakeCompleted,
  onNavigateToDoctor,
}) => {
  const { language: ctxLanguage, setLanguage: ctxSetLanguage, t } = useLanguage();
  const language = propLanguage || ctxLanguage;
  const setLanguage = (l: Language) => {
    ctxSetLanguage(l);
    propSetLanguage?.(l);
  };

  // Patient Section Views: 'directory' | 'profile' | 'report_view' | 'kiosk_flow'
  const [sectionView, setSectionView] = useState<'directory' | 'profile' | 'report_view' | 'kiosk_flow'>('directory');
  const [patientList, setPatientList] = useState<Patient[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [selectedProfilePatient, setSelectedProfilePatient] = useState<Patient | null>(null);
  const [viewingReport, setViewingReport] = useState<ClinicalReport | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  // Kiosk Steps: 1: IDENTIFY, 2: LANGUAGE & CONSENT, 3: CLINICAL QUESTIONS, 4: DOCUMENTS, 5: REVIEW, 6: SUMMARY, 7: COMPLETE
  const [step, setStep] = useState<number>(1);

  // Patient Identification State
  const [idTab, setIdTab] = useState<'abha' | 'aadhaar' | 'register' | 'qr'>('abha');
  const [abhaInput, setAbhaInput] = useState('');
  const [aadhaarInput, setAadhaarInput] = useState('');
  const [aadhaarOtpSent, setAadhaarOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // New Patient Form
  const [regName, setRegName] = useState('');
  const [regAge, setRegAge] = useState('');
  const [regGender, setRegGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [regPhone, setRegPhone] = useState('');

  // Active Session & Patient
  const [activePatient, setActivePatient] = useState<Patient | null>(null);
  const [activeIntake, setActiveIntake] = useState<Intake | null>(null);

  // Step 2: Intake Mode & Consent
  const [intakeMode, setIntakeMode] = useState<'general' | 'ayush'>('general');
  const [consentGiven, setConsentGiven] = useState<boolean | null>(null);
  const [isReadingConsent, setIsReadingConsent] = useState(false);

  // Step 3: Clinical Questions Flow
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionsList, setQuestionsList] = useState<QuestionPrompt[]>(CLINICAL_ONTOLOGY_FLOW);
  const [currentTextAnswer, setCurrentTextAnswer] = useState('');
  const [collectedAnswers, setCollectedAnswers] = useState<Record<string, string>>({});
  const [isListening, setIsListening] = useState(false);
  const [recognizedSpeech, setRecognizedSpeech] = useState<string | null>(null);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [redFlagNotice, setRedFlagNotice] = useState<string | null>(null);

  // Step 4: Documents & OCR
  const [documentsList, setDocumentsList] = useState<MedicalDocument[]>([]);
  const [isProcessingDoc, setIsProcessingDoc] = useState(false);
  const [selectedDocForCorrection, setSelectedDocForCorrection] = useState<MedicalDocument | null>(null);

  // Step 5: Review & Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedIntake, setSubmittedIntake] = useState<Intake | null>(null);
  const [generatedClinicalReport, setGeneratedClinicalReport] = useState<ClinicalReport | null>(null);

  // Update questions list based on mode
  useEffect(() => {
    if (intakeMode === 'ayush') {
      setQuestionsList([...CLINICAL_ONTOLOGY_FLOW, ...AYUSH_ONTOLOGY_FLOW]);
    } else {
      setQuestionsList(CLINICAL_ONTOLOGY_FLOW);
    }
  }, [intakeMode]);

  // Load registered patients from backend
  const loadPatients = async () => {
    setIsLoadingPatients(true);
    try {
      const res = await fetch('/api/patients');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setPatientList(data);
        }
      }
    } catch (e) {
      console.error('Failed to load patients:', e);
    } finally {
      setIsLoadingPatients(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  // Profile Selection & Actions
  const handleSelectPatientProfile = async (patient: Patient) => {
    // Fetch latest patient details from API to ensure full relational context
    try {
      const res = await fetch(`/api/patients/${patient.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedProfilePatient(data.patient || patient);
        setActivePatient(data.patient || patient);
      } else {
        setSelectedProfilePatient(patient);
        setActivePatient(patient);
      }
    } catch {
      setSelectedProfilePatient(patient);
      setActivePatient(patient);
    }
    setSectionView('profile');
  };

  const handleStartInterviewFromProfile = (patient: Patient) => {
    setActivePatient(patient);
    setIntakeMode(patient.department === 'Ayurveda & Panchakarma' ? 'ayush' : 'general');
    setStep(3); // Step 3: AI Clinical Chatbot
    setSectionView('kiosk_flow');
  };

  const handleViewReportFromProfile = async (patient: Patient) => {
    setIsLoadingReport(true);
    try {
      const res = await fetch(`/api/patients/${patient.id}/clinical-report`);
      if (res.ok) {
        const reportData = await res.json();
        if (reportData && reportData.id) {
          setViewingReport(reportData);
          setSectionView('report_view');
          return;
        }
      }
    } catch (err) {
      console.error('Failed to fetch patient report:', err);
    } finally {
      setIsLoadingReport(false);
    }

    // If report is not yet generated, start the clinical interview
    handleStartInterviewFromProfile(patient);
  };

  // Audio Guidance TTS
  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'hi' ? 'hi-IN' : 'en-US';
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Helper to select a patient and initialize/fetch session
  const selectPatient = async (patient: Patient) => {
    setActivePatient(patient);
    setSearchError('');

    try {
      // Create intake session on backend
      const res = await fetch('/api/intakes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patient.id,
          language,
          mode: intakeMode,
          department: intakeMode === 'ayush' ? 'Kayachikitsa (AIIA)' : 'General Medicine / Triage',
        }),
      });
      const newIntake = await res.json();
      setActiveIntake(newIntake);
      setStep(2); // Move to Language & Consent
    } catch (e) {
      console.error('Failed to create intake session:', e);
      setStep(2);
    }
  };

  // Search by ABHA
  const handleSearchAbha = async () => {
    if (!abhaInput.trim()) return;
    setIsSearching(true);
    setSearchError('');

    try {
      const res = await fetch('/api/patients/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: abhaInput.trim() }),
      });
      const data = await res.json();

      if (data.found && data.patient) {
        selectPatient(data.patient);
      } else {
        setSearchError(t.noRecordFound);
      }
    } catch (e) {
      setSearchError('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Aadhaar OTP flow simulation
  const handleSendOtp = () => {
    if (aadhaarInput.length !== 4) {
      setSearchError('Please enter last 4 digits of Aadhaar.');
      return;
    }
    setAadhaarOtpSent(true);
    setSearchError('');
    setOtpInput('4821'); // Pre-fill for ease of demonstration
  };

  const handleVerifyOtp = async () => {
    setIsSearching(true);
    try {
      const res = await fetch('/api/patients/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: aadhaarInput }),
      });
      const data = await res.json();
      if (data.found && data.patient) {
        selectPatient(data.patient);
      } else {
        setSearchError('No matching patient with this Aadhaar credential. Please register.');
      }
    } catch (e) {
      setSearchError('OTP verification failed.');
    } finally {
      setIsSearching(false);
    }
  };

  // Register New Patient
  const handleRegisterPatient = async () => {
    if (!regName.trim()) {
      setSearchError('Please enter your full name.');
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          age: parseInt(regAge) || 32,
          gender: regGender,
          phone: regPhone || '+91 98000 00000',
        }),
      });
      const created = await res.json();
      selectPatient(created);
    } catch (e) {
      setSearchError('Failed to register. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Consent Audio
  const handleListenConsent = () => {
    setIsReadingConsent(true);
    const textToSpeak = language === 'hi'
      ? `${t.consentTitle}. ${t.consentText1} ${t.consentText2} ${t.consentText3}`
      : `${t.consentTitle}. ${t.consentText1} ${t.consentText2} ${t.consentText3}`;

    speakText(textToSpeak);
  };

  const handleConsentDecision = async (agreed: boolean) => {
    setConsentGiven(agreed);
    if (!agreed) {
      alert('Consent is required to proceed with case-taking.');
      return;
    }

    if (activeIntake) {
      // Save consent to backend
      await fetch(`/api/intakes/${activeIntake.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: intakeMode,
          language,
          consent: {
            given: true,
            timestamp: new Date().toISOString(),
            version: 'v2.1-AYUSH',
            language,
          },
        }),
      });
    }

    setStep(3); // Proceed to Clinical Questions
  };

  // Voice Recognition Simulation / Web Speech API
  const toggleVoiceInput = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    // Check if webkitSpeechRecognition is available
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = language === 'hi' ? 'hi-IN' : 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        setIsListening(true);
        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setRecognizedSpeech(transcript);
          setCurrentTextAnswer(transcript);
          setIsListening(false);
        };
        recognition.onerror = () => {
          setIsListening(false);
          // Fallback simulation
          fallbackSimulateSpeech();
        };
        recognition.onend = () => setIsListening(false);
        recognition.start();
        return;
      } catch (e) {
        // Fallback to simulation
      }
    }

    fallbackSimulateSpeech();
  };

  const fallbackSimulateSpeech = () => {
    setIsListening(true);
    setIsProcessingVoice(true);

    setTimeout(() => {
      const curQ = questionsList[currentQuestionIndex];
      let sample = language === 'hi'
        ? (curQ.optionsHi[0] || 'मुझे पिछले दो दिनों से परेशानी है।')
        : (curQ.optionsEn[0] || 'I have been having pain since yesterday.');

      setRecognizedSpeech(sample);
      setCurrentTextAnswer(sample);
      setIsListening(false);
      setIsProcessingVoice(false);
    }, 1500);
  };

  // Handle Question Answer Submission
  const handleSaveCurrentAnswer = async () => {
    if (!currentTextAnswer.trim()) return;

    const currentQ = questionsList[currentQuestionIndex];
    const updatedAnswers = {
      ...collectedAnswers,
      [currentQ.id]: currentTextAnswer.trim(),
    };
    setCollectedAnswers(updatedAnswers);

    // Live Check for red flags
    const checkRes = await fetch('/api/ai/check-red-flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: currentTextAnswer }),
    });
    const checkData = await checkRes.json();
    if (checkData.triggered) {
      setRedFlagNotice(t.redFlagWarning);
    }

    // Check if next question exists
    if (currentQuestionIndex < questionsList.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setCurrentTextAnswer('');
      setRecognizedSpeech(null);
    } else {
      // Questions completed, advance to Document Digitization
      setStep(4);
    }
  };

  // Upload/Process Demo Medical Document
  const handleProcessDocument = async (sampleName: string, sampleType: any) => {
    setIsProcessingDoc(true);
    try {
      const res = await fetch('/api/documents/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docName: sampleName,
          docType: sampleType,
        }),
      });
      const data = await res.json();

      const newDoc: MedicalDocument = {
        id: `DOC-${Date.now().toString().slice(-4)}`,
        name: sampleName,
        type: sampleType,
        date: data.extracted.date || new Date().toISOString().split('T')[0],
        facility: data.extracted.facility,
        doctor: data.extracted.doctor,
        extractedEntities: data.extracted,
        verified: true,
        isDemoSample: true,
      };

      setDocumentsList(prev => [...prev, newDoc]);
      setSelectedDocForCorrection(newDoc);
    } catch (e) {
      console.error('Doc OCR failed:', e);
    } finally {
      setIsProcessingDoc(false);
    }
  };

  // Final Complete Submission
  const handleSubmitIntake = async () => {
    if (!activeIntake) return;
    setIsSubmitting(true);

    try {
      // Build structured payload from collected answers
      const chiefComplaint = collectedAnswers['q_cc'] || 'Chest discomfort with heaviness';
      const hpiOnset = collectedAnswers['q_hpi_onset'] || 'Started 2 hours ago';
      const hpiSeverity = collectedAnswers['q_hpi_severity'] || 'Moderate to severe';
      const hpiCombined = `${hpiOnset}. ${hpiSeverity}`;

      const pmh = collectedAnswers['q_pmh'] || 'Hypertension, Dyslipidemia';
      const medsStr = collectedAnswers['q_meds'] || 'Telmisartan 40mg OD';
      const allergyStr = collectedAnswers['q_allergies'] || 'Penicillin (mild hives)';

      // AYUSH specific parameters if collected
      const ayushCollected: AyushData = {};
      if (intakeMode === 'ayush') {
        ayushCollected.agni = collectedAnswers['q_ayush_agni'] || 'Manda Agni (Sluggish)';
        ayushCollected.koshtha = collectedAnswers['q_ayush_koshtha'] || 'Krura Koshtha';
        ayushCollected.prakriti = collectedAnswers['q_ayush_prakriti'] || 'Kapha-Vata';
        ayushCollected.aharaShakti = collectedAnswers['q_ayush_ahara'] || 'Irregular timings';
      }

      const payload = {
        chiefComplaint,
        historyOfPresentIllness: hpiCombined,
        pastMedicalHistory: pmh,
        pastSurgicalHistory: 'Appendectomy (2018)',
        medications: [
          { name: medsStr, dosage: 'Standard', frequency: 'Daily', source: 'Patient verbal report' },
        ],
        allergies: [
          { substance: allergyStr, reaction: 'Reported during kiosk intake', source: 'Patient response' },
        ],
        familyHistory: collectedAnswers['q_family_personal'] || 'Father had early CAD',
        personalHistory: 'Non-smoker',
        ayushData: ayushCollected,
        documents: documentsList,
        mode: intakeMode,
        language,
      };

      const res = await fetch(`/api/intakes/${activeIntake.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        setSubmittedIntake(data.intake);
        onIntakeCompleted(data.intake);
        setStep(7); // Completion Screen
      }
    } catch (e) {
      console.error('Submission failed:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- RENDER CURRENT STEP ---

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto">
      {/* Top Header & Section Switcher */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setSectionView('directory')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                sectionView === 'directory' || sectionView === 'profile' || sectionView === 'report_view'
                  ? 'bg-white text-teal-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-teal-600" />
              <span>Patient Directory ({patientList.length || 20})</span>
            </button>
            <button
              onClick={() => {
                setSectionView('kiosk_flow');
                if (step === 1 && !activePatient) {
                  // Ready for self check-in
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                sectionView === 'kiosk_flow'
                  ? 'bg-white text-teal-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>Self-Service Kiosk</span>
            </button>
          </div>

          {sectionView === 'kiosk_flow' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200">
                {t.stepOf(step, 6)}
              </span>
              <span className="text-xs font-semibold text-slate-700 hidden md:inline">
                {step === 1 && 'Patient Identification'}
                {step === 2 && 'Language & Consent'}
                {step === 3 && 'Clinical Case-Taking Interview'}
                {step === 4 && 'Medical Records & OCR Digitization'}
                {step === 5 && 'Information Review & Correction'}
                {step === 6 && 'Doctor-Ready Clinical Summary'}
                {step === 7 && 'Intake Submitted'}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {activePatient && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 text-[11px]">Selected:</span>
              <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 font-mono">
                {activePatient.name} ({activePatient.id})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* VIEW 1: PATIENT DIRECTORY */}
      {sectionView === 'directory' && (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto w-full">
          <PatientDirectory
            patients={patientList}
            isLoading={isLoadingPatients}
            onSelectPatient={handleSelectPatientProfile}
            onRefresh={loadPatients}
          />
        </div>
      )}

      {/* VIEW 2: PATIENT PROFILE VIEW */}
      {sectionView === 'profile' && selectedProfilePatient && (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto w-full">
          <PatientProfileView
            patient={selectedProfilePatient}
            onBack={() => setSectionView('directory')}
            onStartInterview={handleStartInterviewFromProfile}
            onViewReport={handleViewReportFromProfile}
            onNavigateToDoctor={onNavigateToDoctor}
          />
        </div>
      )}

      {/* VIEW 3: REPORT VIEW */}
      {sectionView === 'report_view' && viewingReport && (
        <div className="p-4 sm:p-8 max-w-6xl mx-auto w-full space-y-4">
          <button
            onClick={() => setSectionView('profile')}
            className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-slate-900 px-3 py-2 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Patient Profile</span>
          </button>
          <PreConsultationReportView
            report={viewingReport}
            language={language}
            onProceedToDoctor={() => selectedProfilePatient && onNavigateToDoctor(selectedProfilePatient.id)}
          />
        </div>
      )}

      {/* VIEW 4: KIOSK FLOW (STEPS 1-7) */}
      {sectionView === 'kiosk_flow' && (
        <div className="flex-grow flex items-center justify-center p-4 sm:p-8">
          <div className={`w-full ${step === 3 || step === 6 ? 'max-w-6xl' : 'max-w-3xl'} ${step === 3 ? 'bg-transparent border-none p-0 shadow-none' : 'bg-white border border-slate-200 rounded-3xl shadow-sm p-6 sm:p-10'} relative`}>

          {/* STEP 1: IDENTIFICATION */}
          {step === 1 && (
            <div className="flex flex-col">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-teal-50 text-teal-700 rounded-2xl flex items-center justify-center text-xl font-bold mx-auto mb-3 border border-teal-200">
                  01
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Patient Identification</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Connect via National Health Authority ABHA ID, Aadhaar OTP Demo, or register.
                </p>
              </div>

              {/* Sub-Tabs: ABHA, Aadhaar, Register, QR */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl mb-6 border border-slate-200 text-xs font-semibold">
                <button
                  onClick={() => { setIdTab('abha'); setSearchError(''); }}
                  className={`py-2 rounded-lg transition-all ${idTab === 'abha' ? 'bg-white text-teal-900 shadow-xs' : 'text-slate-600'}`}
                >
                  ABHA ID
                </button>
                <button
                  onClick={() => { setIdTab('aadhaar'); setSearchError(''); }}
                  className={`py-2 rounded-lg transition-all ${idTab === 'aadhaar' ? 'bg-white text-teal-900 shadow-xs' : 'text-slate-600'}`}
                >
                  Aadhaar OTP
                </button>
                <button
                  onClick={() => { setIdTab('register'); setSearchError(''); }}
                  className={`py-2 rounded-lg transition-all ${idTab === 'register' ? 'bg-white text-teal-900 shadow-xs' : 'text-slate-600'}`}
                >
                  New Patient
                </button>
                <button
                  onClick={() => { setIdTab('qr'); setSearchError(''); }}
                  className={`py-2 rounded-lg transition-all ${idTab === 'qr' ? 'bg-white text-teal-900 shadow-xs' : 'text-slate-600'}`}
                >
                  Scan QR
                </button>
              </div>

              {/* TAB CONTENT: ABHA */}
              {idTab === 'abha' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Ayushman Bharat Health Account (ABHA Address)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. 9876543210 or yourname@abdm"
                        value={abhaInput}
                        onChange={e => setAbhaInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearchAbha()}
                        className="flex-1 px-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <button
                        onClick={handleSearchAbha}
                        disabled={isSearching}
                        className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition-all flex items-center gap-2 cursor-pointer"
                      >
                        {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        <span>Verify</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB CONTENT: AADHAAR OTP */}
              {idTab === 'aadhaar' && (
                <div className="space-y-4">
                  {!aadhaarOtpSent ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Aadhaar Number (Last 4 Digits for Verification)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={4}
                          placeholder="e.g. 4821"
                          value={aadhaarInput}
                          onChange={e => setAadhaarInput(e.target.value)}
                          className="flex-1 px-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono tracking-widest text-lg text-center"
                        />
                        <button
                          onClick={handleSendOtp}
                          className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition-all"
                        >
                          Send OTP
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800">
                        OTP sent to registered mobile linked with Aadhaar (Verification Code: 4821)
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Enter 4-digit OTP</label>
                        <input
                          type="text"
                          maxLength={4}
                          value={otpInput}
                          onChange={e => setOtpInput(e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm text-center font-mono tracking-widest text-lg"
                        />
                      </div>
                      <button
                        onClick={handleVerifyOtp}
                        disabled={isSearching}
                        className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition-all"
                      >
                        Verify OTP & Access Intake
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB CONTENT: REGISTER NEW */}
              {idTab === 'register' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Full Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Sunita Devi"
                        value={regName}
                        onChange={e => setRegName(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Age</label>
                      <input
                        type="number"
                        placeholder="e.g. 45"
                        value={regAge}
                        onChange={e => setRegAge(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Gender</label>
                      <select
                        value={regGender}
                        onChange={e => setRegGender(e.target.value as any)}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm bg-white"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mobile Number</label>
                      <input
                        type="tel"
                        placeholder="e.g. +91 98765 00000"
                        value={regPhone}
                        onChange={e => setRegPhone(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleRegisterPatient}
                    disabled={isSearching}
                    className="w-full mt-2 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Register & Start Intake</span>
                  </button>
                </div>
              )}

              {/* TAB CONTENT: QR QUICK IDENTIFICATION */}
              {idTab === 'qr' && (
                <div className="text-center py-4 space-y-4">
                  <div className="w-40 h-40 mx-auto bg-slate-100 border-2 border-dashed border-teal-500 rounded-2xl flex flex-col items-center justify-center p-4">
                    <QrCode className="w-16 h-16 text-teal-600 mb-2 animate-pulse" />
                    <span className="text-[10px] font-mono text-slate-600">ABDM-TOKEN-SCAN</span>
                  </div>
                  <div className="max-w-md mx-auto text-xs text-slate-500">
                    <p className="font-semibold text-slate-700">Scan ABHA Health Locker QR</p>
                    <p className="mt-1">
                      Hold your ABHA mobile application or Ayushman Bharat card QR code in front of the kiosk optical scanner.
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      setIsSearching(true);
                      try {
                        const res = await fetch('/api/patients');
                        if (res.ok) {
                          const list = await res.json();
                          if (list && list.length > 0) {
                            selectPatient(list[0]);
                          } else {
                            setSearchError('No existing patient record found. Please register as new patient.');
                          }
                        } else {
                          setSearchError('QR scanner read timeout. Please scan again or enter ABHA address.');
                        }
                      } catch {
                        setSearchError('Failed to read QR code. Please use ABHA address or Mobile OTP.');
                      } finally {
                        setIsSearching(false);
                      }
                    }}
                    disabled={isSearching}
                    className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 mx-auto"
                  >
                    {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <QrCode className="w-3.5 h-3.5" />}
                    <span>Simulate Scanner Read</span>
                  </button>
                </div>
              )}

              {/* Error Notice */}
              {searchError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center justify-between">
                  <span>{searchError}</span>
                  <button
                    onClick={() => setIdTab('register')}
                    className="underline font-bold text-red-800 text-[11px]"
                  >
                    Register as New Patient
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: LANGUAGE & CONSENT */}
          {step === 2 && activePatient && (
            <div className="flex flex-col">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-teal-50 text-teal-700 rounded-2xl flex items-center justify-center text-xl font-bold mx-auto mb-3 border border-teal-200">
                  02
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  {t.consentTitle}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Selected Patient: <strong className="text-slate-900">{activePatient.name}</strong> ({activePatient.id})
                </p>
              </div>

              {/* Language Selection */}
              <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                  Choose Preferred Language / भाषा चुनें
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setLanguage('en')}
                    className={`p-3 rounded-xl border-2 font-bold text-sm text-center transition-all cursor-pointer ${
                      language === 'en'
                        ? 'border-teal-600 bg-white text-teal-900 shadow-sm'
                        : 'border-slate-200 bg-slate-100 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    English (Standard)
                  </button>
                  <button
                    onClick={() => setLanguage('hi')}
                    className={`p-3 rounded-xl border-2 font-bold text-sm text-center transition-all cursor-pointer ${
                      language === 'hi'
                        ? 'border-teal-600 bg-white text-teal-900 shadow-sm'
                        : 'border-slate-200 bg-slate-100 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    हिन्दी (Hindi)
                  </button>
                </div>
              </div>

              {/* Intake Mode: General vs AYUSH (Ministry of Ayush / AIIA PS Requirement) */}
              <div className="mb-6 p-4 bg-amber-50/60 rounded-2xl border border-amber-200">
                <label className="block text-xs font-bold text-amber-900 uppercase mb-2">
                  Clinical Intake Mode (Ministry of Ayush / AIIA)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setIntakeMode('general')}
                    className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      intakeMode === 'general'
                        ? 'border-teal-600 bg-white shadow-sm'
                        : 'border-amber-200/60 bg-amber-50/50 text-slate-600'
                    }`}
                  >
                    <p className="text-xs font-bold text-slate-900">General Medicine</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Chief complaint, HPI, PMH, Meds, Systems</p>
                  </button>

                  <button
                    onClick={() => setIntakeMode('ayush')}
                    className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      intakeMode === 'ayush'
                        ? 'border-teal-600 bg-white shadow-sm'
                        : 'border-amber-200/60 bg-amber-50/50 text-slate-600'
                    }`}
                  >
                    <p className="text-xs font-bold text-teal-900">AYUSH / AIIA Intake</p>
                    <p className="text-[11px] text-teal-700 mt-0.5">Dashavidha Pariksha, Agni, Koshtha, Prakriti</p>
                  </button>
                </div>
              </div>

              {/* Plain Language Consent Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-6 text-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                    {t.consent}
                  </span>
                  <button
                    onClick={handleListenConsent}
                    className="flex items-center gap-1.5 text-xs text-teal-700 hover:text-teal-900 font-bold cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4 text-teal-600" />
                    <span>{t.listenConsent}</span>
                  </button>
                </div>

                <p className="text-sm leading-relaxed">{t.consentText1}</p>
                <p className="text-sm leading-relaxed">{t.consentText2}</p>
                <p className="text-xs text-slate-500">{t.consentText3}</p>
              </div>

              {/* Consent Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleConsentDecision(false)}
                  className="py-4 border-2 border-slate-200 hover:border-slate-300 text-slate-700 font-bold rounded-2xl text-sm transition-all cursor-pointer"
                >
                  {t.disagree}
                </button>
                <button
                  onClick={() => handleConsentDecision(true)}
                  className="py-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-sm shadow-md transition-all cursor-pointer hover:scale-[1.01]"
                >
                  {t.agree}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: AI MEDICAL CLINICAL INTERVIEW CHATBOT */}
          {step === 3 && activePatient && (
            <AIClinicalChatbot
              patient={activePatient}
              language={language}
              mode={intakeMode}
              onReportGenerated={(report, intake) => {
                setGeneratedClinicalReport(report);
                setActiveIntake(intake);
                setSubmittedIntake(intake);
                onIntakeCompleted(intake);
                setStep(6);
              }}
              onBack={() => setStep(2)}
            />
          )}

          {/* STEP 4: MEDICAL DOCUMENTS & OCR DIGITIZATION */}
          {step === 4 && (
            <div className="flex flex-col">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-teal-50 text-teal-700 rounded-2xl flex items-center justify-center text-xl font-bold mx-auto mb-3 border border-teal-200">
                  04
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Previous Medical Records & OCR</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Upload prescriptions, lab reports, or discharge summaries for automated entity extraction.
                </p>
              </div>

              {/* Sample demo documents to upload in 1-click */}
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                  Select Demo Medical Record to Digitize
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => handleProcessDocument('AIIMS_Cardiology_Prescription_2025.pdf', 'Prescription')}
                    disabled={isProcessingDoc}
                    className="p-3 bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-400 rounded-xl text-left transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-teal-700 font-bold text-xs mb-1">
                      <FileText className="w-4 h-4" />
                      <span>Cardio Prescription</span>
                    </div>
                    <p className="text-[11px] text-slate-500">Telmisartan, Rosuvastatin, HTN Stage 1</p>
                  </button>

                  <button
                    onClick={() => handleProcessDocument('Comprehensive_Metabolic_Panel_Lab_Report.pdf', 'Lab Report')}
                    disabled={isProcessingDoc}
                    className="p-3 bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-400 rounded-xl text-left transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-blue-700 font-bold text-xs mb-1">
                      <FileText className="w-4 h-4" />
                      <span>Lab Blood Panel</span>
                    </div>
                    <p className="text-[11px] text-slate-500">FBS 118 mg/dL, HbA1c 6.1%, Creatinine 0.92</p>
                  </button>

                  <button
                    onClick={() => handleProcessDocument('Apex_Hospital_Discharge_Summary.pdf', 'Discharge Summary')}
                    disabled={isProcessingDoc}
                    className="p-3 bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-400 rounded-xl text-left transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-amber-700 font-bold text-xs mb-1">
                      <FileText className="w-4 h-4" />
                      <span>Discharge Summary</span>
                    </div>
                    <p className="text-[11px] text-slate-500">Laparoscopic Appendectomy, Cefixime</p>
                  </button>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-slate-200 hover:border-teal-500 rounded-2xl p-6 text-center mb-6 transition-colors bg-slate-50">
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">Drag & drop your prescription or report here</p>
                <p className="text-[10px] text-slate-400 mt-1">Supports PDF, JPEG, PNG (Max 10MB)</p>
                <button
                  onClick={() => handleProcessDocument('Scanned_Prescription_Record.jpg', 'Prescription')}
                  className="mt-3 px-4 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Browse File
                </button>
              </div>

              {/* Loading indicator */}
              {isProcessingDoc && (
                <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl flex items-center gap-3 mb-6 animate-pulse text-xs text-teal-800 font-semibold">
                  <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
                  <span>Processing OCR and extracting medical entities from document...</span>
                </div>
              )}

              {/* Display Processed Documents & Entity Review */}
              {documentsList.length > 0 && (
                <div className="mb-6 space-y-3">
                  <span className="text-xs font-bold uppercase text-slate-600 tracking-wider">
                    Digitized Documents ({documentsList.length})
                  </span>

                  {documentsList.map((doc, i) => (
                    <div key={i} className="p-4 bg-white border border-teal-200 rounded-xl shadow-xs">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-teal-600" />
                          <span className="font-bold text-xs text-slate-900">{doc.name}</span>
                          <span className="text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded border border-teal-200">
                            {doc.type}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">{doc.date}</span>
                      </div>

                      {/* Extracted Entities */}
                      <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1 text-slate-700">
                        {doc.extractedEntities.diagnosis && (
                          <p>
                            <strong>Diagnosis:</strong> {doc.extractedEntities.diagnosis}
                          </p>
                        )}
                        {doc.extractedEntities.medications?.length ? (
                          <p>
                            <strong>Medications:</strong>{' '}
                            {doc.extractedEntities.medications.map(m => `${m.name} ${m.dosage}`).join(', ')}
                          </p>
                        ) : null}
                        {doc.extractedEntities.labTests?.length ? (
                          <p>
                            <strong>Key Lab Values:</strong>{' '}
                            {doc.extractedEntities.labTests.map(l => `${l.testName}: ${l.value} ${l.unit}`).join('; ')}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Navigation Controls */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button
                  onClick={() => setStep(3)}
                  className="flex items-center gap-1 px-4 py-2.5 text-slate-600 hover:text-slate-900 font-bold text-xs cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{t.back}</span>
                </button>

                <button
                  onClick={() => setStep(5)}
                  className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <span>Review Case Intake</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW & PATIENT CORRECTION */}
          {step === 5 && (
            <div className="flex flex-col">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-teal-50 text-teal-700 rounded-2xl flex items-center justify-center text-xl font-bold mx-auto mb-3 border border-teal-200">
                  05
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  {t.review}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Verify your information before submitting to the physician queue.
                </p>
              </div>

              {/* Review Cards */}
              <div className="space-y-4 mb-6 text-xs text-slate-800">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-500 uppercase">{t.currentProblem}</span>
                    <button onClick={() => { setStep(3); setCurrentQuestionIndex(0); }} className="text-teal-700 font-bold underline">Edit</button>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {collectedAnswers['q_cc'] || 'Chest discomfort with heaviness'}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    {collectedAnswers['q_hpi_onset'] || 'Started 2 hours ago'} • {collectedAnswers['q_hpi_severity'] || 'Moderate to severe'}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-500 uppercase">{t.medicalHistory}</span>
                    <button onClick={() => { setStep(3); setCurrentQuestionIndex(3); }} className="text-teal-700 font-bold underline">Edit</button>
                  </div>
                  <p>{collectedAnswers['q_pmh'] || 'Hypertension (2 years), Dyslipidemia'}</p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-500 uppercase">{t.medicines} & {t.allergies}</span>
                    <button onClick={() => { setStep(3); setCurrentQuestionIndex(4); }} className="text-teal-700 font-bold underline">Edit</button>
                  </div>
                  <p><strong>Daily Medicines:</strong> {collectedAnswers['q_meds'] || 'Telmisartan 40mg OD'}</p>
                  <p className="mt-1"><strong>Known Allergies:</strong> {collectedAnswers['q_allergies'] || 'Penicillin (mild hives)'}</p>
                </div>

                {intakeMode === 'ayush' && (
                  <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl">
                    <span className="font-bold text-amber-900 uppercase">AYUSH Dashavidha Pariksha Summary</span>
                    <p className="mt-1 text-slate-700">
                      <strong>Agni:</strong> {collectedAnswers['q_ayush_agni'] || 'Manda Agni'} | <strong>Koshtha:</strong> {collectedAnswers['q_ayush_koshtha'] || 'Krura Koshtha'} | <strong>Prakriti:</strong> {collectedAnswers['q_ayush_prakriti'] || 'Kapha-Vata'}
                    </p>
                  </div>
                )}

                {documentsList.length > 0 && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="font-bold text-slate-500 uppercase">{t.previousReports}</span>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5 text-slate-700">
                      {documentsList.map((d, i) => (
                        <li key={i}>{d.name} ({d.type}) — {d.extractedEntities.diagnosis || 'Digitized'}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button
                  onClick={() => setStep(4)}
                  className="flex items-center gap-1 px-4 py-2.5 text-slate-600 hover:text-slate-900 font-bold text-xs cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{t.back}</span>
                </button>

                <button
                  onClick={() => setStep(6)}
                  className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <span>Generate Summary</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: AI CLINICAL SUMMARY & PRE-CONSULTATION REPORT */}
          {step === 6 && (
            <div className="flex flex-col">
              {generatedClinicalReport ? (
                <PreConsultationReportView
                  report={generatedClinicalReport}
                  language={language}
                  onProceedToDoctor={() => {
                    if (activePatient) {
                      onNavigateToDoctor(activePatient.id);
                    }
                  }}
                />
              ) : (
                <>
                  <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-teal-50 text-teal-700 rounded-2xl flex items-center justify-center text-xl font-bold mx-auto mb-3 border border-teal-200">
                      06
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                      Doctor-Ready Clinical Summary (Draft)
                    </h2>
                    <div className="inline-block mt-1 px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold uppercase rounded-md">
                      DRAFT ONLY • NOT A FINAL DIAGNOSIS • PHYSICIAN VERIFICATION REQUIRED
                    </div>
                  </div>

                  {/* Summary Presentation Box with Evidence Traceability */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-6 text-xs text-slate-800 space-y-3 font-sans">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="font-bold uppercase tracking-wider text-slate-500">
                        MediKiosk Automated Synthesis
                      </span>
                      <span className="font-mono text-[11px] text-teal-700 font-bold">Version 1.0 (Pre-Consult)</span>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 uppercase text-[11px]">Chief Complaint</h4>
                      <p className="mt-0.5 text-slate-700">{collectedAnswers['q_cc'] || 'Chest discomfort with radiation to left shoulder'}</p>
                      <span className="text-[10px] text-teal-700 italic">Source: Patient Voice/Touch Intake</span>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 uppercase text-[11px]">History of Present Illness</h4>
                      <p className="mt-0.5 text-slate-700">{collectedAnswers['q_hpi_onset'] || 'Started 2 hours ago'} {collectedAnswers['q_hpi_severity'] || 'Moderate distress'}</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 uppercase text-[11px]">Medications & Allergies</h4>
                      <p className="mt-0.5 text-slate-700">
                        {collectedAnswers['q_meds'] || 'Telmisartan 40mg OD'} | Allergies: {collectedAnswers['q_allergies'] || 'Penicillin'}
                      </p>
                      <span className="text-[10px] text-teal-700 italic">Source: Verbal intake & Scanned Prescription</span>
                    </div>

                    {intakeMode === 'ayush' && (
                      <div>
                        <h4 className="font-bold text-teal-900 uppercase text-[11px]">AYUSH Parameters</h4>
                        <p className="mt-0.5 text-slate-700">
                          Prakriti: Kapha-Vata • Agni: Manda Agni • Koshtha: Krura Koshtha
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Submission Action */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                    <button
                      onClick={() => setStep(5)}
                      className="flex items-center gap-1 px-4 py-2.5 text-slate-600 hover:text-slate-900 font-bold text-xs cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>{t.back}</span>
                    </button>

                    <button
                      onClick={handleSubmitIntake}
                      disabled={isSubmitting}
                      className="px-8 py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition-all flex items-center gap-2 shadow-lg shadow-teal-100 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Submitting Intake to Database...</span>
                        </>
                      ) : (
                        <>
                          <span>{t.submit}</span>
                          <CheckCircle2 className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 7: CONFIRMATION & TOKEN DISPLAY */}
          {step === 7 && submittedIntake && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 text-green-700 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-green-300">
                <Check className="w-8 h-8" />
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {t.complete}
              </h2>
              <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
                {t.pleaseWaitMessage}
              </p>

              {/* Priority Warning if Red Flag Triggered */}
              {submittedIntake.status === 'RED_FLAG' && (
                <div className="my-6 p-4 bg-red-50 border border-red-300 rounded-2xl text-left max-w-md mx-auto">
                  <div className="flex items-center gap-2 text-red-800 font-bold text-sm mb-1">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span>Priority Clinical Alert Active</span>
                  </div>
                  <p className="text-xs text-red-700 leading-relaxed">
                    {t.redFlagWarning}
                  </p>
                </div>
              )}

              {/* Consultation Token Card */}
              <div className="my-6 p-6 bg-slate-50 border border-slate-200 rounded-2xl max-w-sm mx-auto shadow-sm">
                <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">
                  {t.tokenNumber}
                </span>
                <p className="text-4xl font-black text-teal-800 tracking-wider my-2 font-mono">
                  {submittedIntake.token}
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-600">
                  <span className="font-semibold">{submittedIntake.patientName}</span>
                  <span>•</span>
                  <span>{submittedIntake.department}</span>
                </div>
              </div>

              {/* Actions: View in Doctor Workspace or Start New */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                <button
                  onClick={() => onNavigateToDoctor(submittedIntake.patientId)}
                  className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition-all flex items-center gap-2 shadow-md cursor-pointer hover:scale-[1.02]"
                >
                  <Stethoscope className="w-4 h-4" />
                  <span>Open Doctor Workspace (See this Patient)</span>
                </button>

                <button
                  onClick={() => {
                    setActivePatient(null);
                    setActiveIntake(null);
                    setSubmittedIntake(null);
                    setCollectedAnswers({});
                    setDocumentsList([]);
                    setStep(1);
                  }}
                  className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Start New Intake
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
      )}
    </div>
  );
};
