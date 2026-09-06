import React, { useState } from 'react';
import { FileText, CheckCircle2, Stethoscope, ArrowRight, X, Clock, MapPin } from 'lucide-react';
import { StructuredSymptomSummary } from '../../types/anna';
import { useLanguage } from '../../i18n/LanguageContext';

interface AnnaSummaryModalProps {
  summary: StructuredSymptomSummary;
  onClose: () => void;
  onProceedToKiosk?: () => void;
}

export const AnnaSummaryModal: React.FC<AnnaSummaryModalProps> = ({
  summary,
  onClose,
  onProceedToKiosk,
}) => {
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { language, t } = useLanguage();

  const handleSaveToClinic = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/anna/save-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary }),
      });
      if (res.ok) {
        setIsSaved(true);
      }
    } catch (e) {
      console.error('Error saving summary:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const isUrgent = summary.clinicalStructuring.triageCategory === 'URGENT';

  return (
    <div className="relative overflow-hidden rounded-2xl border border-teal-500/30 bg-slate-900/95 backdrop-blur-xl p-5 shadow-2xl text-slate-100 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/20 border border-teal-500/30 text-teal-400">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white tracking-wide">
                {language === 'hi' ? 'पूर्व-परामर्श लक्षण सारांश' : 'Pre-Consultation Symptom Summary'}
              </h4>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  isUrgent
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                }`}
              >
                {summary.clinicalStructuring.triageCategory}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {language === 'hi' ? 'चिकित्सक हेतु अन्ना एआई द्वारा तैयार' : 'Prepared by Anna AI for attending doctor'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Main Content Grid */}
      <div className="mt-4 space-y-3 text-xs">
        <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800 space-y-2">
          <div className="flex items-start justify-between">
            <span className="text-slate-400 font-medium">
              {language === 'hi' ? 'मुख्य समस्या:' : 'Chief Complaint:'}
            </span>
            <span className="font-semibold text-white text-right max-w-[220px]">
              {summary.patientReported.chiefComplaint}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Clock className="h-3.5 w-3.5 text-teal-400 shrink-0" />
              <span>{summary.patientReported.onsetDuration}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <MapPin className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <span>{summary.patientReported.location}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span className="text-slate-400">
              {language === 'hi' ? 'तीव्रता:' : 'Reported Severity:'}
            </span>
            <span className="font-bold text-teal-300">{summary.patientReported.severity}</span>
          </div>
        </div>

        {summary.patientReported.associatedSymptoms && summary.patientReported.associatedSymptoms.length > 0 && (
          <div className="rounded-xl bg-slate-950/40 p-3 border border-slate-800/80">
            <p className="text-slate-400 font-medium mb-1.5">
              {language === 'hi' ? 'संबंधित लक्षण:' : 'Associated Symptoms:'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {summary.patientReported.associatedSymptoms.map((symp, i) => (
                <span
                  key={i}
                  className="rounded-lg bg-teal-950/50 text-teal-300 border border-teal-500/20 px-2.5 py-1 text-[11px] font-medium"
                >
                  {symp}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl bg-cyan-950/20 border border-cyan-500/30 p-3 space-y-1.5">
          <div className="flex items-center gap-2 text-cyan-300 font-semibold">
            <Stethoscope className="h-4 w-4" />
            <span>{language === 'hi' ? 'सुझावित विभाग:' : 'Recommended Department:'}</span>
          </div>
          <p className="text-white text-sm font-medium pl-6">
            {summary.clinicalStructuring.recommendedDepartment}
          </p>
        </div>

        {summary.clinicalStructuring.suggestedQuestionsForDoctor && (
          <div className="rounded-xl bg-slate-950/40 p-3 border border-slate-800/80">
            <p className="text-slate-400 font-medium mb-1">
              {language === 'hi' ? 'डॉक्टर से पूछने योग्य प्रश्न:' : 'Suggested Questions for Your Doctor:'}
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
              {summary.clinicalStructuring.suggestedQuestionsForDoctor.map((q, idx) => (
                <li key={idx} className="leading-snug">{q}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[10px] text-slate-400 italic">
          {language === 'hi' ? 'अस्वीकरण:' : 'Disclaimer:'} {summary.clinicalStructuring.disclaimer}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
        <button
          onClick={handleSaveToClinic}
          disabled={isSaved || isSaving}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            isSaved
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
              : 'bg-slate-800 hover:bg-slate-700 text-white'
          }`}
        >
          {isSaved ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-teal-400" />
              <span>{language === 'hi' ? 'रिकॉर्ड में सुरक्षित' : 'Saved to Clinic Record'}</span>
            </>
          ) : (
            <>
              <FileText className="h-3.5 w-3.5 text-slate-300" />
              <span>{isSaving ? (language === 'hi' ? 'सुरक्षित हो रहा है...' : 'Saving...') : (language === 'hi' ? 'रिकॉर्ड में सुरक्षित करें' : 'Save to Clinic File')}</span>
            </>
          )}
        </button>

        {onProceedToKiosk && (
          <button
            onClick={onProceedToKiosk}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-slate-950 text-xs font-bold shadow-lg shadow-teal-500/20 transition-all active:scale-95 cursor-pointer"
          >
            <span>{language === 'hi' ? 'ओपीडी चेक-इन पर जाएं' : 'Proceed to OPD Check-in'}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

