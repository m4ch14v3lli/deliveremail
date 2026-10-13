import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  Loader2, 
  ArrowLeft, 
  AlertCircle, 
  Key, 
  ArrowRight,
  PhoneCall,
  User,
  Mail,
  Eye,
  EyeOff
} from 'lucide-react';

export const Login: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'admin' | 'caller'>('admin');

  // Admin / User Auth states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { loginWithEmail, loginWithSupabaseOAuth, isSupabase } = useAuth();
  const navigate = useNavigate();

  // Caller Passcode Login states
  const [callerCode, setCallerCode] = useState('');
  const [callerName, setCallerName] = useState('');
  const [callerEmail, setCallerEmail] = useState('');
  const [showCallerCode, setShowCallerCode] = useState(false);
  const [callerLoading, setCallerLoading] = useState(false);
  const [callerError, setCallerError] = useState<string | null>(null);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);
    try {
      await loginWithEmail(email, password);
      navigate('/');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleCallerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = callerCode.trim();
    if (!raw) {
      setCallerError('Please enter your caller passcode.');
      return;
    }
    setCallerLoading(true);
    setCallerError(null);
    try {
      const res = await fetch('/api/caller/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: raw,
          name: callerName.trim() || undefined,
          email: callerEmail.trim() || undefined,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = null;
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => null);
      } else {
        const text = await res.text().catch(() => '');
        throw new Error(res.status === 404 ? 'API service unreachable.' : `Server error (${res.status}): ${text.slice(0, 100)}`);
      }

      if (!res.ok || !data?.caller) {
        throw new Error(data?.error || 'Invalid caller passcode. Please verify your access code.');
      }

      // Save caller session
      localStorage.setItem('caller_session', JSON.stringify(data.caller));
      if (data.token) {
        localStorage.setItem('caller_token', data.token);
      }

      // Navigate straight to dedicated caller dial sheet!
      navigate('/caller', {
        state: {
          fromCallerLogin: true,
          callerKey: data.caller.callerKey,
        },
      });
    } catch (err: any) {
      setCallerError(err.message || 'Failed to authenticate caller code.');
    } finally {
      setCallerLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    setErrorMessage(null);
    try {
      await loginWithSupabaseOAuth(provider);
    } catch (err: any) {
      setErrorMessage(err.message || `Failed to sign in with ${provider}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-6 sm:p-8 w-full max-w-md">
        <div className="flex justify-center mb-4">
          <ShieldCheck className="w-10 h-10 text-gray-900" />
        </div>
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-1">Sign In</h2>
        <p className="text-xs text-gray-500 text-center mb-6">
          Email Deliverability Health Checker &amp; Outreach Platform
        </p>

        {/* Tab Switcher: Account Login / Caller Code Access */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-100 rounded-sm mb-6 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className={`py-2 rounded-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Account Login</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('caller')}
            className={`py-2 rounded-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'caller'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-800 hover:text-amber-950 hover:bg-amber-100/50'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Caller Code Access</span>
          </button>
        </div>

        {/* ================= TAB 1: ADMIN / USER LOGIN ================= */}
        {activeTab === 'admin' && (
          <div>
            {errorMessage && (
              <div className="p-3 mb-5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gray-900 text-white font-medium text-sm rounded-sm hover:bg-gray-800 disabled:bg-gray-400 flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Sign In with Email
              </button>
            </form>

            {isSupabase && (
              <>
                <div className="mt-5 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                  <span className="px-3 text-xs uppercase tracking-wider text-gray-500 font-bold bg-white">OR</span>
                  <div className="w-full border-t border-gray-200"></div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleOAuth('google')}
                    className="py-2 px-3 border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 rounded-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Google
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOAuth('github')}
                    className="py-2 px-3 border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 rounded-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    GitHub
                  </button>
                </div>
              </>
            )}

            {/* Quick Caller Access Link on Admin Tab */}
            <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-xs">
              <span className="text-gray-500">Phone outreach caller?</span>
              <button
                type="button"
                onClick={() => setActiveTab('caller')}
                className="text-amber-700 hover:text-amber-900 font-bold underline flex items-center gap-1 cursor-pointer"
              >
                <Key className="w-3 h-3" />
                <span>Enter Caller Code →</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= TAB 2: CALLER PASSCODE LOGIN ================= */}
        {activeTab === 'caller' && (
          <div>
            <div className="bg-amber-50/70 border border-amber-200 rounded-sm p-3.5 mb-4">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs mb-1">
                <PhoneCall className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Phone Outreach Caller Access</span>
              </div>
              <p className="text-[11px] text-gray-600 leading-snug">
                Enter your secret caller passcode below to unlock and dial your assigned leads.
              </p>
            </div>

            {callerError && (
              <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                <span>{callerError}</span>
              </div>
            )}

            <form onSubmit={handleCallerLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-600" />
                    Caller Passcode <span className="text-red-500">*</span>
                  </span>
                </label>
                <div className="relative">
                  <input
                    type={showCallerCode ? 'text' : 'password'}
                    required
                    value={callerCode}
                    onChange={(e) => setCallerCode(e.target.value)}
                    placeholder="Enter your access code"
                    className="w-full px-3 py-2 text-sm font-mono font-bold text-gray-900 bg-white border border-gray-300 rounded-sm focus:ring-1 focus:ring-amber-600 focus:border-amber-600 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCallerCode(!showCallerCode)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1 cursor-pointer"
                    title={showCallerCode ? "Hide passcode" : "Show passcode"}
                  >
                    {showCallerCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-gray-500" />
                  Your Name (Optional)
                </label>
                <input
                  type="text"
                  value={callerName}
                  onChange={(e) => setCallerName(e.target.value)}
                  placeholder="e.g. Alex"
                  className="w-full px-3 py-2 text-xs text-gray-900 bg-white border border-gray-300 rounded-sm focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-gray-500" />
                  Work Email (Optional)
                </label>
                <input
                  type="email"
                  value={callerEmail}
                  onChange={(e) => setCallerEmail(e.target.value)}
                  placeholder="alex@company.com"
                  className="w-full px-3 py-2 text-xs text-gray-900 bg-white border border-gray-300 rounded-sm focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                />
              </div>

              <button
                type="submit"
                disabled={callerLoading || !callerCode.trim()}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white font-bold text-xs uppercase tracking-wider rounded-sm flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs mt-2"
              >
                {callerLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <span>Unlock Dial Sheet &amp; Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col items-center gap-2.5">
          <p className="text-center text-xs text-gray-600">
            Don't have an account? <Link to="/register" className="text-gray-900 font-bold hover:underline">Register</Link>
          </p>
          <Link
            to="/"
            className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1 font-medium transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Continue to Auditor as Guest (No Account Required)
          </Link>
        </div>
      </div>
    </div>
  );
};
