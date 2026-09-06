import React from 'react';
import { AlertTriangle, PhoneCall, ShieldAlert, X } from 'lucide-react';
import { EmergencyInfo } from '../../types/anna';
import { useLanguage } from '../../i18n/LanguageContext';

interface AnnaEmergencyBannerProps {
  emergency: EmergencyInfo;
  onDismiss: () => void;
}

export const AnnaEmergencyBanner: React.FC<AnnaEmergencyBannerProps> = ({ emergency, onDismiss }) => {
  const { language, t } = useLanguage();

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-red-500/50 bg-gradient-to-br from-red-950/90 via-red-900/40 to-slate-950/90 p-5 shadow-2xl backdrop-blur-xl animate-pulse-subtle">
      {/* Top emergency badge */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-red-500/30">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600/30 border border-red-400/40 text-red-400 animate-bounce-short">
            <ShieldAlert className="h-5 w-5 text-red-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-ping" />
              <h4 className="text-sm font-bold tracking-wide uppercase text-red-200">
                {t.emergencyTitle || 'Medical Emergency Alert'}
              </h4>
            </div>
            <p className="text-xs text-red-300/80">
              {t.emergencySubtitle || 'Immediate clinical attention recommended'}
            </p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="rounded-lg p-1.5 text-red-300 hover:bg-red-900/40 hover:text-white transition-colors cursor-pointer"
          title="Dismiss Alert"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Emergency details */}
      <div className="mt-3.5 space-y-2">
        <div className="rounded-xl bg-red-900/20 border border-red-500/20 p-3">
          <p className="text-xs font-semibold text-red-300 uppercase tracking-wider mb-1">
            {language === 'hi' ? 'पहचाने गए गंभीर लक्षण:' : 'Detected Critical Concern:'}
          </p>
          <p className="text-sm font-medium text-white leading-snug">{emergency.reason}</p>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl bg-slate-900/60 p-3 border border-red-500/20">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
          <div className="text-xs text-slate-200 leading-relaxed space-y-1">
            <p className="font-semibold text-amber-300">
              {language === 'hi' ? 'सुरक्षा सलाह:' : 'Life-Safety Advisory:'}
            </p>
            <p>{emergency.recommendedAction}</p>
            <p className="text-slate-300 italic pt-1">
              {language === 'hi' ? '• यदि कोई आपके साथ है, तो उन्हें साथ रहने के लिए कहें।' : '• If someone is with you, ask them to stay with you.'}
              <br />
              {language === 'hi' ? '• यदि आपको चक्कर आ रहा है या सांस लेने में तकलीफ है, तो वाहन न चलाएं।' : '• Do not attempt to drive yourself if you are feeling faint or breathless.'}
            </p>
          </div>
        </div>
      </div>

      {/* Emergency Hotline Buttons */}
      <div className="mt-4 pt-3 border-t border-red-500/20">
        <p className="text-xs font-semibold text-red-300 mb-2">
          {language === 'hi' ? 'आपातकालीन संपर्क नंबर:' : 'Direct Emergency Contacts:'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <a
            href="tel:112"
            className="flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 text-white py-2.5 px-3 text-xs font-bold shadow-lg shadow-red-600/30 transition-all active:scale-95"
          >
            <PhoneCall className="h-3.5 w-3.5" />
            <span>{language === 'hi' ? '112 कॉल करें (राष्ट्रीय)' : 'Call 112 (National)'}</span>
          </a>
          <a
            href="tel:108"
            className="flex items-center justify-center gap-2 rounded-xl bg-red-800 hover:bg-red-700 text-white py-2.5 px-3 text-xs font-bold border border-red-400/30 shadow-lg transition-all active:scale-95"
          >
            <PhoneCall className="h-3.5 w-3.5" />
            <span>{language === 'hi' ? '108 कॉल करें (एम्बुलेंस)' : 'Call 108 (Ambulance)'}</span>
          </a>
        </div>
      </div>
    </div>
  );
};

