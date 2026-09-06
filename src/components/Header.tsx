import React from 'react';
import { Workspace, Language } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../auth/AuthContext';
import { BackButton } from './BackButton';
import { Stethoscope, Building2, User, Home, Mic, LogOut } from 'lucide-react';
import { annaStore } from '../state/StateManager';

interface HeaderProps {
  currentWorkspace: Workspace;
  setWorkspace: (ws: Workspace) => void;
  language?: Language;
  setLanguage?: (lang: Language) => void;
  onBack?: () => void;
  canGoBack?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentWorkspace,
  setWorkspace,
  onBack,
  canGoBack,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const { doctor, hospital, logoutDoctor, logoutHospital } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-8 shrink-0 shadow-xs sticky top-0 z-40">
      {/* Brand & Back Button */}
      <div className="flex items-center gap-2 sm:gap-3">
        {currentWorkspace !== 'home' && (
          <BackButton
            onClick={onBack ? onBack : () => setWorkspace('home')}
            variant={currentWorkspace === 'home' ? 'home' : 'dashboard'}
            label={
              currentWorkspace === 'kiosk' ||
              currentWorkspace === 'patient' ||
              currentWorkspace === 'doctor' ||
              currentWorkspace === 'doctor-dashboard' ||
              currentWorkspace === 'admin' ||
              currentWorkspace === 'hospital-dashboard'
                ? language === 'hi'
                  ? '← मुख्य पृष्ठ'
                  : '← Home'
                : undefined
            }
            language={language}
          />
        )}

        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setWorkspace('home')}>
          <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center text-white font-black text-2xl shadow-inner select-none transition-transform hover:scale-105 shrink-0">
            M
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg sm:text-xl leading-none tracking-tight text-teal-950">MEDIKIOSK</span>
            </div>
            <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-teal-700 font-bold mt-0.5">
              {t.ministryHeader || 'Ministry of Ayush • AIIA'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Workspaces */}
      <nav className="hidden lg:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
        <button
          onClick={() => setWorkspace('home')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            currentWorkspace === 'home'
              ? 'bg-white text-teal-900 shadow-sm font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Home className="w-3.5 h-3.5 text-teal-600" />
          <span>{t.homeNav}</span>
        </button>

        <button
          onClick={() => setWorkspace('patient')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            currentWorkspace === 'patient' || currentWorkspace === 'kiosk'
              ? 'bg-white text-teal-900 shadow-sm font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <User className="w-3.5 h-3.5 text-teal-600" />
          <span>{t.patientModeNav}</span>
        </button>

        <button
          onClick={() => {
            if (doctor) {
              setWorkspace('doctor-dashboard');
            } else {
              setWorkspace('doctor-login');
            }
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            currentWorkspace === 'doctor' ||
            currentWorkspace === 'doctor-login' ||
            currentWorkspace === 'doctor-register' ||
            currentWorkspace === 'doctor-dashboard'
              ? 'bg-white text-teal-900 shadow-sm font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
          <span>
            {doctor
              ? `${doctor.fullName.split(' ')[0] || 'Dr.'} (${t.doctorDashboardNav || 'Dashboard'})`
              : (t.doctorPortalNav || 'Doctor Portal')}
          </span>
        </button>

        <button
          onClick={() => {
            if (hospital) {
              setWorkspace('hospital-dashboard');
            } else {
              setWorkspace('hospital-login');
            }
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            currentWorkspace === 'admin' ||
            currentWorkspace === 'hospital-login' ||
            currentWorkspace === 'hospital-register' ||
            currentWorkspace === 'hospital-dashboard'
              ? 'bg-white text-teal-900 shadow-sm font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-3.5 h-3.5 text-teal-600" />
          <span>
            {hospital
              ? `${hospital.hospitalName.slice(0, 10)}...`
              : (t.hospitalPortalNav || 'Hospital Portal')}
          </span>
        </button>
      </nav>

      {/* Right Controls: Language & Status & User Logout */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Anna Voice Assistant Quick Trigger */}
        <button
          onClick={() => annaStore.setState({ isOpen: true })}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white text-xs font-bold shadow-sm shadow-teal-600/30 transition-all hover:scale-105 cursor-pointer active:scale-95"
          title="Open Anna Voice AI Assistant"
        >
          <Mic className="w-3.5 h-3.5 text-teal-200 animate-pulse" />
          <span className="hidden sm:inline">{t.annaVoiceNav || 'Anna Voice AI'}</span>
          <span className="sm:hidden">Anna</span>
        </button>

        {/* Language Selector */}
        <div className="flex bg-slate-100 rounded-xl p-0.5 border border-slate-200">
          <button
            onClick={() => setLanguage('en')}
            className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              language === 'en'
                ? 'bg-white text-teal-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            English
          </button>
          <button
            onClick={() => setLanguage('hi')}
            className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              language === 'hi'
                ? 'bg-white text-teal-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            हिन्दी
          </button>
        </div>

        {/* ABDM Live Status Pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-200 select-none">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-tight">{t.abdmSync}</span>
        </div>

        {/* Active Auth Status / Logout */}
        {doctor && (
          <button
            onClick={() => {
              logoutDoctor();
              setWorkspace('home');
            }}
            title={t.logoutBtn || 'Logout Doctor'}
            className="flex items-center gap-1.5 px-2.5 py-1 text-slate-600 hover:text-red-700 text-xs rounded-xl border border-slate-200 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden md:inline text-[11px] font-semibold">{t.logoutBtn || 'Logout'}</span>
          </button>
        )}

        {!doctor && hospital && (
          <button
            onClick={() => {
              logoutHospital();
              setWorkspace('home');
            }}
            title={t.logoutBtn || 'Logout Hospital'}
            className="flex items-center gap-1.5 px-2.5 py-1 text-slate-600 hover:text-red-700 text-xs rounded-xl border border-slate-200 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden md:inline text-[11px] font-semibold">{t.logoutBtn || 'Logout'}</span>
          </button>
        )}
      </div>
    </header>
  );
};
