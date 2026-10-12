import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { 
  Key, 
  ShieldCheck, 
  PhoneCall, 
  ArrowRight, 
  UserCheck, 
  AlertCircle, 
  Loader2, 
  CheckCircle2, 
  Sparkles, 
  Table, 
  FileText,
  Eye,
  EyeOff,
  LogOut
} from 'lucide-react';

interface CallerPreset {
  key: string;
  name: string;
  code: string;
  email: string;
  description: string;
}

const CALLER_PRESETS: CallerPreset[] = [
  { 
    key: 'larry', 
    name: 'Larry', 
    code: '@f1n3ssing_l4rry', 
    email: 'larry@auditpro.io',
    description: 'Assigned 25 high-priority deliverability targets'
  },
  { 
    key: 'kelly', 
    name: 'Kelly', 
    code: '@4mg_kyl14n', 
    email: 'kelly@auditpro.io',
    description: 'Assigned 25 high-priority deliverability targets'
  },
  { 
    key: 'ramadhan', 
    name: 'Ramadhan', 
    code: '@r4m4dh4n', 
    email: 'ramadhan@auditpro.io',
    description: 'Assigned 25 high-priority deliverability targets'
  },
  { 
    key: 'melbourne', 
    name: 'Melbourne', 
    code: '@M3lbourn3', 
    email: 'melbourne258@gmail.com',
    description: 'Assigned 25 high-priority deliverability targets'
  },
];

export const CallerAccess: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/outreach';

  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ name: string; callerKey: string } | null>(null);

  // Check existing session
  const [existingSession, setExistingSession] = useState<{ callerKey: string; name: string; email?: string } | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('caller_session');
      if (stored) {
        setExistingSession(JSON.parse(stored));
      }
    } catch {}
  }, []);

  const handleVerify = async (codeToVerify?: string) => {
    const rawCode = (codeToVerify || code).trim();
    if (!rawCode) {
      setError('Please enter your secret caller code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Find matching preset to provide name if available
      const matchingPreset = CALLER_PRESETS.find(p => {
        const a = p.code.toLowerCase();
        const b = rawCode.toLowerCase();
        return a === b || a === `@${b}` || `@${a.replace(/^@/, '')}` === `@${b.replace(/^@/, '')}`;
      });

      const res = await fetch('/api/caller/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: rawCode,
          name: matchingPreset?.name || '',
          email: matchingPreset?.email || '',
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = null;
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => null);
      } else {
        const text = await res.text().catch(() => '');
        throw new Error(res.status === 404 ? 'API route not reached (404). Please ensure backend serverless function is configured.' : `Server error (${res.status}): ${text.slice(0, 100)}`);
      }

      if (!res.ok) {
        throw new Error(data?.error || 'Invalid caller passcode. Please verify your assigned code.');
      }

      // Store caller session in localStorage
      localStorage.setItem('caller_session', JSON.stringify(data.caller));
      if (data.token) {
        localStorage.setItem('caller_token', data.token);
      }

      setSuccessInfo({
        name: data.caller.name,
        callerKey: data.caller.callerKey,
      });

      // Redirect after brief visual feedback
      setTimeout(() => {
        navigate(redirectTarget, { 
          state: { 
            fromCallerLogin: true, 
            callerKey: data.caller.callerKey 
          } 
        });
      }, 700);

    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your code.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutExisting = () => {
    localStorage.removeItem('caller_session');
    localStorage.removeItem('caller_token');
    setExistingSession(null);
    setCode('');
    setSuccessInfo(null);
  };

  const handleQuickSelect = (preset: CallerPreset) => {
    setCode(preset.code);
    handleVerify(preset.code);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Header />

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-10">
        <div className="max-w-xl w-full space-y-6">
          
          {/* Top Banner Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold uppercase tracking-wider">
              <Key className="w-3.5 h-3.5" />
              <span>Caller Access Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              Enter Caller Code to Access
            </h1>
            <p className="text-sm text-gray-600 max-w-md mx-auto">
              Put in your assigned secret code below to unlock your 25 leads, access the real-time Call Spreadsheet, and phone outreach scripts.
            </p>
          </div>

          {/* Active Session Notice if already signed in */}
          {existingSession && !successInfo && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-sm p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-emerald-900">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="text-xs">
                  <span className="font-semibold block">
                    Currently Authenticated as <span className="font-bold underline">{existingSession.name}</span>
                  </span>
                  <span className="text-emerald-700 font-mono text-[11px]">
                    Role: Outreach Caller ({existingSession.callerKey})
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => navigate(redirectTarget)}
                  className="flex-1 sm:flex-initial px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xs cursor-pointer transition-colors shadow-2xs"
                >
                  Continue to Queue →
                </button>
                <button
                  type="button"
                  onClick={handleLogoutExisting}
                  className="p-1.5 text-emerald-800 hover:text-emerald-950 hover:bg-emerald-100 rounded-xs cursor-pointer transition-colors"
                  title="Switch caller / Enter different code"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Main Card with Code Input */}
          <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-6 sm:p-8 space-y-6">
            
            {successInfo ? (
              <div className="text-center py-6 space-y-3">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  Welcome back, {successInfo.name}!
                </h3>
                <p className="text-xs text-gray-500 font-medium flex items-center justify-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  <span>Verified successfully. Redirecting to your queue & spreadsheet...</span>
                </p>
              </div>
            ) : (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleVerify();
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-indigo-600" />
                      Caller Secret Code
                    </span>
                    <span className="text-[11px] text-gray-400 font-normal lowercase">
                      case-insensitive
                    </span>
                  </label>

                  <div className="relative">
                    <input
                      type={showCode ? 'text' : 'password'}
                      autoFocus
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="e.g. @f1n3ssing_l4rry"
                      className="w-full px-4 py-3 text-base font-mono font-bold tracking-wider text-gray-900 bg-gray-50 border border-gray-300 rounded-sm focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-all placeholder:text-gray-400 placeholder:font-normal placeholder:tracking-normal pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCode(!showCode)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1 cursor-pointer"
                      title={showCode ? "Hide code" : "Show code"}
                    >
                      {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
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
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-bold uppercase tracking-wider rounded-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Passcode...</span>
                    </>
                  ) : (
                    <>
                      <span>Enter & Redirect to Outreach Page</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Quick 1-Click Code Presets */}
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Select Team Caller (1-Click Fill & Enter):
                </span>
                <span className="text-[10px] text-gray-400">4 Callers Assigned</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {CALLER_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => handleQuickSelect(preset)}
                    disabled={loading}
                    className="p-2.5 text-left border border-gray-200 hover:border-indigo-500 hover:bg-indigo-50/50 rounded-xs transition-all group cursor-pointer bg-white"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-900 group-hover:text-indigo-700 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-600" />
                        {preset.name}
                      </span>
                      <span className="text-[10px] font-mono text-gray-400 group-hover:text-indigo-600 font-semibold">
                        Enter →
                      </span>
                    </div>
                    <div className="font-mono text-[11px] font-bold text-gray-600 group-hover:text-indigo-900 bg-gray-50 group-hover:bg-white px-1.5 py-0.5 rounded-2xs border border-gray-200/60 truncate">
                      {preset.code}
                    </div>
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Quick Features Guide */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-600">
            <div className="bg-white p-3 border border-gray-200 rounded-sm space-y-1">
              <div className="font-bold text-gray-900 flex items-center gap-1.5">
                <Table className="w-3.5 h-3.5 text-indigo-600" />
                Call Spreadsheet
              </div>
              <p className="text-[11px] text-gray-500">
                1-click Tick (✔), Cross (✖), or Waiting (⏳) with instant phone numbers.
              </p>
            </div>
            <div className="bg-white p-3 border border-gray-200 rounded-sm space-y-1">
              <div className="font-bold text-gray-900 flex items-center gap-1.5">
                <PhoneCall className="w-3.5 h-3.5 text-indigo-600" />
                25 Dedicated Leads
              </div>
              <p className="text-[11px] text-gray-500">
                Equally split across the 4 callers without duplicates.
              </p>
            </div>
            <div className="bg-white p-3 border border-gray-200 rounded-sm space-y-1">
              <div className="font-bold text-gray-900 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                Tailored Scripts
              </div>
              <p className="text-[11px] text-gray-500">
                Turnkey front desk gatekeeper & owner cold call battlecards.
              </p>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};
