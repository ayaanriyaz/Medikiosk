import { ClinicalInterview, InterviewMessage, ClinicalReport, MedicalDocument, Patient, Language } from '../types';

export const NON_MEDICAL_REFUSAL_EN = "I'm Anna, the medical intake assistant. I can only help with health, symptoms, medicines, medical reports, and information needed for your doctor consultation.";
export const NON_MEDICAL_REFUSAL_HI = "मैं अन्ना हूँ, मेडिकल इंटेक सहायक। मैं केवल स्वास्थ्य, लक्षण, दवाइयां, मेडिकल रिपोर्ट और आपके डॉक्टर परामर्श के लिए आवश्यक जानकारी में ही मदद कर सकती हूँ।";

const NON_MEDICAL_TRIGGERS = [
  'weather', 'joke', 'president', 'prime minister', 'cricket', 'football',
  'movie', 'song', 'sing', 'dance', 'recipe', 'cook', 'cooking', 'politics',
  'capital of', 'who are you', 'how are you', 'tell me a story', 'game', 'gaming',
  'bitcoin', 'crypto', 'stock market', 'finance', 'coding', 'program',
  'javascript', 'python', 'write code', 'debug code', 'essay', 'poem',
  'who is the best', 'make me laugh', 'shopping', 'buy phone', 'flight ticket',
  'hotel booking', 'actor', 'actress', 'cinema', 'film', 'election', 'homework',
  'मौसम', 'गाना', 'क्रिकेट', 'चुटकुला', 'कहानी सुनाओ', 'शेयर बाजार', 'राजनीति',
  'फिल्म', 'गाना सुनाओ', 'पॉलिटिक्स', 'एक्टर', 'सिनेमा', 'शॉपिंग', 'होमवर्क'
];

export function isNonMedicalQuestion(text: string): boolean {
  const clean = text.toLowerCase().trim();
  const hasMedicalWord = /pain|fever|cough|vomit|ache|blood|medic|doctor|chest|stomach|head|rash|breath|throat|sugar|bp|pressure|heart|allergy|goli|dawa|dard|bukhar|sirdard|ulti|khansi|saans/i.test(clean);
  if (hasMedicalWord) return false;

  return NON_MEDICAL_TRIGGERS.some(trigger => clean.includes(trigger));
}

export async function startClinicalInterview(patient: Patient, mode: string = 'allopathy'): Promise<ClinicalInterview> {
  const res = await fetch('/api/interviews/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient, mode }),
  });

  if (!res.ok) {
    throw new Error('Failed to start clinical interview session');
  }

  const data = await res.json();
  return data.interview;
}

export async function sendInterviewMessage(
  interviewId: string,
  content: string,
  language: Language = 'en'
): Promise<{ interview: ClinicalInterview; reply: InterviewMessage; isNonMedical?: boolean }> {
  // Client-side quick filter
  if (isNonMedicalQuestion(content)) {
    const refusalText = language === 'hi' ? NON_MEDICAL_REFUSAL_HI : NON_MEDICAL_REFUSAL_EN;
    const reply: InterviewMessage = {
      id: `msg-${Date.now()}`,
      interviewId,
      sender: 'bot',
      message: refusalText,
      timestamp: new Date().toISOString(),
      language,
      questionCategory: 'safety',
      quickOptions: language === 'hi' 
        ? ['मुझे सीने में दर्द है', 'मुझे 3 दिन से बुखार है', 'दवाइयां जोड़ें']
        : ['I have chest pain', 'I have fever since 3 days', 'Add medications'],
    };

    return {
      interview: null as any,
      reply,
      isNonMedical: true,
    };
  }

  const res = await fetch(`/api/interviews/${interviewId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, language }),
  });

  if (!res.ok) {
    throw new Error('Failed to process message');
  }

  const data = await res.json();
  return {
    interview: data.interview,
    reply: data.reply,
    isNonMedical: data.isNonMedical || false,
  };
}

export async function uploadInterviewDocument(
  interviewId: string,
  doc: MedicalDocument
): Promise<{ interview: ClinicalInterview; document: MedicalDocument }> {
  const res = await fetch(`/api/interviews/${interviewId}/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      docName: doc.name,
      docType: doc.type,
      document: doc,
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to upload document');
  }

  const data = await res.json();
  return {
    interview: data.interview,
    document: data.document,
  };
}

export async function completeClinicalInterview(
  interviewId: string
): Promise<{ interview: ClinicalInterview; report: ClinicalReport; intake: any }> {
  const res = await fetch(`/api/interviews/${interviewId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error('Failed to generate clinical report');
  }

  const data = await res.json();
  return {
    interview: data.interview,
    report: data.report,
    intake: data.intake,
  };
}
