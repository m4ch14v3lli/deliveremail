import React, { useState, useEffect } from 'react';
import { ShieldCheck, Mail, Server, History, LogOut, PhoneCall, Key, UserCheck, Database } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { SupabaseSettingsModal } from './SupabaseSettingsModal';

export const Header: React.FC = () => {
  const { user, logout, isSupabase } = useAuth();
  const navigate = useNavigate();
  const [activeCaller, setActiveCaller] = useState<{ name: string; callerKey: string } | null>(null);
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('caller_session');
      if (stored) {
        setActiveCaller(JSON.parse(stored));
      }
    } catch {}
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="bg-white border-b border-gray-200 text-gray-900 sticky top-0 z-50 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <ShieldCheck className="w-6 h-6 text-gray-700" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-gray-900">Email Deliverability Health Checker</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-600 uppercase tracking-wider">
                Enterprise
              </span>
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-3 sm:gap-4 text-xs text-gray-500 font-medium">
          {/* Supabase Status & Setup Pill */}
          <button
            type="button"
            onClick={() => setShowSupabaseModal(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xs border text-xs font-semibold cursor-pointer transition-colors shadow-2xs ${
              isSupabase 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100' 
                : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 hover:border-gray-400'
            }`}
            title="Configure Supabase Authentication URL and Anon Key"
          >
            <span className={`w-2 h-2 rounded-full ${isSupabase ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></span>
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">{isSupabase ? 'Supabase Active' : 'Connect Supabase'}</span>
          </button>

          {/* Dedicated Caller Access Portal Point */}
          {activeCaller ? (
            <Link
              to="/outreach"
              className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 rounded-xs font-bold text-xs transition-colors shadow-2xs"
              title={`Logged in as ${activeCaller.name}. Click to view assigned queue`}
            >
              <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Caller: {activeCaller.name}</span>
            </Link>
          ) : (
            <Link
              to="/caller-access"
              className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xs font-bold text-xs transition-all shadow-2xs group"
              title="Enter your secret caller code to unlock leads"
            >
              <Key className="w-3.5 h-3.5 text-amber-600 group-hover:rotate-45 transition-transform" />
              <span>Caller Code Access</span>
            </Link>
          )}

          {user ? (
            <>
              <Link to="/outreach" className="flex items-center gap-1.5 text-gray-900 font-semibold hover:text-indigo-600 transition-colors">
                <PhoneCall className="w-4 h-4 text-indigo-600" />
                <span className="hidden sm:inline">Phone Outreach</span>
              </Link>
              <Link to="/bulk" className="flex items-center gap-1.5 hover:text-gray-900 transition-colors">
                <Server className="w-4 h-4" />
                <span className="hidden sm:inline">Bulk Audit (200)</span>
              </Link>
              <Link to="/history" className="flex items-center gap-1.5 hover:text-gray-900 transition-colors">
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">Audit History</span>
              </Link>
              <div className="h-4 w-px bg-gray-300"></div>
              <span className="truncate max-w-[120px] sm:max-w-[200px]">{user.email}</span>
              <button onClick={handleLogout} className="flex items-center gap-1.5 hover:text-gray-900 transition-colors cursor-pointer">
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          ) : (
            <>
              <Link to="/outreach" className="flex items-center gap-1.5 hover:text-gray-900 transition-colors">
                <PhoneCall className="w-4 h-4 text-indigo-600" />
                <span className="hidden sm:inline font-semibold">Phone Outreach</span>
              </Link>
              <div className="flex items-center gap-1.5 hidden lg:flex text-gray-400">
                <Mail className="w-3.5 h-3.5" />
                <span>RFC 7489</span>
              </div>
              <Link 
                to="/login" 
                className="text-xs font-semibold text-gray-700 hover:text-gray-900 px-2.5 py-1.5 rounded-sm hover:bg-gray-100 transition-colors"
              >
                Sign In
              </Link>
              <Link 
                to="/register" 
                className="text-xs font-semibold text-white bg-gray-900 hover:bg-gray-800 px-3 py-1.5 rounded-sm transition-colors shadow-xs"
              >
                Create Account
              </Link>
            </>
          )}
        </div>
      </div>
      <SupabaseSettingsModal
        isOpen={showSupabaseModal}
        onClose={() => setShowSupabaseModal(false)}
      />
    </header>
  );
};
