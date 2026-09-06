import React from 'react';
import { Workspace, Language } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../auth/AuthContext';
import {
  Mic,
  FileText,
  Stethoscope,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Activity,
  UserCheck,
  Building2,
  Lock,
} from 'lucide-react';
import { annaStore } from '../state/StateManager';

interface HomeLandingProps {
  setWorkspace: (ws: Workspace) => void;
  language?: Language;
  setLanguage?: (lang: Language) => void;
  onQuickDemoStart?: () => void;
}

export const HomeLanding: React.FC<HomeLandingProps> = ({
  setWorkspace,
}) => {
  const { t } = useLanguage();
  const { doctor, hospital } = useAuth();

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto">
      {/* Top Banner */}
      <div className="bg-teal-900 text-teal-100 px-4 py-2 text-xs flex flex-wrap items-center justify-between border-b border-teal-800">
        <div className="flex items-center gap-2">
          <span className="bg-teal-700 text-white px-2 py-0.5 rounded font-bold uppercase text-[10px]">
            {t.homeTopBannerTag}
          </span>
          <span className="font-medium">{t.homeTopBannerTitle}</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-teal-300">
          <span>{t.homeBadgeFhir}</span>
          <span>•</span>
          <span>{t.homeBadgeBilingual}</span>
          <span>•</span>
          <span>{t.homeBadgeVoice}</span>
        </div>
      </div>

      <main className="flex-grow flex flex-col items-center justify-center px-4 sm:px-10 py-10 max-w-6xl mx-auto w-full">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            {t.homeNextGenBadge}
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            {t.homeHeroTitle1}
            <span className="text-teal-600">{t.homeHeroTitle2}</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 leading-relaxed font-normal mb-8">
            {t.homeHeroDesc}
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => annaStore.setState({ isOpen: true })}
              className="px-8 py-4 bg-gradient-to-r from-teal-600 via-cyan-600 to-emerald-600 hover:from-teal-500 hover:to-cyan-500 text-white rounded-xl font-bold text-lg shadow-xl shadow-teal-500/25 transition-all flex items-center gap-3 cursor-pointer hover:scale-[1.03] active:scale-95"
            >
              <Mic className="w-5 h-5 text-teal-200 animate-pulse" />
              <span>{t.homeTalkToAnna}</span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wider font-extrabold">
                {t.homeLiveBadge}
              </span>
            </button>

            <button
              onClick={() => setWorkspace('kiosk')}
              className="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-lg shadow-lg transition-all flex items-center gap-2 cursor-pointer hover:scale-[1.02]"
            >
              <span>{t.homeEnterKiosk}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 w-full gap-5 mb-12">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-2xl mb-4">
              <Mic className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1.5">{t.featCard1Title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {t.featCard1Desc}
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center text-2xl mb-4">
              <FileText className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1.5">{t.featCard2Title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {t.featCard2Desc}
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center text-2xl mb-4">
              <Stethoscope className="w-6 h-6 text-teal-600" />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1.5">{t.featCard3Title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {t.featCard3Desc}
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center text-2xl mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1.5">{t.featCard4Title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {t.featCard4Desc}
            </p>
          </div>
        </div>

        {/* Anna Voice Assistant Spotlight Card */}
        <div className="w-full mb-12 overflow-hidden rounded-3xl border border-teal-500/30 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-6 sm:p-8 text-white shadow-2xl relative">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-teal-500/15 blur-3xl pointer-events-none" />
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-teal-500/20 border border-teal-500/30 px-3 py-1 text-xs font-semibold text-teal-300">
                <Activity className="h-3.5 w-3.5 text-teal-400 animate-pulse" />
                <span>{t.annaSpotlightTag}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                <span>{t.annaSpotlightModel}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {t.annaSpotlightTitle}
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                {t.annaSpotlightDesc}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="text-xs bg-slate-800/80 border border-slate-700/80 text-teal-200 px-3 py-1 rounded-lg">
                  {t.annaExample1}
                </span>
                <span className="text-xs bg-slate-800/80 border border-slate-700/80 text-cyan-200 px-3 py-1 rounded-lg">
                  {t.annaExample2}
                </span>
                <span className="text-xs bg-slate-800/80 border border-slate-700/80 text-purple-200 px-3 py-1 rounded-lg">
                  {t.annaExample3}
                </span>
              </div>
            </div>

            <button
              onClick={() => annaStore.setState({ isOpen: true })}
              className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-bold px-6 py-4 shadow-xl shadow-teal-500/30 transition-all hover:scale-105 active:scale-95 shrink-0 cursor-pointer"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-teal-400">
                <Mic className="h-5 w-5 animate-bounce-short" />
              </div>
              <div className="text-left">
                <div className="text-sm font-extrabold">{t.annaStartSession}</div>
                <div className="text-[11px] font-medium text-slate-900/80">{t.annaTapToSpeak}</div>
              </div>
            </button>
          </div>
        </div>

        {/* The MediKiosk Solution Section (Full-Width, Completely Replacing The Problem Section) */}
        <div className="w-full bg-white p-6 sm:p-8 rounded-3xl border border-teal-100 shadow-sm mb-12">
          <div className="flex items-center gap-2 mb-2 text-teal-700 font-bold text-xs uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>{t.solutionBadge}</span>
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-2">{t.solutionTitle}</h3>
          <p className="text-xs text-slate-500 mb-6 max-w-3xl leading-relaxed">
            {t.solutionDesc}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-100/80">
              <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs mb-2.5">
                ✓
              </div>
              <h4 className="font-bold text-slate-900 text-sm mb-1">{t.solPoint1Title}</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{t.solPoint1Desc}</p>
            </div>

            <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-100/80">
              <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs mb-2.5">
                ✓
              </div>
              <h4 className="font-bold text-slate-900 text-sm mb-1">{t.solPoint2Title}</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{t.solPoint2Desc}</p>
            </div>

            <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-100/80">
              <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs mb-2.5">
                ✓
              </div>
              <h4 className="font-bold text-slate-900 text-sm mb-1">{t.solPoint3Title}</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{t.solPoint3Desc}</p>
            </div>

            <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-100/80">
              <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs mb-2.5">
                ✓
              </div>
              <h4 className="font-bold text-slate-900 text-sm mb-1">{t.solPoint4Title}</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{t.solPoint4Desc}</p>
            </div>
          </div>
        </div>

        {/* Measurable Clinical Impact */}
        <div className="w-full bg-gradient-to-r from-teal-900 to-slate-900 text-white p-6 sm:p-8 rounded-3xl mb-12 shadow-lg">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-6">
              <span className="text-[11px] font-bold uppercase tracking-widest text-teal-300">
                {t.impactTag}
              </span>
              <h3 className="text-2xl font-black mt-1">{t.impactTitle}</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
              <div>
                <p className="text-3xl sm:text-4xl font-black text-amber-400">{t.impactStat1Val}</p>
                <p className="text-xs text-teal-100 font-semibold mt-1">{t.impactStat1Label}</p>
                <p className="text-[10px] text-teal-300 mt-0.5">{t.impactStat1Sub}</p>
              </div>
              <div>
                <p className="text-3xl sm:text-4xl font-black text-amber-400">{t.impactStat2Val}</p>
                <p className="text-xs text-teal-100 font-semibold mt-1">{t.impactStat2Label}</p>
                <p className="text-[10px] text-teal-300 mt-0.5">{t.impactStat2Sub}</p>
              </div>
              <div>
                <p className="text-3xl sm:text-4xl font-black text-amber-400">{t.impactStat3Val}</p>
                <p className="text-xs text-teal-100 font-semibold mt-1">{t.impactStat3Label}</p>
                <p className="text-[10px] text-teal-300 mt-0.5">{t.impactStat3Sub}</p>
              </div>
              <div>
                <p className="text-3xl sm:text-4xl font-black text-amber-400">{t.impactStat4Val}</p>
                <p className="text-xs text-teal-100 font-semibold mt-1">{t.impactStat4Label}</p>
                <p className="text-[10px] text-teal-300 mt-0.5">{t.impactStat4Sub}</p>
              </div>
            </div>
          </div>
        </div>

        {/* How MediKiosk Works Section */}
        <div className="w-full bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-md relative mb-12">
          <div className="absolute -top-3.5 left-8 px-4 py-1 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-full">
            {t.howItWorksBadge}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-2">
            <div className="flex flex-col items-center text-center p-3">
              <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold text-lg shadow-sm mb-3">
                01
              </div>
              <span className="font-bold text-slate-900 text-sm">{t.howStep1Title}</span>
              <p className="text-[11px] text-slate-500 mt-1">{t.howStep1Desc}</p>
            </div>

            <div className="flex flex-col items-center text-center p-3">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center font-bold text-lg shadow-sm mb-3">
                02
              </div>
              <span className="font-bold text-slate-900 text-sm">{t.howStep2Title}</span>
              <p className="text-[11px] text-slate-500 mt-1">{t.howStep2Desc}</p>
            </div>

            <div className="flex flex-col items-center text-center p-3">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center font-bold text-lg shadow-sm mb-3">
                03
              </div>
              <span className="font-bold text-slate-900 text-sm">{t.howStep3Title}</span>
              <p className="text-[11px] text-slate-500 mt-1">{t.howStep3Desc}</p>
            </div>

            <div className="flex flex-col items-center text-center p-3">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center font-bold text-lg shadow-sm mb-3">
                04
              </div>
              <span className="font-bold text-slate-900 text-sm">{t.howStep4Title}</span>
              <p className="text-[11px] text-slate-500 mt-1">{t.howStep4Desc}</p>
            </div>

            <div className="col-span-2 sm:col-span-1 flex flex-col items-center text-center p-3">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center font-bold text-lg shadow-sm mb-3">
                05
              </div>
              <span className="font-bold text-slate-900 text-sm">{t.howStep5Title}</span>
              <p className="text-[11px] text-slate-500 mt-1">{t.howStep5Desc}</p>
            </div>
          </div>
        </div>

        {/* Role Portal Cards */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
          {/* 1. PATIENT CARD */}
          <div
            onClick={() => setWorkspace('patient')}
            className="p-6 bg-white border border-slate-200 rounded-2xl hover:border-teal-500 hover:shadow-lg cursor-pointer transition-all group flex flex-col justify-between relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-teal-50/50 rounded-full -mr-8 -mt-8 pointer-events-none" />
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200">
                  {t.roleCardPatientTag || 'PATIENT'}
                </span>
                <div className="w-8 h-8 rounded-lg bg-teal-50 group-hover:bg-teal-600 text-teal-700 group-hover:text-white flex items-center justify-center transition-colors">
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-1.5 group-hover:text-teal-700 transition-colors">
                {t.roleCardPatientTitle || 'Patient Consultation'}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                {t.roleCardPatientDesc ||
                  'Talk with the AI assistant, share symptoms, upload documents, and continue with the patient consultation flow.'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-bold text-teal-700">
              <span>{t.roleCardPatientAction || 'Start Consultation'}</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 2. DOCTOR LOGIN CARD */}
          <div
            onClick={() => {
              if (doctor) {
                setWorkspace('doctor-dashboard');
              } else {
                setWorkspace('doctor-login');
              }
            }}
            className="p-6 bg-white border border-slate-200 rounded-2xl hover:border-teal-500 hover:shadow-lg cursor-pointer transition-all group flex flex-col justify-between relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/50 rounded-full -mr-8 -mt-8 pointer-events-none" />
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {t.roleCardDoctorTag || 'DOCTOR LOGIN'}
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 group-hover:bg-emerald-600 text-emerald-800 group-hover:text-white flex items-center justify-center transition-colors">
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-1.5 group-hover:text-teal-700 transition-colors flex items-center gap-2">
                <span>{t.roleCardDoctorTitle || 'Doctor Portal'}</span>
                {doctor && (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                    {doctor.fullName.split(' ')[0] || 'Active'}
                  </span>
                )}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                {t.roleCardDoctorDesc ||
                  'Secure login or registration for doctors to access patient consultations and clinical tools.'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-bold text-emerald-800">
              <span>{doctor ? (t.doctorDashboardNav || 'Open Dashboard') : (t.roleCardDoctorAction || 'Doctor Portal')}</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 3. HOSPITAL LOGIN CARD */}
          <div
            onClick={() => {
              if (hospital) {
                setWorkspace('hospital-dashboard');
              } else {
                setWorkspace('hospital-login');
              }
            }}
            className="p-6 bg-white border border-slate-200 rounded-2xl hover:border-teal-500 hover:shadow-lg cursor-pointer transition-all group flex flex-col justify-between relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-50/50 rounded-full -mr-8 -mt-8 pointer-events-none" />
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-cyan-50 text-cyan-800 border border-cyan-200">
                  {t.roleCardHospitalTag || 'HOSPITAL LOGIN'}
                </span>
                <div className="w-8 h-8 rounded-lg bg-cyan-50 group-hover:bg-teal-700 text-cyan-800 group-hover:text-white flex items-center justify-center transition-colors">
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-1.5 group-hover:text-teal-700 transition-colors flex items-center gap-2">
                <span>{t.roleCardHospitalTitle || 'Hospital Portal'}</span>
                {hospital && (
                  <span className="text-[10px] bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded-full font-semibold">
                    {hospital.hospitalName.slice(0, 14)}...
                  </span>
                )}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                {t.roleCardHospitalDesc ||
                  'Login to an existing hospital account or register your hospital to manage doctors and patient services.'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-bold text-teal-800">
              <span>{hospital ? (t.hospitalDashboardNav || 'Open Dashboard') : (t.roleCardHospitalAction || 'Hospital Portal')}</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-12 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between px-4 sm:px-10 shrink-0 text-[11px] text-slate-500 font-medium">
        <div>{t.footerPlatformInfo}</div>
        <div className="flex items-center gap-4 uppercase tracking-wider text-[10px]">
          <span className="text-teal-700 font-bold">{t.footerFhirBadge}</span>
          <span className="text-slate-300">|</span>
          <span className="text-teal-700 font-bold">{t.footerAbhaBadge}</span>
          <span className="text-slate-300">|</span>
          <span className="text-teal-700 font-bold">{t.footerAyushBadge}</span>
        </div>
      </footer>
    </div>
  );
};
