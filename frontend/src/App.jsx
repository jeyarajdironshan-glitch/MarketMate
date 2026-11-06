import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import VoiceAssistant from './components/VoiceAssistant';
import DigitalSettlementSlipModal from './components/DigitalSettlementSlipModal';
import PayHereModal from './components/PayHereModal';
import SupplierDashboard from './dashboards/SupplierDashboard';
import DistributorDashboard from './dashboards/DistributorDashboard';
import AdminDashboard from './dashboards/AdminDashboard';
import { translations } from './i18n/translations';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ProtectedRoute from './components/ProtectedRoute';

// Pre‑seeded demo credentials – kept for quick dev role switch
const DEMO_CREDENTIALS = {
  supplier: { email: 'kamal@supplier.lk', password: 'MarketMate@2026' },
  distributor: { email: 'aruna@distributor.lk', password: 'MarketMate@2026' },
  admin: { email: 'admin@marketmate.lk', password: 'Admin@123' }
};

export default function App() {
  const [currentLang, setCurrentLang] = useState(() => localStorage.getItem('mm_lang') || 'en');
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('mm_token') || '');
  const [activeRole, setActiveRole] = useState('supplier');
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState(null);
  const [payHereDelivery, setPayHereDelivery] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Demo auto‑login – useful while developing; will be bypassed when a real token exists
  const loginDemoRole = async (roleName) => {
    setIsLoadingAuth(true);
    const creds = DEMO_CREDENTIALS[roleName];
    if (!creds) return;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds)
      });
      const data = await res.json();
      if (data.success) {
        setToken(data.token);
        setCurrentUser(data.user);
        setActiveRole(data.user.role);
        localStorage.setItem('mm_token', data.token);
        if (data.user.preferred_language) {
          setCurrentLang(data.user.preferred_language);
          localStorage.setItem('mm_lang', data.user.preferred_language);
        }
      }
    } catch (e) {
      console.error('Demo login error', e);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  // Verify existing token on mount; otherwise stay on login/signup flow
  useEffect(() => {
    if (!token) {
      setIsLoadingAuth(false);
      return;
    }
    const verify = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setCurrentUser(data.user);
          setActiveRole(data.user.role);
        } else {
          // Invalid / expired token – clear it
          setToken('');
          setCurrentUser(null);
          localStorage.removeItem('mm_token');
        }
      } catch (e) {
        console.warn('Token verification failed', e);
        setToken('');
        setCurrentUser(null);
        localStorage.removeItem('mm_token');
      } finally {
        setIsLoadingAuth(false);
      }
    };
    verify();
  }, [token]);

  // Language switch
  const handleLangChange = async (newLang) => {
    setCurrentLang(newLang);
    localStorage.setItem('mm_lang', newLang);
    if (token) {
      try {
        await fetch('/api/auth/language', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ language: newLang })
        });
      } catch (e) {
        console.warn('Language persistence error', e);
      }
    }
  };

  const handleVoiceAction = (voiceResult) => {
    console.log('[App] Voice Action', voiceResult);
  };

  const t = translations[currentLang] || translations.en;

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Navbar
          currentLang={currentLang}
          onLangChange={handleLangChange}
          currentUser={currentUser}
          onRoleSwitch={(role) => loginDemoRole(role)}
          onOpenVoice={() => setIsVoiceOpen(true)}
          isVoiceActive={isVoiceOpen}
          onLogout={() => {
            setCurrentUser(null);
            setToken('');
            localStorage.removeItem('mm_token');
          }}
        />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {isLoadingAuth ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-12 h-12 border-4 border-agri-dark border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loading MarketMate...</p>
            </div>
          ) : (
            <Routes>
              <Route path="/login" element={<Login setToken={setToken} setCurrentUser={setCurrentUser} setActiveRole={setActiveRole} />} />
              <Route path="/signup" element={<Signup setToken={setToken} setCurrentUser={setCurrentUser} setActiveRole={setActiveRole} />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute token={token}>
                    {activeRole === 'supplier' && (
                      <SupplierDashboard currentUser={currentUser} currentLang={currentLang} token={token} onOpenVoice={() => setIsVoiceOpen(true)} onViewSlip={(d) => setSelectedSlip(d)} />
                    )}
                    {activeRole === 'distributor' && (
                      <DistributorDashboard currentUser={currentUser} currentLang={currentLang} token={token} onViewSlip={(d) => setSelectedSlip(d)} onOpenPayHere={(d) => setPayHereDelivery(d)} />
                    )}
                    {activeRole === 'admin' && (
                      <AdminDashboard currentUser={currentUser} currentLang={currentLang} token={token} onViewSlip={(d) => setSelectedSlip(d)} />
                    )}
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to={token ? '/dashboard' : '/login'} replace />} />
            </Routes>
          )}
        </main>
        <DigitalSettlementSlipModal
          isOpen={!!selectedSlip}
          onClose={() => setSelectedSlip(null)}
          delivery={selectedSlip}
          currentUser={currentUser}
          currentLang={currentLang}
          token={token}
          onStatusUpdated={() => { window.location.reload(); }}
          onOpenPayHere={(d) => { setSelectedSlip(null); setPayHereDelivery(d); }}
        />
        <PayHereModal
          isOpen={!!payHereDelivery}
          onClose={() => setPayHereDelivery(null)}
          delivery={payHereDelivery}
          token={token}
          currentLang={currentLang}
          onPaymentSuccess={() => { setTimeout(() => { setPayHereDelivery(null); window.location.reload(); }, 1500); }}
        />
        <VoiceAssistant isOpen={isVoiceOpen} onClose={() => setIsVoiceOpen(false)} currentLang={currentLang} onExecuteAction={handleVoiceAction} token={token} />
        <footer className="bg-white border-t border-slate-200 text-xs text-slate-500 py-6 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2"><span className="font-extrabold text-agri-dark">MarketMate</span><span>•</span></div>
          </div>
        </footer>
      </div>
    </Router>
  );
}
