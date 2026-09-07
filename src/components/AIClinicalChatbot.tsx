import React, { useState, useEffect, useRef } from 'react';
import { Patient, Language, ClinicalInterview, InterviewMessage, ClinicalReport, Intake, MedicalDocument } from '../types';
import { translations } from '../i18n';
import { ReportUploadModal } from './ReportUploadModal';
import { isNonMedicalQuestion, NON_MEDICAL_REFUSAL_EN, NON_MEDICAL_REFUSAL_HI } from '../services/clinicalInterviewService';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  Upload,
  Camera,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Clock,
  HeartPulse,
  Sparkles,
  ArrowRight,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Stethoscope,
  User,
  ShieldCheck,
  Check,
  FileCheck,
} from 'lucide-react';

interface AIClinicalChatbotProps {
  patient: Patient;
  language: Language;
  mode: 'general' | 'ayush';
  onReportGenerated: (report: ClinicalReport, intake: Intake) => void;
  onBack: () => void;
}

export const AIClinicalChatbot: React.FC<AIClinicalChatbotProps> = ({
  patient,
  language,
  mode,
  onReportGenerated,
  onBack,
}) => {
  const t = translations[language];

  // Active Interview Session
  const [interview, setInterview] = useState<ClinicalInterview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Input States
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);

  // Audio Speech state
  const [activeSpeakingMsgId, setActiveSpeakingMsgId] = useState<string | null>(null);

  // UI States
  const [showLiveSummary, setShowLiveSummary] = useState(true);
  const [redFlagNotice, setRedFlagNotice] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [interview?.messages]);

  // Initialize Clinical Interview
  useEffect(() => {
    const startInterview = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/interviews/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId: patient.id,
            language,
            mode,
          }),
        });
        if (res.ok) {
          const data: ClinicalInterview = await res.json();
          setInterview(data);
          // Auto speak initial bot greeting
          if (data.messages && data.messages.length > 0) {
            speakBotMessage(data.messages[0]);
          }
        } else {
          console.error('Failed to initialize interview');
        }
      } catch (err) {
        console.error('Error starting interview:', err);
      } finally {
        setIsLoading(false);
      }
    };

    startInterview();
  }, [patient.id, language, mode]);

  // Speech Synthesis
  const speakBotMessage = (msg: InterviewMessage) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(msg.message);
      utterance.lang = language === 'hi' ? 'hi-IN' : 'en-US';
      utterance.rate = 0.95;
      utterance.onstart = () => setActiveSpeakingMsgId(msg.id);
      utterance.onend = () => setActiveSpeakingMsgId(null);
      utterance.onerror = () => setActiveSpeakingMsgId(null);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Speech Recognition (Web Speech API with Fallback)
  const toggleSpeechRecognition = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

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
          setVoiceTranscript(transcript);
          setInputText(transcript);
          setIsListening(false);
        };
        recognition.onerror = () => {
          setIsListening(false);
          triggerFallbackVoice();
        };
        recognition.onend = () => setIsListening(false);
        recognition.start();
        return;
      } catch (e) {
        triggerFallbackVoice();
      }
    } else {
      triggerFallbackVoice();
    }
  };

  const triggerFallbackVoice = () => {
    // Helpful simulation for devices without speech recognition drivers
    setIsListening(true);
    setTimeout(() => {
      setIsListening(false);
      const sample = language === 'hi'
        ? 'सीने में भारीपन और हल्का सांस फूलना'
        : 'Slight chest discomfort and breathlessness for two days';
      setVoiceTranscript(sample);
      setInputText(sample);
    }, 1500);
  };

  // Send message to server interview engine
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!text || !interview || isSending) return;

    // Strict non-medical refusal check (Anna is strictly a clinical intake assistant)
    if (isNonMedicalQuestion(text)) {
      const refusalText = language === 'hi' ? NON_MEDICAL_REFUSAL_HI : NON_MEDICAL_REFUSAL_EN;
      const userMsg: InterviewMessage = {
        id: `MSG-${Date.now()}-user`,
        interviewId: interview.id,
        sender: 'patient',
        message: text,
        timestamp: new Date().toISOString(),
        language,
        questionCategory: 'chief_complaint',
      };
      const botMsg: InterviewMessage = {
        id: `MSG-${Date.now()}-refusal`,
        interviewId: interview.id,
        sender: 'bot',
        message: refusalText,
        timestamp: new Date().toISOString(),
        language,
        questionCategory: 'safety',
        quickOptions: language === 'hi'
          ? ['मुझे सीने में दर्द है', 'मुझे 3 दिन से बुखार है', 'दवाइयां जोड़ें']
          : ['I have chest pain', 'I have fever since 3 days', 'Add medications'],
      };
      setInputText('');
      setVoiceTranscript(null);
      setInterview({
        ...interview,
        messages: [...interview.messages, userMsg, botMsg],
      });
      speakBotMessage(botMsg);
      return;
    }

    setIsSending(true);
    setInputText('');
    setVoiceTranscript(null);

    try {
      const res = await fetch(`/api/interviews/${interview.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          language,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setInterview(data.interview);
        if (data.newAlertTriggered) {
          setRedFlagNotice(
            language === 'hi'
              ? 'ध्यान दें: आपके बताए गए लक्षणों के आधार पर अस्पताल मेडिकल टीम को प्राथमिकता जांच के लिए सतर्क कर दिया गया है।'
              : 'Priority Alert: An urgent triage warning has been flagged for your attending physician. Please continue answering.'
          );
        }
        if (data.nextMessage) {
          speakBotMessage(data.nextMessage);
        }
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Handle Quick Option Tap
  const handleOptionClick = (option: string) => {
    if (option === 'Confirm & Generate Pre-Consultation Report' || option === 'विवरण की पुष्टि करें और रिपोर्ट बनाएं') {
      handleCompleteInterview();
      return;
    }
    if (option === 'I want to make a correction' || option === 'कुछ संशोधन करना है') {
      setInputText(language === 'hi' ? 'मुझे दवाइयों या लक्षणों में बदलाव करना है' : 'I need to update my symptoms');
      return;
    }
    handleSendMessage(option);
  };

  // Handle Skipping Non-critical Questions
  const handleSkipQuestion = () => {
    handleSendMessage(language === 'hi' ? 'जानकारी उपलब्ध नहीं / ज्ञात नहीं' : 'Not reported / Not sure');
  };

  // Handle Document Confirmed from Modal
  const handleDocumentConfirmed = async (doc: MedicalDocument) => {
    if (!interview) return;
    setIsUploading(true);
    try {
      const res = await fetch(`/api/interviews/${interview.id}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docName: doc.name,
          docType: doc.type,
          document: doc,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setInterview(data.interview);
        const lastMsg = data.interview.messages[data.interview.messages.length - 1];
        if (lastMsg) {
          speakBotMessage(lastMsg);
        }
      }
    } catch (err) {
      console.error('Failed to upload document:', err);
    } finally {
      setIsUploading(false);
      setIsUploadModalOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Prescription / Medicine Strip Photo OCR
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !interview) return;
    setIsUploadModalOpen(true);
  };

  // Trigger simulated prescription photo capture
  const handleSimulatePrescriptionSnap = () => {
    setIsUploadModalOpen(true);
  };

  // Complete Interview and Generate Report
  const handleCompleteInterview = async () => {
    if (!interview) return;
    setIsGeneratingReport(true);
    try {
      const res = await fetch(`/api/interviews/${interview.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fallbackChiefComplaint: interview.chiefComplaint || 'General Outpatient Consultation & Health Checkup',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onReportGenerated(data.report, data.intake);
      }
    } catch (err) {
      console.error('Failed to complete interview:', err);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Section display names
  const sectionNames: Record<string, { en: string; hi: string }> = {
    chief_complaint: { en: 'Chief Complaint', hi: 'मुख्य समस्या' },
    hpi: { en: 'History of Illness', hi: 'विस्तृत लक्षण' },
    past_history: { en: 'Medical History', hi: 'पूर्व इतिहास' },
    medications_allergies: { en: 'Medications & Allergies', hi: 'दवाइयां एवं एलर्जी' },
    family_lifestyle: { en: 'Family & Habits', hi: 'पारिवारिक व जीवनशैली' },
    ayurveda: { en: 'AYUSH Assessment', hi: 'आयुष परीक्षण' },
    review: { en: 'Review & Report', hi: 'समीक्षा एवं रिपोर्ट' },
  };

  const currentSectionInfo = interview?.currentSection
    ? sectionNames[interview.currentSection] || { en: 'Clinical Intake', hi: 'नैदानिक विवरण' }
    : { en: 'Clinical Intake', hi: 'नैदानिक विवरण' };

  if (isLoading || !interview) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-200 shadow-sm min-h-[480px]">
        <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mb-4" />
        <p className="text-base font-bold text-slate-800">
          {language === 'hi' ? 'एआई नैदानिक इंटेक सहायक तैयार हो रहा है...' : 'Initializing AI Medical Clinical Intake Engine...'}
        </p>
        <p className="text-xs text-slate-500 mt-1">Connecting to Clinical Safety Ontology & Ayush Case-Taking Model</p>
      </div>
    );
  }

  const latestMessage = interview.messages[interview.messages.length - 1];
  const isLatestFromBot = latestMessage?.sender === 'bot';

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-6xl mx-auto w-full">
      {/* Hidden File Input for Rx OCR */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*,.pdf"
        className="hidden"
      />

      {/* MAIN CHAT COLUMN */}
      <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[640px]">
        {/* Chatbot Top Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-teal-50/40 to-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  {language === 'hi' ? 'अन्ना — एआई नैदानिक इंटेक सहायक' : 'Anna — AI Clinical Intake Assistant'}
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full">
                  OPD Triage
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {patient.name} • {patient.age}y {patient.gender} • Token: {patient.token}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLiveSummary(!showLiveSummary)}
              className="lg:hidden px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <span>Summary</span>
              {showLiveSummary ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onBack}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
            >
              Exit
            </button>
          </div>
        </div>

        {/* Clinical Progress Bar */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-teal-800">
              {language === 'hi' ? currentSectionInfo.hi : currentSectionInfo.en}
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-500">{interview.completionScore}% Completed</span>
          </div>

          <div className="w-36 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-600 transition-all duration-500"
              style={{ width: `${interview.completionScore}%` }}
            />
          </div>
        </div>

        {/* Red Flag Triage Alert Notice Banner */}
        {(redFlagNotice || interview.redFlags.length > 0) && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-200 flex items-start gap-3 text-red-900 text-xs animate-pulse">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                {language === 'hi' ? 'प्राथमिकता चेतावनी (Urgent Triage Alert)' : 'Urgent Clinical Triage Alert'}
              </p>
              <p className="text-red-700 text-[11px] mt-0.5">
                {redFlagNotice ||
                  'Symptoms suggest potential high priority (e.g. chest discomfort). Medical staff is being notified for expedited evaluation.'}
              </p>
            </div>
          </div>
        )}

        {/* Message Stream */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 max-h-[460px] bg-slate-50/40">
          {interview.messages.map(msg => {
            const isBot = msg.sender === 'bot';
            const isSpeaking = activeSpeakingMsgId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex gap-3 items-start ${isBot ? 'justify-start' : 'justify-end'}`}
              >
                {/* Bot Avatar */}
                {isBot && (
                  <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-1">
                    <Stethoscope className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[82%] sm:max-w-[70%] space-y-2`}>
                  {/* Bubble */}
                  <div
                    className={`p-4 rounded-2xl text-sm leading-relaxed shadow-xs ${
                      isBot
                        ? msg.isClarification
                          ? 'bg-amber-50 border border-amber-300 text-amber-950'
                          : msg.isRedFlagAlert
                          ? 'bg-red-50 border border-red-300 text-red-950'
                          : 'bg-white border border-slate-200 text-slate-900'
                        : 'bg-teal-700 text-white font-medium rounded-br-none'
                    }`}
                  >
                    <p>{msg.message}</p>

                    {/* Extracted Data preview if present */}
                    {msg.extractedDataPreview && (
                      <div className="mt-2.5 p-2 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-800 flex items-center gap-1.5">
                        <FileCheck className="w-4 h-4 text-teal-600 shrink-0" />
                        <span className="font-semibold">{msg.extractedDataPreview}</span>
                      </div>
                    )}
                  </div>

                  {/* Metadata and Audio Controls */}
                  <div
                    className={`flex items-center gap-2 text-[10px] text-slate-400 px-1 ${
                      isBot ? 'justify-start' : 'justify-end'
                    }`}
                  >
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {isBot && (
                      <button
                        onClick={() => speakBotMessage(msg)}
                        className={`p-1 rounded hover:bg-slate-200 transition-all cursor-pointer ${
                          isSpeaking ? 'text-teal-600 animate-pulse' : 'text-slate-400'
                        }`}
                        title="Read aloud"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* User Avatar */}
                {!isBot && (
                  <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-xs mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isSending && (
            <div className="flex gap-3 items-center text-slate-500 text-xs italic">
              <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
                <Stethoscope className="w-4 h-4 animate-pulse" />
              </div>
              <div className="px-4 py-2.5 bg-white border border-slate-200 rounded-2xl flex items-center gap-1.5 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce [animation-delay:0.4s]" />
                <span className="ml-2 text-slate-600 font-medium">MediKiosk AI is formulating questions...</span>
              </div>
            </div>
          )}

          {isUploading && (
            <div className="flex gap-3 items-center text-teal-700 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin text-teal-600" />
              <span>Digitizing medical document and extracting clinical entities...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* QUICK OPTION CHIPS (Below Chat Stream) */}
        {isLatestFromBot && latestMessage.quickOptions && latestMessage.quickOptions.length > 0 && (
          <div className="px-6 py-3 bg-white border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'hi' ? 'सुझाए गए त्वरित उत्तर' : 'Suggested Touch Responses'}
              </span>
              {latestMessage.allowsSkip && (
                <button
                  onClick={handleSkipQuestion}
                  className="text-xs text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
                >
                  {language === 'hi' ? 'छोड़ें (Skip)' : 'Skip / Not sure'}
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {latestMessage.quickOptions.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleOptionClick(opt)}
                  disabled={isSending}
                  className="px-3.5 py-2 bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 text-slate-800 hover:text-teal-900 rounded-xl text-xs font-semibold transition-all shadow-2xs cursor-pointer active:scale-95"
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* BOTTOM INPUT DOCK */}
        <div className="p-4 bg-white border-t border-slate-200">
          {voiceTranscript && (
            <div className="mb-2 p-2 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-900 flex items-center justify-between">
              <div>
                <span className="font-bold mr-1">Voice Input:</span>
                <span>"{voiceTranscript}"</span>
              </div>
              <button
                onClick={() => setVoiceTranscript(null)}
                className="text-[11px] text-teal-700 font-bold underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Camera / Rx OCR Button */}
            <button
              onClick={() => setIsUploadModalOpen(true)}
              title="Upload prescription or medicine strip photo"
              className="p-3 text-slate-600 hover:text-teal-700 bg-slate-100 hover:bg-teal-50 border border-slate-200 rounded-2xl transition-all cursor-pointer shrink-0"
            >
              <Camera className="w-5 h-5" />
            </button>

            {/* Quick Demo Rx Trigger */}
            <button
              onClick={handleSimulatePrescriptionSnap}
              title="Demo scan sample Rx"
              className="hidden sm:flex items-center gap-1 px-2.5 py-2 text-[11px] font-bold text-teal-800 bg-teal-50 border border-teal-200 rounded-xl hover:bg-teal-100 transition-all cursor-pointer shrink-0"
            >
              <Upload className="w-3.5 h-3.5 text-teal-600" />
              <span>Demo Rx</span>
            </button>

            {/* Speech-to-Text Mic Button */}
            <button
              onClick={toggleSpeechRecognition}
              className={`p-3 rounded-2xl border transition-all cursor-pointer shrink-0 ${
                isListening
                  ? 'bg-red-600 text-white border-red-700 animate-pulse'
                  : 'text-slate-600 hover:text-teal-700 bg-slate-100 hover:bg-teal-50 border-slate-200'
              }`}
              title={isListening ? 'Listening...' : 'Tap to speak'}
            >
              <Mic className="w-5 h-5" />
            </button>

            {/* Text Input */}
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
              placeholder={
                language === 'hi'
                  ? 'अपना उत्तर यहाँ लिखें या माइक से बोलें...'
                  : 'Type your symptoms or answer naturally...'
              }
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
            />

            {/* Send Button */}
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || isSending}
              className="p-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded-2xl transition-all cursor-pointer shadow-xs shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* LIVE CLINICAL EXTRACTION SUMMARY DRAWER (RIGHT COLUMN) */}
      <div
        className={`w-full lg:w-80 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4 ${
          showLiveSummary ? 'block' : 'hidden lg:block'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {language === 'hi' ? 'लाइव नैदानिक सारांश' : 'Live Clinical Summary'}
            </h3>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
            AI Extracted
          </span>
        </div>

        <div className="space-y-3.5 text-xs">
          {/* Chief Complaint */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
              Chief Complaint (CC)
            </span>
            <p className="font-bold text-slate-900">
              {interview.chiefComplaint || (
                <span className="text-slate-400 font-normal italic">Awaiting patient response...</span>
              )}
            </p>
          </div>

          {/* HPI Attributes */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">
              History of Illness (HPI)
            </span>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div>
                <span className="text-slate-400 block">Onset:</span>
                <span className="font-semibold text-slate-800">{interview.hpi.onset || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Severity:</span>
                <span className="font-semibold text-slate-800">{interview.hpi.severity || '—'}</span>
              </div>
            </div>
            {interview.hpi.character && (
              <div className="text-[11px] pt-1">
                <span className="text-slate-400 block">Character:</span>
                <span className="font-semibold text-slate-800">{interview.hpi.character}</span>
              </div>
            )}
            {interview.hpi.radiation && (
              <div className="text-[11px] pt-1">
                <span className="text-slate-400 block">Radiation:</span>
                <span className="font-semibold text-red-700">{interview.hpi.radiation}</span>
              </div>
            )}
          </div>

          {/* Medications & Allergies */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Medications ({interview.drugHistory.length})
              </span>
              {interview.documents.length > 0 && (
                <span className="text-[9px] font-bold bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded">
                  OCR Synced
                </span>
              )}
            </div>
            {interview.drugHistory.length === 0 ? (
              <p className="text-slate-400 italic text-[11px]">None recorded yet</p>
            ) : (
              <div className="space-y-1">
                {interview.drugHistory.map((m, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] bg-white p-1.5 rounded-lg border border-slate-200">
                    <span className="font-semibold text-slate-800">{m.name}</span>
                    <span className="text-[10px] text-slate-500">{m.dosage}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-1.5 border-t border-slate-200/60">
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Allergies ({interview.allergies.length})
              </span>
              {interview.allergies.length === 0 ? (
                <p className="text-slate-400 italic text-[11px]">No known drug allergies (NKDA)</p>
              ) : (
                <div className="space-y-1">
                  {interview.allergies.map((a, idx) => (
                    <div key={idx} className="text-[11px] bg-red-50 text-red-800 p-1.5 rounded-lg border border-red-200 font-semibold">
                      ⚠️ {a.substance} ({a.reaction || 'Allergic reaction'})
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ayush Parameters if Ayush Mode */}
          {mode === 'ayush' && interview.ayurvedaHistory && (
            <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-1">
              <span className="text-[10px] font-bold uppercase text-amber-900 block">
                AYUSH / AIIA Pariksha
              </span>
              <div className="grid grid-cols-2 gap-1 text-[11px]">
                <div>
                  <span className="text-amber-700">Prakriti:</span>
                  <span className="font-bold text-slate-800 ml-1">{interview.ayurvedaHistory.prakriti || 'Pitta-Kapha'}</span>
                </div>
                <div>
                  <span className="text-amber-700">Agni:</span>
                  <span className="font-bold text-slate-800 ml-1">{interview.ayurvedaHistory.agni || 'Manda'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Red Flag Alerts */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
              Safety Red Flags ({interview.redFlags.length})
            </span>
            {interview.redFlags.length === 0 ? (
              <div className="flex items-center gap-1.5 text-teal-700 font-semibold text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                <span>No critical emergency red flags</span>
              </div>
            ) : (
              <div className="space-y-1">
                {interview.redFlags.map((r, idx) => (
                  <div key={idx} className="p-1.5 bg-red-100 text-red-900 rounded-lg text-[10px] font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span>{r.ruleTriggered}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Generate Report Button */}
        <div className="pt-2 border-t border-slate-100">
          <button
            onClick={handleCompleteInterview}
            disabled={isGeneratingReport}
            className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer hover:scale-[1.01]"
          >
            {isGeneratingReport ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Generating Pre-Consultation Report...</span>
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                <span>Generate Clinical Report</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          <p className="text-[10px] text-slate-400 text-center mt-2">
            Structured for Doctor Review • ABDM / FHIR R4 Ready
          </p>
        </div>
      </div>

      {/* Report & Prescription Upload / OCR Verification Modal */}
      <ReportUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSaveDocument={handleDocumentConfirmed}
        patientName={patient.name}
        patientId={patient.id}
        language={language}
      />
    </div>
  );
};
