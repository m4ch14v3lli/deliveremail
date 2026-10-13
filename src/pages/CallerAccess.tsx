import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { CallerDashboard } from './CallerDashboard';
import { 
  Key, 
  ArrowRight, 
  AlertCircle, 
  Loader2, 
  Eye, 
  EyeOff, 
  User, 
  Mail,
  ShieldCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const CallerAccess: React.FC = () => {
  const [session, setSession] = useState<{ callerKey: string; name: string; email?: string } | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // Sign-in form states
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('caller_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.callerKey) {
          setSession(parsed);
        }
      }
    } catch {}
    setCheckingSession(false);
  }, []);

  // If already logged in, render the dedicated Caller Dashboard (leads + spreadsheet only)
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (session) {
    return <CallerDashboard />;
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCode = code.trim();
    if (!rawCode) {
      setError('Please enter your caller passcode.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/caller/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          code: rawCode,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = null;
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => null);
      } else {
        const text = await res.text().catch(() => '');
        throw new Error(res.status === 404 ? 'API service unreachable.' : `Server response (${res.status}): ${text.slice(0, 100)}`);
      }

      if (!res.ok || !data?.caller) {
        throw new Error(data?.error || 'Invalid passcode. Please verify your assigned access code.');
      }

      const callerData = data.caller;
      const callerToken = data.token || '';

      // Store caller session in localStorage
      localStorage.setItem('caller_session', JSON.stringify(callerData));
      if (callerToken) {
        localStorage.setItem('caller_token', callerToken);
      }

      // Immediately switch to Caller Dashboard view
      setSession(callerData);

    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your passcode.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Header />

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-10">
        <div className="max-w-md w-full space-y-6">
          
          {/* Header Title */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold uppercase tracking-wider">
              <Key className="w-3.5 h-3.5" />
              <span>Caller Access Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              Sign In to Your Dial Sheet
            </h1>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Enter your passcode below to unlock and work your assigned leads.
            </p>
          </div>

          {/* Main Card with Self-Input Form */}
          <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-6 sm:p-8">
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-600" />
                    Caller Passcode <span className="text-red-500">*</span>
                  </span>
                </label>
                <div className="relative">
                  <input
                    type={showCode ? 'text' : 'password'}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Enter access code"
                    className="w-full px-3 py-2 text-sm font-mono font-bold text-gray-900 bg-white border border-gray-300 rounded-sm focus:ring-1 focus:ring-amber-600 focus:border-amber-600 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCode(!showCode)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1 cursor-pointer"
                    title={showCode ? "Hide passcode" : "Show passcode"}
                  >
                    {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-gray-500" />
                  Caller Name (Optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-sm focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-gray-500" />
                  Work Email (Optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@company.com"
                  className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-sm focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-sm text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider rounded-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying Passcode...</span>
                  </>
                ) : (
                  <>
                    <span>Unlock Dial Sheet &amp; Enter</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <Link to="/login" className="hover:text-gray-900 underline font-medium">
                Standard Account Sign In
              </Link>
              <Link to="/" className="hover:text-gray-900 flex items-center gap-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                Back to Auditor
              </Link>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};
