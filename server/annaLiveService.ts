import { WebSocket, WebSocketServer } from 'ws';
import { GoogleGenAI, Modality, Type, FunctionDeclaration, LiveServerMessage } from '@google/genai';
import { ANNA_SYSTEM_PROMPT } from '../src/ai/AnnaSystemPrompt';
import { logAudit, getDatabase } from './db';

// Tool Declarations for Live API
const openWebsiteTool: FunctionDeclaration = {
  name: 'openWebsite',
  description: 'Navigate to a specific page or workspace on the medical platform',
  parameters: {
    type: Type.OBJECT,
    properties: {
      page: {
        type: Type.STRING,
        description: "The page to open: 'home', 'kiosk', 'doctor', or 'admin'",
      },
      reason: {
        type: Type.STRING,
        description: 'Reason for opening this page',
      },
    },
    required: ['page'],
  },
};

const openDoctorTool: FunctionDeclaration = {
  name: 'openDoctor',
  description: 'Open a doctor profile or recommend a specific doctor to the patient',
  parameters: {
    type: Type.OBJECT,
    properties: {
      doctorId: { type: Type.STRING, description: 'ID of the doctor or staff member e.g. STF-01' },
      doctorName: { type: Type.STRING, description: 'Full name of the doctor e.g. Dr. Vivek Sharma' },
      specialty: { type: Type.STRING, description: 'Medical specialty e.g. Cardiology, AYUSH, Neurology' },
    },
    required: ['doctorName', 'specialty'],
  },
};

const openDepartmentTool: FunctionDeclaration = {
  name: 'openDepartment',
  description: 'Open and guide the patient to a medical department in the hospital',
  parameters: {
    type: Type.OBJECT,
    properties: {
      department: {
        type: Type.STRING,
        description: 'Department name e.g. General Medicine, Cardiology, Dermatology, AYUSH / Ayurveda, Pediatrics, Orthopedics, Emergency',
      },
      reason: { type: Type.STRING, description: 'Why this department is appropriate for the symptoms' },
    },
    required: ['department'],
  },
};

const openAppointmentTool: FunctionDeclaration = {
  name: 'openAppointment',
  description: 'Open the patient registration / appointment booking flow in the Kiosk',
  parameters: {
    type: Type.OBJECT,
    properties: {
      department: { type: Type.STRING, description: 'Department for appointment' },
      reason: { type: Type.STRING, description: 'Chief complaint or reason for visit' },
    },
  },
};

const searchDoctorTool: FunctionDeclaration = {
  name: 'searchDoctor',
  description: 'Search available hospital doctors by specialty or symptom keywords',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: 'Search term or symptom' },
      specialty: { type: Type.STRING, description: 'Target specialty (e.g. Cardiology, Dermatology, AYUSH, Pediatrics)' },
    },
    required: ['specialty'],
  },
};

const showEmergencyInformationTool: FunctionDeclaration = {
  name: 'showEmergencyInformation',
  description: 'Display urgent emergency warnings, emergency hotline numbers (112, 108), and emergency room instructions',
  parameters: {
    type: Type.OBJECT,
    properties: {
      emergencyReason: { type: Type.STRING, description: 'The critical symptom detected (e.g. severe chest pain radiating, stroke signs, dyspnea)' },
      recommendedAction: { type: Type.STRING, description: 'Immediate life-safety action to take' },
    },
    required: ['emergencyReason', 'recommendedAction'],
  },
};

const createSymptomSummaryTool: FunctionDeclaration = {
  name: 'createSymptomSummary',
  description: 'Generate a structured clinical intake summary from the conversation for the patient and doctor',
  parameters: {
    type: Type.OBJECT,
    properties: {
      chiefComplaint: { type: Type.STRING, description: 'Main symptom reported by the patient' },
      onsetDuration: { type: Type.STRING, description: 'When the symptom started and how long it has lasted' },
      location: { type: Type.STRING, description: 'Body location and any radiation' },
      severity: { type: Type.STRING, description: 'Reported severity (e.g. 7/10 or Moderate/Severe)' },
      associatedSymptoms: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Other symptoms mentioned by patient',
      },
      patientReportedNotes: { type: Type.STRING, description: 'Key details exactly as described by patient' },
      recommendedDepartment: { type: Type.STRING, description: 'Suggested hospital department' },
    },
    required: ['chiefComplaint', 'onsetDuration', 'severity'],
  },
};

const ANNA_TOOLS = [
  openWebsiteTool,
  openDoctorTool,
  openDepartmentTool,
  openAppointmentTool,
  searchDoctorTool,
  showEmergencyInformationTool,
  createSymptomSummaryTool,
];

// Helper to execute tools locally and prepare response
function executeToolLocally(name: string, args: Record<string, any>) {
  const db = getDatabase();
  switch (name) {
    case 'openWebsite': {
      logAudit('Anna AI Assistant', 'SYSTEM', 'ANNA_NAVIGATE', args.page || 'home', `Anna guided patient to ${args.page}`);
      return { success: true, page: args.page, message: `Opened ${args.page} view.` };
    }
    case 'openDoctor': {
      const match = db.staff.find(s => s.name.toLowerCase().includes((args.doctorName || '').toLowerCase()));
      return {
        success: true,
        doctor: match || { name: args.doctorName, role: 'Doctor', department: args.specialty, status: 'Available' },
        message: `Displayed profile for ${args.doctorName}.`,
      };
    }
    case 'openDepartment': {
      return {
        success: true,
        department: args.department,
        message: `Department ${args.department} selected. Available for OPD consultation.`,
      };
    }
    case 'openAppointment': {
      return {
        success: true,
        action: 'kiosk_intake',
        department: args.department || 'General Medicine',
        message: 'Intake and registration opened.',
      };
    }
    case 'searchDoctor': {
      const spec = (args.specialty || args.query || '').toLowerCase();
      const matched = db.staff.filter(s =>
        s.department.toLowerCase().includes(spec) ||
        s.role.toLowerCase().includes(spec) ||
        s.name.toLowerCase().includes(spec)
      );
      return {
        success: true,
        results: matched.length > 0 ? matched : [
          { name: 'Dr. Vivek Sharma, MD', department: 'Cardiology / Medicine', status: 'Available' },
          { name: 'Dr. Ananya Mukherjee, BAMS, MD(Ayu)', department: 'Kayachikitsa (AIIA)', status: 'Available' },
        ],
      };
    }
    case 'showEmergencyInformation': {
      logAudit('Anna AI Assistant', 'SYSTEM', 'EMERGENCY_TRIGGERED', 'CRITICAL', `Anna detected potential emergency: ${args.emergencyReason}`);
      return {
        success: true,
        isEmergency: true,
        reason: args.emergencyReason,
        recommendedAction: args.recommendedAction,
        emergencyNumbers: [
          { label: 'National Emergency Number', number: '112' },
          { label: 'Emergency Ambulance', number: '108' },
          { label: 'Hospital Emergency Desk', number: '+91 11 2999 1234' },
        ],
      };
    }
    case 'createSymptomSummary': {
      const summaryId = `SUM-${Date.now().toString().slice(-5)}`;
      logAudit('Anna AI Assistant', 'SYSTEM', 'SUMMARY_GENERATED', summaryId, `Anna generated pre-consultation summary for: ${args.chiefComplaint}`);
      return {
        success: true,
        summaryId,
        chiefComplaint: args.chiefComplaint,
        onsetDuration: args.onsetDuration,
        location: args.location || 'General',
        severity: args.severity,
        associatedSymptoms: args.associatedSymptoms || [],
        patientNotes: args.patientReportedNotes || '',
        recommendedDepartment: args.recommendedDepartment || 'General Medicine',
        disclaimer: 'Generated by AI Intake Assistant Anna for pre-consultation review. Not a formal diagnosis.',
      };
    }
    default:
      return { success: true, message: `Tool ${name} executed.` };
  }
}

export function setupAnnaLiveWebSocket(wss: WebSocketServer) {
  wss.on('connection', async (clientWs: WebSocket, req: any) => {
    console.log('[Anna Live] New WebSocket connection from client.');

    let preferredLang = 'en';
    try {
      const parsedUrl = new URL(req?.url || '', 'http://localhost');
      preferredLang = parsedUrl.searchParams.get('lang') || 'en';
    } catch {
      preferredLang = 'en';
    }

    let liveSession: any = null;
    let isConnectedToGemini = false;
    let apiKey = process.env.GEMINI_API_KEY;

    // Send connection acknowledgement to client
    clientWs.send(JSON.stringify({
      type: 'status',
      status: 'connecting',
      message: preferredLang === 'hi' ? 'अन्ना मेडिकल वॉइस सेवा से कनेक्ट हो रहा है...' : 'Connecting to Anna Medical Voice Engine...',
    }));

    if (!apiKey) {
      console.warn('[Anna Live] GEMINI_API_KEY not found in environment.');
      clientWs.send(JSON.stringify({
        type: 'status',
        status: 'error',
        message: preferredLang === 'hi' ? 'जेमिनी एपीआई कुंजी सेट नहीं है। कृपया Settings > Secrets में GEMINI_API_KEY दर्ज करें।' : 'Gemini API key is not set. Please set GEMINI_API_KEY in Settings > Secrets.',
      }));
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      console.log(`[Anna Live] Initializing Gemini Live session with gemini-3.1-flash-live-preview (lang: ${preferredLang})...`);

      const languageInstruction = preferredLang === 'hi'
        ? `\n\nCRITICAL LANGUAGE DIRECTIVE: The user has chosen HINDI (हिन्दी) on this hospital platform. You MUST greet the patient in polite Hindi/Hinglish (e.g., 'नमस्ते! मैं अन्ना हूँ, आपकी मेडिकल वॉइस सहायक। आप आज कैसा महसूस कर रहे हैं?'). Listen carefully and respond naturally in polite, empathetic Hindi or Hinglish throughout the intake.`
        : `\n\nCRITICAL LANGUAGE DIRECTIVE: The user has chosen ENGLISH on this hospital platform. Greet the patient warmly and converse in clear, compassionate English throughout the pre-consultation intake.`;

      liveSession = await ai.live.connect({
        model: 'gemini-3.1-flash-live-preview',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                // "Aoede" provides a warm, calm, compassionate tone ideal for healthcare
                voiceName: 'Aoede',
              },
            },
          },
          systemInstruction: ANNA_SYSTEM_PROMPT + languageInstruction,
          tools: [{ functionDeclarations: ANNA_TOOLS }],
        },
        callbacks: {
          onopen: () => {
            console.log('[Anna Live] Gemini Live session established.');
            isConnectedToGemini = true;
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'status',
                status: 'listening',
                message: 'Anna is listening. Speak naturally.',
              }));
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            // 1. Audio chunks from Anna
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts && parts.length > 0) {
              for (const part of parts) {
                if (part.inlineData?.data) {
                  const audioData = part.inlineData.data;
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({
                      type: 'audio',
                      audio: audioData,
                    }));
                  }
                }
                if (part.text && clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({
                    type: 'transcription',
                    role: 'anna',
                    text: part.text,
                  }));
                }
              }
            }

            // 2. Interruption / barge-in
            if (message.serverContent?.interrupted) {
              console.log('[Anna Live] Patient interrupted Anna.');
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                  type: 'interrupted',
                }));
              }
            }

            // 3. Tool / Function Calls
            if (message.toolCall?.functionCalls && message.toolCall.functionCalls.length > 0) {
              const functionResponses: any[] = [];

              for (const call of message.toolCall.functionCalls) {
                console.log(`[Anna Live] Tool called by Anna: ${call.name}`, call.args);
                const localResult = executeToolLocally(call.name, (call.args as any) || {});

                // Inform the client of the tool action so UI updates immediately
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({
                    type: 'tool_call',
                    id: call.id,
                    name: call.name,
                    args: call.args,
                    result: localResult,
                  }));
                }

                functionResponses.push({
                  id: call.id,
                  name: call.name,
                  response: { output: localResult },
                });
              }

              // Send tool responses back to the Live session so Anna can speak about them
              try {
                if (liveSession && typeof liveSession.sendToolResponse === 'function') {
                  liveSession.sendToolResponse({ functionResponses });
                }
              } catch (toolErr) {
                console.error('[Anna Live] Failed to send tool response to Gemini:', toolErr);
              }
            }
          },
          onerror: (err: any) => {
            console.error('[Anna Live] Gemini Live session error:', err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'status',
                status: 'error',
                message: 'Voice connection interrupted. Tap to reconnect.',
              }));
            }
          },
          onclose: (closeEvent: any) => {
            console.log('[Anna Live] Gemini Live session closed:', closeEvent?.code, closeEvent?.reason);
            isConnectedToGemini = false;
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'status',
                status: 'disconnected',
                message: 'Anna disconnected.',
              }));
            }
          },
        },
      });

      isConnectedToGemini = true;
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'status',
          status: 'listening',
          message: 'Anna is ready and listening.',
        }));
      }
    } catch (e: any) {
      console.error('[Anna Live] Failed to connect to Gemini Live API:', e);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'status',
          status: 'error',
          message: 'Could not initialize real-time voice session. Please check your network and API key.',
        }));
      }
    }

    // Handle messages from client
    clientWs.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());

        // Audio chunk from patient microphone (16kHz PCM16)
        if (data.type === 'audio' && data.audio) {
          if (liveSession && isConnectedToGemini) {
            try {
              liveSession.sendRealtimeInput({
                audio: {
                  data: data.audio,
                  mimeType: 'audio/pcm;rate=16000',
                },
              });
            } catch (err) {
              console.error('[Anna Live] Error sending realtime input:', err);
            }
          }
        } else if (data.type === 'interrupt') {
          // Client manually interrupted Anna
          console.log('[Anna Live] Client sent interrupt signal.');
        } else if (data.type === 'ping') {
          clientWs.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (err) {
        console.error('[Anna Live] Error processing client message:', err);
      }
    });

    // Cleanup on disconnect
    clientWs.on('close', () => {
      console.log('[Anna Live] Client disconnected.');
      if (liveSession) {
        try {
          liveSession.close();
        } catch (e) {
          // ignore
        }
        liveSession = null;
      }
    });

    clientWs.on('error', (err) => {
      console.error('[Anna Live] WebSocket client error:', err);
    });
  });
}
