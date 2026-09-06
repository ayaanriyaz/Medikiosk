import { ClinicalInterview, InterviewMessage, ClinicalReport, RedFlagAlert, Medication, Allergy, AyushData, Patient } from '../src/types';
import { checkRedFlags } from './clinicalRules';

// Non-medical filter list
const NON_MEDICAL_TRIGGERS = [
  'weather', 'joke', 'president', 'prime minister', 'cricket', 'football',
  'movie', 'song', 'sing', 'dance', 'recipe', 'cook', 'cooking', 'politics',
  'capital of', 'who are you', 'how are you', 'tell me a story', 'game',
  'bitcoin', 'crypto', 'stock market', 'finance', 'coding', 'program',
  'javascript', 'python', 'write code', 'debug code', 'essay', 'poem',
  'who is the best', 'make me laugh', 'translate this sentence',
  'मौसम', 'गाना', 'क्रिकेट', 'चुटकुला', 'कहानी सुनाओ', 'शेयर बाजार', 'राजनीति',
];

export function isNonMedicalQuery(text: string): boolean {
  const clean = text.toLowerCase().trim();
  // If query is explicitly asking about non-medical matters
  return NON_MEDICAL_TRIGGERS.some(trigger => clean.includes(trigger));
}

// Layman question definitions with English and Hindi
export interface AdaptiveQuestion {
  id: string;
  category: 'chief_complaint' | 'hpi' | 'past_history' | 'medications' | 'allergies' | 'family_lifestyle' | 'ayurveda' | 'review';
  textEn: string;
  textHi: string;
  hintEn: string;
  hintHi: string;
  optionsEn: string[];
  optionsHi: string[];
  allowsVoice: boolean;
  allowsSkip: boolean;
  allowsDocumentUpload?: boolean;
}

// Symptom classification for adaptive branching
export function categorizeSymptom(text: string): 'cardiac' | 'respiratory' | 'fever' | 'gastro' | 'neuro' | 'ortho' | 'general' {
  const lower = text.toLowerCase();
  if (lower.includes('chest') || lower.includes('heart') || lower.includes('palpitation') || lower.includes('सीने') || lower.includes('दिल')) {
    return 'cardiac';
  }
  if (lower.includes('breath') || lower.includes('cough') || lower.includes('wheez') || lower.includes('asthma') || lower.includes('सांस') || lower.includes('खांसी')) {
    return 'respiratory';
  }
  if (lower.includes('fever') || lower.includes('chills') || lower.includes('temperature') || lower.includes('बुखार') || lower.includes('ठंड')) {
    return 'fever';
  }
  if (lower.includes('stomach') || lower.includes('abdomen') || lower.includes('vomit') || lower.includes('diarrhea') || lower.includes('acidity') || lower.includes('पेट') || lower.includes('उल्टी')) {
    return 'gastro';
  }
  if (lower.includes('headache') || lower.includes('dizz') || lower.includes('seizure') || lower.includes('numb') || lower.includes('सिरदर्द') || lower.includes('चक्कर')) {
    return 'neuro';
  }
  if (lower.includes('joint') || lower.includes('knee') || lower.includes('back') || lower.includes('swelling') || lower.includes('जोड़ों') || lower.includes('कमर')) {
    return 'ortho';
  }
  return 'general';
}

// Questions tailored for each category
export function getAdaptiveHPIQuestions(category: string): AdaptiveQuestion[] {
  switch (category) {
    case 'cardiac':
      return [
        {
          id: 'cardiac_character',
          category: 'hpi',
          textEn: 'How would you describe the feeling in your chest?',
          textHi: 'आप अपने सीने की तकलीफ या दर्द को किस प्रकार का महसूस करते हैं?',
          hintEn: 'E.g. heaviness, pressure, tight squeezing, sharp aching, or burning.',
          hintHi: 'जैसे भारीपन, दबाव, जकड़न, तेज चुभन या जलन।',
          optionsEn: ['Heavy pressure / Squeezing tight', 'Sharp pinching pain', 'Burning / Indigestion sensation', 'Dull ache', 'Flutters / Fast heartbeat'],
          optionsHi: ['भारी दबाव / जकड़न', 'तेज चुभने वाला दर्द', 'जलन / खट्टा अहसास', 'धीमा दर्द', 'धड़कन तेज होना'],
          allowsVoice: true,
          allowsSkip: true,
        },
        {
          id: 'cardiac_radiation',
          category: 'hpi',
          textEn: 'Does this chest discomfort spread or move to any other body parts?',
          textHi: 'क्या यह सीने का दर्द शरीर के किसी अन्य हिस्से की तरफ फैलता है?',
          hintEn: 'E.g. to your left arm, shoulder, jaw, neck, or back.',
          hintHi: 'जैसे बाएं हाथ, कंधे, जबड़े, गर्दन या पीठ की तरफ।',
          optionsEn: ['Radiating to left arm / shoulder', 'Spreading to neck & jaw', 'Spreading to back between shoulder blades', 'Stays centered in chest only', 'Not sure'],
          optionsHi: ['बाएं हाथ / कंधे में फैलता है', 'गर्दन और जबड़े की ओर', 'पीठ में फैलता है', 'केवल सीने में ही रहता है', 'पक्का नहीं पता'],
          allowsVoice: true,
          allowsSkip: true,
        },
        {
          id: 'cardiac_associated',
          category: 'hpi',
          textEn: 'Are you experiencing any shortness of breath, unusual sweating, or dizziness?',
          textHi: 'क्या आपको सांस फूलना, असामान्य पसीना आना या चक्कर महसूस हो रहे हैं?',
          hintEn: 'Cold sweats, breathlessness while resting or walking, or lightheadedness.',
          hintHi: 'ठंडा पसीना, चलने या लेटने पर सांस फूलना, या चक्कर आना।',
          optionsEn: ['Shortness of breath & Cold sweating', 'Shortness of breath only', 'Dizziness / Lightheadedness', 'Nausea / Feeling sick', 'None of these'],
          optionsHi: ['सांस फूलना और ठंडा पसीना', 'केवल सांस फूलना', 'चक्कर आना', 'उल्टी या मितली जैसा लगना', 'इनमें से कोई नहीं'],
          allowsVoice: true,
          allowsSkip: true,
        },
        {
          id: 'cardiac_triggers',
          category: 'hpi',
          textEn: 'Does walking, climbing stairs, or emotional stress make the chest discomfort worse?',
          textHi: 'क्या पैदल चलने, सीढ़ियां चढ़ने या तनाव में यह तकलीफ बढ़ती है?',
          hintEn: 'Does sitting down or resting relieve the discomfort within a few minutes?',
          hintHi: 'क्या बैठ जाने या आराम करने से कुछ मिनटों में आराम मिलता है?',
          optionsEn: ['Worse with exertion / Better with rest', 'Constant, no change with rest', 'Worse when taking a deep breath', 'Worse after meals / lying flat', 'Unpredictable'],
          optionsHi: ['चलने पर बढ़ता है / आराम से राहत', 'लगातार बना रहता है', 'लंबी सांस लेने पर बढ़ता है', 'खाने के बाद या लेटने पर बढ़ता है', 'अनिश्चित'],
          allowsVoice: true,
          allowsSkip: true,
        },
      ];

    case 'fever':
      return [
        {
          id: 'fever_pattern',
          category: 'hpi',
          textEn: 'How high is your fever, and does it come with chills or shivering?',
          textHi: 'बुखार कितना तेज है, और क्या ठंड या कंपकंपी छूटती है?',
          hintEn: 'Continuous high fever, or coming at specific times like evening or morning.',
          hintHi: 'लगातार तेज बुखार, या शाम/सुबह किसी खास समय आना।',
          optionsEn: ['High fever with severe chills / shivering', 'Mild low-grade fever continuously', 'Comes and goes in spikes', 'Comes mostly in evening', 'Not measured with thermometer'],
          optionsHi: ['तेज बुखार के साथ तेज ठंड/कंपकंपी', 'हल्का बुखार लगातार', 'चढ़ता-उतरता रहता है', 'ज्यादातर शाम को आता है', 'थर्मामीटर से नहीं नापा'],
          allowsVoice: true,
          allowsSkip: true,
        },
        {
          id: 'fever_associated',
          category: 'hpi',
          textEn: 'Do you also have cough, sore throat, headache, or body aches?',
          textHi: 'क्या आपको खांसी, गले में खराश, सिरदर्द या पूरे बदन में दर्द भी है?',
          hintEn: 'Notice if there is joint stiffness, eye redness, or skin rashes.',
          hintHi: 'क्या जोड़ों में जकड़न, आंखें लाल होना या त्वचा पर चकत्ते हैं।',
          optionsEn: ['Cough with phlegm & sore throat', 'Severe body pain & headache', 'Vomiting or loose stools', 'Skin rashes / spots', 'Only fever, no other symptoms'],
          optionsHi: ['खांसी, बलगम और गले में खराश', 'शरीर और सिर में बहुत दर्द', 'उल्टी या दस्त', 'त्वचा पर लाल चकत्ते', 'सिर्फ बुखार है, अन्य कुछ नहीं'],
          allowsVoice: true,
          allowsSkip: true,
        },
      ];

    case 'respiratory':
      return [
        {
          id: 'resp_cough_type',
          category: 'hpi',
          textEn: 'Is your cough dry, or are you bringing up mucus or phlegm?',
          textHi: 'आपकी खांसी सूखी है, या बलगम (कफ) निकल रहा है?',
          hintEn: 'Color of phlegm (white, yellow, greenish, or blood-streaked).',
          hintHi: 'बलगम का रंग (सफेद, पीला, हरा, या खून के धब्बे)।',
          optionsEn: ['Dry hacking cough', 'Cough with clear / white phlegm', 'Cough with yellow / green phlegm', 'Traces of blood in cough', 'Mostly coughing at night'],
          optionsHi: ['सूखी खांसी', 'सफेद/साफ बलगम वाली खांसी', 'पीला/हरा बलगम', 'खांसी में खून का अंश', 'रात में ज्यादा खांसी'],
          allowsVoice: true,
          allowsSkip: true,
        },
        {
          id: 'resp_breathlessness',
          category: 'hpi',
          textEn: 'How easily do you feel short of breath or hear wheezing?',
          textHi: 'सांस कितनी जल्दी फूलती है या क्या सीने से सीटी जैसी आवाज आती है?',
          hintEn: 'Shortness of breath while walking on flat ground, climbing, or even while resting.',
          hintHi: 'समतल चलने पर, सीढ़ियां चढ़ने पर, या बैठे-बैठे भी सांस फूलना।',
          optionsEn: ['Short of breath only while climbing / brisk walking', 'Breathless even while sitting / talking', 'Wheezing / whistling sound from chest', 'Need extra pillows to sleep flat', 'No breathing difficulty'],
          optionsHi: ['सीढ़ियां चढ़ने या तेज चलने पर ही', 'बैठे या बात करते समय भी सांस फूलती है', 'सीने से सीटी जैसी आवाज', 'सोने के लिए 2-3 तकिए लगाने पड़ते हैं', 'सांस में कोई तकलीफ नहीं'],
          allowsVoice: true,
          allowsSkip: true,
        },
      ];

    case 'gastro':
      return [
        {
          id: 'gastro_location',
          category: 'hpi',
          textEn: 'Where in your stomach or abdomen do you feel the discomfort?',
          textHi: 'पेट में दर्द या बेचैनी किस जगह पर ज्यादा महसूस होती है?',
          hintEn: 'Upper stomach / heartburn, around belly button, lower right side, or whole abdomen.',
          hintHi: 'ऊपरी पेट/सीने में जलन, नाभि के पास, निचले दाएं हिस्से में, या पूरे पेट में।',
          optionsEn: ['Upper abdomen / Acid heartburn', 'Lower right abdomen (sharp)', 'Around navel / Crampy', 'Lower abdomen / Pelvic area', 'Whole stomach feels bloated & painful'],
          optionsHi: ['ऊपरी पेट / खट्टी जलन', 'निचले दाएं हिस्से में तेज दर्द', 'नाभि के चारों ओर मरोड़', 'निचले पेट में', 'पूरे पेट में अफारा और दर्द'],
          allowsVoice: true,
          allowsSkip: true,
        },
        {
          id: 'gastro_bowel',
          category: 'hpi',
          textEn: 'Have you had any vomiting, loose stools (diarrhea), or difficulty passing stools?',
          textHi: 'क्या आपको उल्टी, दस्त, या कब्ज (शौच में रुकावट) की परेशानी हुई है?',
          hintEn: 'Frequency of loose stools or any dark / bloody stool.',
          hintHi: 'दस्त की संख्या या मल में कालापन या खून।',
          optionsEn: ['Frequent watery loose motions', 'Vomiting food or bile', 'Severe constipation for 2+ days', 'Black colored stools', 'Normal bowel movements'],
          optionsHi: ['बार-बार पानी जैसे दस्त', 'उल्टी होना', 'गंभीर कब्ज (2+ दिनों से)', 'काला मल आना', 'शौच सामान्य है'],
          allowsVoice: true,
          allowsSkip: true,
        },
      ];

    default:
      return [
        {
          id: 'gen_duration_pattern',
          category: 'hpi',
          textEn: 'How has this symptom been changing since it started?',
          textHi: 'जब से यह समस्या शुरू हुई है, इसमें क्या बदलाव आया है?',
          hintEn: 'Getting progressively worse, improving slowly, or coming and going.',
          hintHi: 'धीरे-धीरे बढ़ रहा है, कम हो रहा है, या समय-समय पर आता-जाता है।',
          optionsEn: ['Getting progressively worse', 'Staying about the same', 'Comes and goes in episodes', 'Slowly improving with rest', 'First time experiencing this'],
          optionsHi: ['लगातार बढ़ रहा है', 'एक जैसा बना हुआ है', 'बार-बार आता-जाता है', 'आराम करने पर सुधरता है', 'पहली बार ऐसा हुआ है'],
          allowsVoice: true,
          allowsSkip: true,
        },
      ];
  }
}

// Check for clinical contradictions in patient answers
export function detectContradiction(interview: ClinicalInterview, newKey: string, newAnswer: string): { hasContradiction: boolean; messageEn?: string; messageHi?: string; resolutionOptions?: string[] } {
  const answerLower = newAnswer.toLowerCase();

  // Contradiction 1: Patient previously claimed "no medicines", but mentions a drug (metformin, telmisartan, insulin, etc.)
  const hasClaimedNoMeds = interview.drugHistory.some(m => m.name.toLowerCase().includes('none') || m.name.toLowerCase().includes('no medicines') || m.name.toLowerCase().includes('कोई दवा नहीं'));
  const mentionsMed = answerLower.includes('metformin') || answerLower.includes('telmisartan') || answerLower.includes('amlodipine') || answerLower.includes('paracetamol') || answerLower.includes('insulin') || answerLower.includes('tablet') || answerLower.includes('capsule');

  if (hasClaimedNoMeds && mentionsMed) {
    return {
      hasContradiction: true,
      messageEn: 'Please Clarify: Earlier you mentioned that you were not taking any daily medicines. You now mentioned a medication. Which information should we record for your doctor?',
      messageHi: 'कृपया स्पष्ट करें: पहले आपने बताया था कि आप कोई नियमित दवा नहीं ले रहे हैं। अब आपने दवाई का जिक्र किया है। आपके डॉक्टर के लिए क्या दर्ज करें?',
      resolutionOptions: ['Yes, I take this medication daily', 'No, I took it only once in the past', 'I am not taking any regular medicine'],
    };
  }

  // Contradiction 2: Patient says "No known allergies" then mentions allergy
  const hasClaimedNoAllergy = interview.allergies.some(a => a.substance.toLowerCase().includes('no') || a.substance.toLowerCase().includes('none') || a.substance.toLowerCase().includes('कोई नहीं'));
  const mentionsAllergy = answerLower.includes('penicillin') || answerLower.includes('sulfa') || answerLower.includes('reaction') || answerLower.includes('rash') || answerLower.includes('allergy');

  if (hasClaimedNoAllergy && mentionsAllergy) {
    return {
      hasContradiction: true,
      messageEn: 'Please Clarify: Earlier you stated you had no known drug allergies. You just noted a reaction. Shall we record an allergy for your doctor?',
      messageHi: 'कृपया स्पष्ट करें: पहले आपने बताया था कि आपको कोई एलर्जी नहीं है। क्या हमें डॉक्टर के लिए यह एलर्जी दर्ज करनी चाहिए?',
      resolutionOptions: ['Yes, please record this allergy', 'No, it was just mild temporary upset', 'I am not sure'],
    };
  }

  return { hasContradiction: false };
}

// Generate the complete structured Clinical Report
export function buildClinicalReport(interview: ClinicalInterview, patient: Patient): ClinicalReport {
  const redFlagList = interview.redFlags || [];
  const triagePriority = redFlagList.length > 0 ? 'HIGH' : 'NORMAL';

  // Build narrative summary
  const cc = interview.chiefComplaint || 'Not reported';
  const onset = interview.hpi.onset || 'Recently';
  const severity = interview.hpi.severity ? `Severity ${interview.hpi.severity}/10` : 'Severity not quantified';
  const character = interview.hpi.character || 'discomfort';
  const radiation = interview.hpi.radiation ? `Radiating to: ${interview.hpi.radiation}` : 'No radiation reported';
  const assoc = interview.hpi.associatedSymptoms && interview.hpi.associatedSymptoms.length > 0
    ? `Associated with: ${interview.hpi.associatedSymptoms.join(', ')}`
    : 'No acute associated distress reported';

  const hpiNarrative = `${patient.name}, a ${patient.age}-year-old ${patient.gender}, presents with ${cc} (onset: ${onset}). The patient describes the symptom as ${character}. ${severity}. ${radiation}. ${assoc}.`;

  const keyPoints: string[] = [];
  if (redFlagList.length > 0) {
    keyPoints.push(`🚨 RED-FLAG ALERT: ${redFlagList.map(r => r.ruleTriggered).join(', ')}`);
  }
  keyPoints.push(`Primary complaint: ${cc} (${onset})`);
  if (interview.pastHistory.length > 0 && !interview.pastHistory.includes('None')) {
    keyPoints.push(`Relevant past medical history: ${interview.pastHistory.join(', ')}`);
  }
  if (interview.drugHistory.length > 0 && !interview.drugHistory[0].name.toLowerCase().includes('none')) {
    keyPoints.push(`Active medications: ${interview.drugHistory.map(m => `${m.name} ${m.dosage}`).join(', ')}`);
  }
  if (interview.allergies.length > 0 && !interview.allergies[0].substance.toLowerCase().includes('no')) {
    keyPoints.push(`⚠️ Known drug allergies: ${interview.allergies.map(a => `${a.substance} (${a.reaction || 'Allergy'})`).join(', ')}`);
  }
  if (interview.documents.length > 0) {
    keyPoints.push(`Digitized documents: ${interview.documents.length} verified records available for cross-consultation.`);
  }

  const quickSummary = `Pre-consultation digital clinical intake completed via AI Medical Assistant. ${hpiNarrative} Triage priority determined as ${triagePriority}. History verified with patient prior to consultation.`;

  return {
    id: `REP-${Date.now().toString().slice(-6)}`,
    patientId: patient.id,
    interviewId: interview.id,
    intakeId: interview.intakeId || `INT-${patient.id}`,
    patientName: patient.name,
    age: patient.age,
    gender: patient.gender,
    abhaId: patient.abhaId,
    token: patient.token,
    generatedAt: new Date().toISOString(),
    status: 'AWAITING_DOCTOR_REVIEW',
    summary: {
      quickClinicalSummary: quickSummary,
      keyPointsForDoctor: keyPoints,
    },
    chiefComplaint: interview.chiefComplaint || 'Not reported',
    historyOfPresentIllness: hpiNarrative,
    reviewOfSystems: interview.reviewOfSystems || {},
    pastMedicalHistory: interview.pastHistory.length > 0 ? interview.pastHistory : ['Not reported / No prior diagnosed conditions'],
    pastSurgicalHistory: interview.surgicalHistory.length > 0 ? interview.surgicalHistory.map(s => `${s.surgery} (${s.year || 'Date not recorded'})`) : ['No prior surgeries reported'],
    hospitalizationHistory: interview.hospitalizationHistory.length > 0 ? interview.hospitalizationHistory.map(h => `${h.reason} (${h.year || 'Date not recorded'})`) : ['No prior hospitalizations reported'],
    drugHistory: interview.drugHistory.length > 0 ? interview.drugHistory : [{ name: 'None reported', dosage: '-', frequency: '-', source: 'Patient interview' }],
    allergies: interview.allergies.length > 0 ? interview.allergies : [{ substance: 'No known allergies reported', reaction: '-', source: 'Patient interview' }],
    familyHistory: interview.familyHistory.length > 0 ? interview.familyHistory : [{ relationship: 'Family', condition: 'No specific hereditary condition reported' }],
    personalHistory: interview.personalHistory || { diet: 'Vegetarian / Regular', sleep: 'Adequate', physicalActivity: 'Moderate' },
    femaleHealthHistory: interview.femaleHealthHistory,
    ayurvedaAssessment: interview.ayurvedaHistory,
    documents: interview.documents || [],
    redFlags: interview.redFlags || [],
    triagePriority,
    demographics: {
      name: patient.name,
      age: patient.age,
      gender: patient.gender,
      token: patient.token,
      abhaAddress: patient.abhaId,
      phone: patient.phone,
    },
    hpiDetails: {
      onset: interview.hpi.onset || 'Recently',
      duration: interview.hpi.duration || 'Acute onset',
      progression: interview.hpi.progression || 'Stable',
      severity: interview.hpi.severity ? `${interview.hpi.severity}/10` : 'Moderate',
      character: interview.hpi.character || 'Ache / Discomfort',
      location: interview.hpi.location || 'Local / Generalized',
      radiation: interview.hpi.radiation || 'None reported',
      aggravating: Array.isArray(interview.hpi.aggravatingFactors)
        ? interview.hpi.aggravatingFactors.join(', ')
        : (interview.hpi.aggravatingFactors || 'Physical exertion / movement'),
      relieving: Array.isArray(interview.hpi.relievingFactors)
        ? interview.hpi.relievingFactors.join(', ')
        : (interview.hpi.relievingFactors || 'Rest'),
      associatedSymptoms: interview.hpi.associatedSymptoms && interview.hpi.associatedSymptoms.length > 0
        ? interview.hpi.associatedSymptoms.join(', ')
        : 'None reported',
    },
    disclaimer: 'AI-generated clinical intake summary. This report is not a diagnosis and must be reviewed and verified by a qualified healthcare professional.',
  };
}
