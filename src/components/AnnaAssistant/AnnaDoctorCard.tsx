import React from 'react';
import { User, Stethoscope, Star, Clock, Calendar, X } from 'lucide-react';
import { DoctorProfile } from '../../types/anna';
import { useLanguage } from '../../i18n/LanguageContext';

interface AnnaDoctorCardProps {
  doctor: DoctorProfile | { name: string; department: string };
  onClose: () => void;
  onBookConsultation: () => void;
}

export const AnnaDoctorCard: React.FC<AnnaDoctorCardProps> = ({
  doctor,
  onClose,
  onBookConsultation,
}) => {
  const { language, t } = useLanguage();
  const isFullProfile = 'experienceYears' in doctor;
  const doc = doctor as DoctorProfile;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-900/95 backdrop-blur-xl p-4 shadow-2xl text-slate-100 animate-fadeIn">
      <div className="flex items-start justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/30 to-teal-500/20 border border-cyan-500/40 text-cyan-300">
            <User className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white leading-tight">{doctor.name}</h4>
            <p className="text-xs text-cyan-300 font-medium">
              {isFullProfile ? doc.specialty : doctor.department}
            </p>
            <p className="text-[11px] text-slate-400">{doctor.department}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isFullProfile && (
        <div className="mt-3 space-y-2 text-xs">
          <p className="text-slate-300 text-[11px] leading-relaxed line-clamp-2">{doc.bio}</p>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Clock className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <span>{doc.opdTiming}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400 shrink-0" />
              <span>{doc.rating} / 5.0 {language === 'hi' ? 'रेटिंग' : 'rating'}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-1">
            <Calendar className="h-3.5 w-3.5 text-teal-400 shrink-0" />
            <span>{language === 'hi' ? 'उपलब्ध:' : 'Available:'} {doc.availableDays.join(', ')}</span>
          </div>
        </div>
      )}

      <div className="mt-3.5 pt-2.5 border-t border-slate-800 flex items-center justify-between">
        <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          {t.doctorOpdOpen || 'OPD Queue Open'}
        </span>
        <button
          onClick={onBookConsultation}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all active:scale-95 cursor-pointer"
        >
          <Stethoscope className="h-3.5 w-3.5" />
          <span>{t.doctorConsultKiosk || 'Consult in Kiosk'}</span>
        </button>
      </div>
    </div>
  );
};

