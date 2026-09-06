import React, { useState, useEffect } from 'react';
import { ClinicalReport, Language, DoctorUser, ReportShare } from '../types';
import {
  FileText,
  Printer,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  User,
  ShieldCheck,
  Stethoscope,
  Building2,
  Calendar,
  Sparkles,
  Download,
  Share2,
  ArrowRight,
  Edit3,
  Save,
  Check,
  HeartPulse,
  Send,
  Search,
  X,
  RefreshCw,
} from 'lucide-react';

interface PreConsultationReportViewProps {
  report: ClinicalReport;
  language: Language;
  onProceedToDoctor?: () => void;
  isDoctorView?: boolean;
  onApproveByDoctor?: (notes: string) => Promise<void>;
}

export const PreConsultationReportView: React.FC<PreConsultationReportViewProps> = ({
  report,
  language,
  onProceedToDoctor,
  isDoctorView = false,
  onApproveByDoctor,
}) => {
  const [doctorNotes, setDoctorNotes] = useState(report.doctorNotes || '');
  const [isApproving, setIsApproving] = useState(false);
  const [isApproved, setIsApproved] = useState(report.status === 'FINALIZED');

  // Send to Doctor Modal State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [doctorsList, setDoctorsList] = useState<DoctorUser[]>([]);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
  const [searchDocQuery, setSearchDocQuery] = useState('');
  const [selectedHospitalFilter, setSelectedHospitalFilter] = useState('ALL');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [patientNote, setPatientNote] = useState('');
  const [isSendingShare, setIsSendingShare] = useState(false);
  const [sharesList, setSharesList] = useState<any[]>(report.sharedWith || []);
  const [shareSuccessToast, setShareSuccessToast] = useState<string | null>(null);

  // Fetch doctors and any existing shares when opening modal
  const openShareModal = async () => {
    setIsShareModalOpen(true);
    setIsLoadingDoctors(true);
    try {
      const res = await fetch('/api/doctors');
      if (res.ok) {
        const docs = await res.json();
        setDoctorsList(docs);
        if (docs.length > 0 && !selectedDocId) {
          setSelectedDocId(docs[0].id);
        }
      }
      // Check existing shares
      const sharesRes = await fetch(`/api/reports/${report.id}/shares`);
      if (sharesRes.ok) {
        const sData = await sharesRes.json();
        if (Array.isArray(sData) && sData.length > 0) {
          setSharesList(sData);
        }
      }
    } catch (e) {
      console.error('Failed to load doctors list:', e);
    } finally {
      setIsLoadingDoctors(false);
    }
  };

  const handleShareReport = async () => {
    if (!selectedDocId) return;
    setIsSendingShare(true);
    try {
      const res = await fetch('/api/reports/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: report.id,
          doctorId: selectedDocId,
          patientNotes: patientNote,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const updatedShares = [data.share, ...sharesList.filter(s => s.doctorId !== selectedDocId)];
        setSharesList(updatedShares);
        setShareSuccessToast(`Delivered to ${data.share.doctorName} (${data.share.hospitalName || 'OPD'}). Status: DELIVERED`);
        setIsShareModalOpen(false);
        setPatientNote('');
        setTimeout(() => setShareSuccessToast(null), 6000);
      } else {
        alert(data.error || 'Failed to share report with doctor.');
      }
    } catch (e) {
      console.error('Error sharing report:', e);
      alert('Network error while sharing report. Please try again.');
    } finally {
      setIsSendingShare(false);
    }
  };

  const handleDownloadSummary = () => {
    const textContent = `
MEDIKIOSK PRE-CONSULTATION CLINICAL REPORT
Report ID: ${report.id}
Generated: ${new Date(report.generatedAt).toLocaleString()}
Triage Priority: ${report.triagePriority}

PATIENT DEMOGRAPHICS
Name: ${report.demographics.name}
Age / Gender: ${report.demographics.age} Y / ${report.demographics.gender}
Token: ${report.demographics.token}
ABHA: ${report.demographics.abhaAddress || 'Not linked'}
Phone: ${report.demographics.phone || 'N/A'}

CHIEF COMPLAINT: ${report.chiefComplaint}
HISTORY OF PRESENT ILLNESS:
${report.historyOfPresentIllness}

MEDICATIONS:
${report.drugHistory.map(m => `- ${m.name} (${m.dosage}) ${m.frequency || ''}`).join('\n') || 'None reported'}

KNOWN ALLERGIES:
${report.allergies.map(a => `- ${a.substance}: ${a.reaction || 'Hypersensitivity'}`).join('\n') || 'No known allergies (NKDA)'}

PAST MEDICAL & SURGICAL:
${report.pastMedicalHistory.join(', ') || 'None reported'}

FAMILY HISTORY:
${report.familyHistory.map(f => `${f.relationship}: ${f.condition}`).join('; ') || 'Non-contributory'}

PHYSICIAN HIGHLIGHTS:
${report.summary.quickClinicalSummary}

DISCLAIMER: ${report.disclaimer || 'AI-generated clinical intake summary. Must be verified by a licensed physician.'}
    `.trim();

    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MediKiosk_Report_${report.demographics.token || report.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleApprove = async () => {
    if (!onApproveByDoctor) return;
    setIsApproving(true);
    try {
      await onApproveByDoctor(doctorNotes);
      setIsApproved(true);
    } catch (e) {
      console.error('Failed to approve report:', e);
    } finally {
      setIsApproving(false);
    }
  };

  const isHighPriority = report.triagePriority === 'HIGH';

  // Hospitals for filter
  const uniqueHospitals = Array.from(new Set(doctorsList.map(d => d.hospitalName).filter(Boolean)));

  const filteredDoctors = doctorsList.filter(doc => {
    const matchesSearch =
      doc.fullName.toLowerCase().includes(searchDocQuery.toLowerCase()) ||
      doc.specialization.toLowerCase().includes(searchDocQuery.toLowerCase()) ||
      (doc.hospitalName && doc.hospitalName.toLowerCase().includes(searchDocQuery.toLowerCase()));

    if (selectedHospitalFilter === 'ALL') return matchesSearch;
    return matchesSearch && doc.hospitalName === selectedHospitalFilter;
  });

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Toast Notification */}
      {shareSuccessToast && (
        <div className="p-3 bg-emerald-900 text-white rounded-xl text-xs font-semibold flex items-center justify-between shadow-lg animate-fade-in print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{shareSuccessToast}</span>
          </div>
          <button onClick={() => setShareSuccessToast(null)} className="text-emerald-300 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ACTION BAR (Print, Export, Send to Doctor, Doctor Queue) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs print:hidden">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Structured Pre-Consultation Clinical Report
            </h3>
            <p className="text-[11px] text-slate-500">
              Report ID: {report.id} • FHIR R4 Bundle Ready
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDownloadSummary}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all cursor-pointer"
            title="Download Summary Text"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Download</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>

          {!isDoctorView && (
            <button
              onClick={openShareModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-50 hover:bg-teal-100 border border-teal-300 text-teal-800 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              <Share2 className="w-4 h-4 text-teal-700" />
              <span>Send to Doctor</span>
            </button>
          )}

          {onProceedToDoctor && !isDoctorView && (
            <button
              onClick={onProceedToDoctor}
              className="flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer hover:scale-[1.01]"
            >
              <span>Proceed to Doctor Queue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* PRINTABLE OFFICIAL REPORT CARD */}
      <div className="bg-white border-2 border-slate-300 rounded-3xl p-8 shadow-sm space-y-6 print:border-none print:p-0">
        {/* OFFICIAL HEADER */}
        <div className="border-b-2 border-slate-900 pb-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white px-2 py-0.5 rounded">
                  GOVERNMENT OF INDIA
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest bg-amber-600 text-white px-2 py-0.5 rounded">
                  MINISTRY OF AYUSH / AIIA
                </span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight pt-1">
                MediKiosk Pre-Consultation Clinical Intake Summary
              </h1>
              <p className="text-xs text-slate-600 font-medium">
                National Digital Health Mission (ABDM) • All India Institute of Ayurveda Clinical Protocol
              </p>
            </div>

            {/* Verification Watermark */}
            <div className="text-right shrink-0">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider border ${
                  isApproved || report.status === 'FINALIZED'
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : isHighPriority
                    ? 'bg-red-50 text-red-900 border-red-300'
                    : 'bg-amber-50 text-amber-900 border-amber-300'
                }`}
              >
                {isApproved || report.status === 'FINALIZED' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>FINALIZED — PHYSICIAN VERIFIED</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>DRAFT — PHYSICIAN VERIFICATION REQUIRED</span>
                  </>
                )}
              </span>
              <p className="text-[10px] text-slate-400 mt-1 font-mono">Generated: {new Date(report.generatedAt).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* SECTION 1: PATIENT DEMOGRAPHICS & IDENTIFIERS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] font-bold uppercase">Patient Name</span>
            <span className="font-bold text-slate-900 text-sm">{report.demographics.name}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] font-bold uppercase">Age / Gender</span>
            <span className="font-bold text-slate-800">{report.demographics.age} Years • {report.demographics.gender}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] font-bold uppercase">OPD Token #</span>
            <span className="font-mono font-bold text-teal-800 bg-white px-2 py-0.5 rounded border border-slate-200">
              {report.demographics.token}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] font-bold uppercase">ABHA Address</span>
            <span className="font-mono text-slate-700 truncate block">
              {report.demographics.abhaAddress || 'Not linked'}
            </span>
          </div>
        </div>

        {/* SHARED WITH DOCTOR LIVE STATUS BADGE */}
        {sharesList && sharesList.length > 0 && (
          <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-2xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-teal-950 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                <Stethoscope className="w-3.5 h-3.5 text-teal-700" />
                Report Shared with Medical Team ({sharesList.length})
              </span>
              <span className="text-[10px] text-teal-700 font-semibold">Live Transmission Status</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sharesList.map((share: any, sIdx: number) => (
                <div key={sIdx} className="p-2.5 bg-white rounded-xl border border-teal-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 block">{share.doctorName}</span>
                    <span className="text-[11px] text-slate-500">{share.hospitalName || 'OPD Department'}</span>
                    <span className="text-[10px] text-slate-400 block">Sent: {new Date(share.sharedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg uppercase tracking-wider border ${
                    share.status === 'REVIEWED'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : share.status === 'VIEWED'
                      ? 'bg-blue-50 text-blue-800 border-blue-300'
                      : 'bg-teal-50 text-teal-800 border-teal-300'
                  }`}>
                    {share.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PRIORITY TRIAGE BANNER IF RED FLAG */}
        {isHighPriority && (
          <div className="p-4 bg-red-50 border-2 border-red-300 rounded-2xl flex items-start gap-3 text-xs text-red-950">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold uppercase tracking-wider text-red-800 text-[11px]">
                High Priority Clinical Triage Alert
              </p>
              <p className="font-semibold mt-0.5">
                Red flags detected: {report.redFlags.map(r => r.ruleTriggered).join(', ')}
              </p>
              <p className="text-red-700 text-[11px] mt-1">
                Attending physician should prioritize clinical evaluation and review cardiac/respiratory parameters immediately.
              </p>
            </div>
          </div>
        )}

        {/* SECTION 2: CHIEF COMPLAINT & HISTORY OF PRESENT ILLNESS (HPI) */}
        <div className="space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1 flex items-center gap-1.5">
            <HeartPulse className="w-4 h-4 text-teal-600" />
            <span>Chief Complaint & History of Present Illness (HPI)</span>
          </h2>

          <div className="p-4 bg-teal-50/50 rounded-2xl border border-teal-100 space-y-2 text-xs">
            <div>
              <span className="font-bold text-teal-950 text-sm block">
                Primary Complaint: {report.chiefComplaint}
              </span>
              <p className="text-slate-700 leading-relaxed mt-1">
                {report.historyOfPresentIllness}
              </p>
            </div>

            {/* HPI Breakdown Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-teal-200/50 text-[11px]">
              <div>
                <span className="text-slate-500 block font-semibold">Onset:</span>
                <span className="font-bold text-slate-800">{report.hpiDetails.onset || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-semibold">Pain / Severity Score:</span>
                <span className="font-bold text-slate-800">{report.hpiDetails.severity || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-semibold">Character:</span>
                <span className="font-bold text-slate-800">{report.hpiDetails.character || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-semibold">Radiation:</span>
                <span className="font-bold text-red-700">{report.hpiDetails.radiation || 'None reported'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: MEDICATIONS & ALLERGIES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Medications */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-black uppercase tracking-wider text-slate-700">
                Current Medications ({report.drugHistory.length})
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">Source Tagged</span>
            </div>

            {report.drugHistory.length === 0 ? (
              <p className="text-slate-500 italic">No regular daily medications reported</p>
            ) : (
              <div className="space-y-1.5">
                {report.drugHistory.map((med, idx) => (
                  <div key={idx} className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900">{med.name}</span>
                      <span className="text-slate-500 ml-2">({med.dosage})</span>
                      <span className="block text-[10px] text-slate-400">{med.frequency || 'Daily'}</span>
                    </div>
                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded">
                      {med.source || 'Patient Reported'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Allergies */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-black uppercase tracking-wider text-slate-700">
                Known Allergies ({report.allergies.length})
              </span>
              <span className="text-[10px] font-bold text-red-700">Clinical Safety</span>
            </div>

            {report.allergies.length === 0 ? (
              <p className="text-slate-500 italic">No known drug allergies (NKDA)</p>
            ) : (
              <div className="space-y-1.5">
                {report.allergies.map((allergy, idx) => (
                  <div key={idx} className="p-2 bg-red-50 text-red-950 rounded-xl border border-red-200 flex items-center justify-between font-bold">
                    <span>⚠️ {allergy.substance}</span>
                    <span className="text-[10px] text-red-800">{allergy.reaction || 'Hypersensitivity'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SECTION 4: MEDICAL HISTORY & LIFESTYLE */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] font-bold uppercase mb-1">
              Past Medical & Surgical
            </span>
            <p className="font-semibold text-slate-800">
              {report.pastMedicalHistory.length > 0 ? report.pastMedicalHistory.join(', ') : 'None reported'}
            </p>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] font-bold uppercase mb-1">
              Family Medical History
            </span>
            <p className="font-semibold text-slate-800">
              {report.familyHistory.length > 0
                ? report.familyHistory.map(f => `${f.relationship}: ${f.condition}`).join('; ')
                : 'Non-contributory'}
            </p>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] font-bold uppercase mb-1">
              Personal & Lifestyle
            </span>
            <p className="font-semibold text-slate-800">
              Diet: {report.personalHistory.diet || 'Regular'} • Sleep: {report.personalHistory.sleep || 'Normal'}
            </p>
          </div>
        </div>

        {/* SECTION 5: AYUSH DASHAVIDHA PARIKSHA (IF AYUSH DATA) */}
        {report.ayurvedaAssessment && (
          <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-2 text-xs">
            <span className="font-black uppercase tracking-wider text-amber-900 block">
              Ayush Assessment (All India Institute of Ayurveda Parameters)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
              <div>
                <span className="text-amber-800 block font-semibold">Prakriti (Constitution):</span>
                <span className="font-bold text-slate-900">{report.ayurvedaAssessment.prakriti || 'Pitta-Kapha'}</span>
              </div>
              <div>
                <span className="text-amber-800 block font-semibold">Agni (Digestive Fire):</span>
                <span className="font-bold text-slate-900">{report.ayurvedaAssessment.agni || 'Manda / Sluggish'}</span>
              </div>
              <div>
                <span className="text-amber-800 block font-semibold">Koshtha (Bowel Habit):</span>
                <span className="font-bold text-slate-900">{report.ayurvedaAssessment.koshtha || 'Madhyama'}</span>
              </div>
              <div>
                <span className="text-amber-800 block font-semibold">Nidana (Causative Factors):</span>
                <span className="font-bold text-slate-900">{report.ayurvedaAssessment.nidana || 'Dietary irregularity'}</span>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 6: KEY CLINICAL POINTS FOR PHYSICIAN */}
        <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-400" />
            <span className="font-bold uppercase tracking-wider text-teal-300">
              Pre-Consultation Highlights for Attending Physician
            </span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            {report.summary.quickClinicalSummary}
          </p>
          <ul className="list-disc pl-4 space-y-1 text-slate-300 pt-1">
            {report.summary.keyPointsForDoctor.map((pt, idx) => (
              <li key={idx}>{pt}</li>
            ))}
          </ul>
        </div>

        {/* SECTION 7: PHYSICIAN REVIEW & SIGN-OFF (FOR DOCTOR WORKSPACE) */}
        {isDoctorView && (
          <div className="p-5 bg-teal-50/60 border-2 border-teal-300 rounded-2xl space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-teal-700" />
                <h3 className="font-bold text-teal-950 text-sm">Physician Review & Clinical Sign-Off</h3>
              </div>
              <span className="text-[10px] font-bold text-teal-800 bg-white px-2.5 py-1 rounded-lg border border-teal-200">
                Medical Officer: Dr. Vivek Sharma, MD
              </span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase text-[10px] mb-1">
                Doctor Consultation Notes & Additions:
              </label>
              <textarea
                rows={2}
                value={doctorNotes}
                onChange={e => setDoctorNotes(e.target.value)}
                placeholder="Enter attending doctor notes, provisional diagnosis, or adjusted care plan..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500 italic">
                By approving, this report status changes from Draft to Finalized in ABDM.
              </span>

              <button
                onClick={handleApprove}
                disabled={isApproving || isApproved}
                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs cursor-pointer transition-all"
              >
                {isApproving ? (
                  <span>Saving...</span>
                ) : isApproved ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Report Approved & Finalized</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Approve & Finalize Report</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* LEGAL & ETHICAL DISCLAIMER */}
        <div className="pt-4 border-t border-slate-200 text-center space-y-1">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            {report.disclaimer}
          </p>
          <p className="text-[10px] text-slate-400">
            AarogyaSetu HealthOS / MediKiosk • Smart India Hackathon 2026 • PS-26047 Patient Case-Taking Software
          </p>
        </div>
      </div>

      {/* SEND TO DOCTOR MODAL */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Send Report to Doctor</h3>
                  <p className="text-[11px] text-slate-500">Select registered physician or hospital department</p>
                </div>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filters */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search doctor by name, specialty, or hospital..."
                  value={searchDocQuery}
                  onChange={e => setSearchDocQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              {uniqueHospitals.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
                  <button
                    onClick={() => setSelectedHospitalFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 cursor-pointer transition-all ${
                      selectedHospitalFilter === 'ALL'
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All Hospitals
                  </button>
                  {uniqueHospitals.map(h => (
                    <button
                      key={h}
                      onClick={() => setSelectedHospitalFilter(h || 'ALL')}
                      className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 cursor-pointer transition-all ${
                        selectedHospitalFilter === h
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Doctors List */}
            <div className="flex-1 overflow-y-auto space-y-2 max-h-56 pr-1">
              {isLoadingDoctors ? (
                <div className="py-8 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
                  <span>Loading registered doctors...</span>
                </div>
              ) : filteredDoctors.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No doctors found matching criteria.
                </div>
              ) : (
                filteredDoctors.map(doc => (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDocId(doc.id)}
                    className={`p-3 rounded-2xl border-2 transition-all cursor-pointer text-xs flex items-start justify-between ${
                      selectedDocId === doc.id
                        ? 'border-teal-600 bg-teal-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{doc.fullName}</span>
                        <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                          {doc.qualification}
                        </span>
                      </div>
                      <p className="text-teal-800 font-semibold text-[11px]">{doc.specialization}</p>
                      <p className="text-slate-500 text-[11px] flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        <span>{doc.hospitalName || 'OPD Medical Wing'}</span>
                      </p>
                      <p className="text-slate-400 text-[10px]">Reg: {doc.registrationNumber || (doc as any)?.regNumber} • {doc.experienceYears || 5}+ yrs exp</p>
                    </div>

                    <div className="mt-1">
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                          selectedDocId === doc.id
                            ? 'bg-teal-600 border-teal-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {selectedDocId === doc.id && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Patient Note */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Optional Message / Notes for Doctor:
              </label>
              <textarea
                rows={2}
                value={patientNote}
                onChange={e => setPatientNote(e.target.value)}
                placeholder="e.g., Symptoms worse in morning, please check ECG..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleShareReport}
                disabled={!selectedDocId || isSendingShare}
                className="px-6 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
              >
                {isSendingShare ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Delivering...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Pre-Consultation Report</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
