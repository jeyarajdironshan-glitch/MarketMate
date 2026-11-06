import React from 'react';
import { 
  Sprout, 
  Globe, 
  User, 
  Mic, 
  ShieldCheck, 
  Truck, 
  Store,
  LogOut,
  Bell
} from 'lucide-react';
import { translations } from '../i18n/translations';

export default function Navbar({ 
  currentLang, 
  onLangChange, 
  currentUser, 
  onRoleSwitch, 
  onOpenVoice,
  isVoiceActive,
  onLogout 
}) {
  const t = translations[currentLang] || translations.en;

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
      {/* Top Banner with Tagline and Demo Switcher */}
      <div className="bg-agri-dark text-white text-xs px-4 py-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium tracking-wide">
          <Sprout className="w-4 h-4 text-agri-mint shrink-0" />
          <span className="hidden sm:inline font-bold text-agri-300">MarketMate:</span>
          <span>{t.tagline}</span>
        </div>

        {/* Demo Role Switcher for instant testing */}
        <div className="flex items-center gap-2">
          <span className="text-slate-300 text-[11px] font-medium hidden md:inline">{t.demo_switch}</span>
          <div className="inline-flex rounded-md shadow-sm bg-agri-emerald/80 p-0.5" role="group">
            <button
              type="button"
              onClick={() => onRoleSwitch('supplier')}
              className={`px-2.5 py-0.5 text-[11px] font-semibold rounded flex items-center gap-1 transition ${
                currentUser?.role === 'supplier'
                  ? 'bg-white text-agri-dark shadow-sm'
                  : 'text-white hover:bg-agri-dark/50'
              }`}
            >
              <Sprout className="w-3 h-3 text-emerald-600" />
              {t.supplier} (Kamal)
            </button>
            <button
              type="button"
              onClick={() => onRoleSwitch('distributor')}
              className={`px-2.5 py-0.5 text-[11px] font-semibold rounded flex items-center gap-1 transition ${
                currentUser?.role === 'distributor'
                  ? 'bg-white text-agri-dark shadow-sm'
                  : 'text-white hover:bg-agri-dark/50'
              }`}
            >
              <Store className="w-3 h-3 text-blue-600" />
              {t.distributor} (Aruna)
            </button>
            <button
              type="button"
              onClick={() => onRoleSwitch('admin')}
              className={`px-2.5 py-0.5 text-[11px] font-semibold rounded flex items-center gap-1 transition ${
                currentUser?.role === 'admin'
                  ? 'bg-white text-agri-dark shadow-sm'
                  : 'text-white hover:bg-agri-dark/50'
              }`}
            >
              <ShieldCheck className="w-3 h-3 text-amber-500" />
              {t.admin}
            </button>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo and Platform Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-agri-dark to-agri-mint flex items-center justify-center text-white shadow-md shadow-agri-dark/15">
              <Sprout className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold text-agri-dark tracking-tight">MarketMate</span>
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  AgriTech SL
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">CBSL Wholesale Agricultural Network</p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            
            {/* Voice Assistant Trigger Button */}
            <button
              onClick={onOpenVoice}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition shadow-sm ${
                isVoiceActive
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-agri-50 text-agri-dark border border-agri-300 hover:bg-agri-100'
              }`}
              title="Voice Assistant (Sinhala, Tamil, English)"
            >
              <Mic className={`w-3.5 h-3.5 ${isVoiceActive ? 'text-white' : 'text-emerald-700'}`} />
              <span className="hidden sm:inline">{t.voice_assistant}</span>
            </button>

            {/* Language Selector */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <Globe className="w-3.5 h-3.5 text-slate-500 ml-1" />
              <select
                value={currentLang}
                onChange={(e) => onLangChange(e.target.value)}
                aria-label="Language Selector"
                className="bg-transparent text-xs font-bold text-slate-700 outline-none pr-1 cursor-pointer"
              >
                <option value="en">English (EN)</option>
                <option value="si">සිංහල (SI)</option>
                <option value="ta">தமிழ் (TA)</option>
              </select>
            </div>

            {/* User Profile Badge */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs border border-slate-300">
                {currentUser?.full_name ? currentUser.full_name[0] : 'U'}
              </div>
              <div className="hidden lg:block text-left text-xs leading-tight">
                <p className="font-bold text-slate-800">{currentUser?.full_name}</p>
                <p className="text-[10px] text-slate-500 uppercase font-semibold">{currentUser?.role}</p>
              </div>
            </div>

          </div>

        </div>
      </div>
    </header>
  );
}
