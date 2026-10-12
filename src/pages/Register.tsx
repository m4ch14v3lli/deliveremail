import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, Loader2, ArrowLeft, Database, AlertCircle, CheckCircle2 } from 'lucide-react';
import { SupabaseSettingsModal } from '../components/SupabaseSettingsModal';
import { getSupabaseCredentials, testSupabaseConnection } from '../lib/supabase';

export const Register: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const { registerWithEmail, loginWithSupabaseOAuth, isSupabase, saveSupabaseConfig } = useAuth();
  const navigate = useNavigate();

  // Inline Supabase setup states
  const creds = getSupabaseCredentials();
  const [inlineUrl, setInlineUrl] = useState(creds.url);
  const [inlineKey, setInlineKey] = useState(creds.anonKey);
  const [showInlineSetup, setShowInlineSetup] = useState(!isSupabase);
  const [savingSupabase, setSavingSupabase] = useState(false);
  const [supabaseSuccess, setSupabaseSuccess] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);
    try {
      await registerWithEmail(email, password);
      navigate('/');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to register account. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInlineSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSupabaseSuccess(null);
    if (!inlineUrl.trim() || !inlineKey.trim()) {
      setErrorMessage('Please provide both your Supabase Project URL and Anon Public Key.');
      return;
    }
    setSavingSupabase(true);
    try {
      const test = await testSupabaseConnection(inlineUrl.trim(), inlineKey.trim());
      if (!test.success) {
        setErrorMessage(test.error || 'Connection check failed. Verify URL & Anon Key.');
        setSavingSupabase(false);
        return;
      }
      saveSupabaseConfig(inlineUrl.trim(), inlineKey.trim());
      setSupabaseSuccess('Supabase connected! You can now create your account.');
      setShowInlineSetup(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to configure Supabase.');
    } finally {
      setSavingSupabase(false);
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
      <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-8 w-full max-w-md">
        <div className="flex justify-center mb-6">
          <ShieldCheck className="w-10 h-10 text-gray-900" />
        </div>
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-1">Create an Account</h2>
        <p className="text-xs text-gray-500 text-center mb-6">
          Save audit history and perform automated multi-domain scans
        </p>

        {/* Supabase Status Pill & Config Banner */}
        <div className="mb-5 p-3 rounded-sm border text-xs bg-gray-50 border-gray-200 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isSupabase ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
              <span className="text-gray-800 font-bold">
                Auth: {isSupabase ? 'Supabase Active' : 'Supabase Not Configured'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowInlineSetup(!showInlineSetup)}
              className="text-[11px] text-indigo-700 hover:text-indigo-900 font-semibold underline flex items-center gap-1 cursor-pointer"
            >
              <Database className="w-3 h-3" />
              {showInlineSetup ? 'Hide Setup' : isSupabase ? 'Change Keys' : 'Upload Anon Key'}
            </button>
          </div>

          {/* Inline Supabase Keys Uploader */}
          {showInlineSetup && (
            <form onSubmit={handleSaveInlineSupabase} className="pt-2 border-t border-gray-200 space-y-2.5">
              <div className="text-[11px] text-gray-600 leading-tight">
                Enter your Supabase URL &amp; Anon Key below. Works instantly locally and on Vercel:
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-600 mb-0.5">Project URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://xyz.supabase.co"
                  value={inlineUrl}
                  onChange={(e) => setInlineUrl(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs font-mono border border-gray-300 rounded-2xs bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-600 mb-0.5">Anon Public Key</label>
                <textarea
                  required
                  rows={2}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={inlineKey}
                  onChange={(e) => setInlineKey(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs font-mono border border-gray-300 rounded-2xs bg-white focus:outline-none focus:border-indigo-600 resize-none"
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-gray-400">
                  Or set <code>VITE_SUPABASE_URL</code> in Vercel.
                </span>
                <button
                  type="submit"
                  disabled={savingSupabase}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-2xs cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  {savingSupabase && <Loader2 className="w-3 h-3 animate-spin" />}
                  Save &amp; Connect
                </button>
              </div>
            </form>
          )}
        </div>

        {supabaseSuccess && (
          <div className="p-2.5 mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-sm flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{supabaseSuccess}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 mb-5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">Password</label>
              <span className="text-[10px] text-gray-400">Min 6 characters</span>
            </div>
            <input
              type="password"
              required
              minLength={6}
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
            Register with Email
          </button>
        </form>

        {isSupabase && (
          <>
            <div className="mt-6 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
              <span className="px-3 text-xs uppercase tracking-wider text-gray-500 font-bold bg-white">OR</span>
              <div className="w-full border-t border-gray-200"></div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
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

        <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col items-center gap-3">
          <p className="text-center text-sm text-gray-600">
            Already have an account? <Link to="/login" className="text-gray-900 font-semibold hover:underline">Sign In</Link>
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

      <SupabaseSettingsModal
        isOpen={showConfig}
        onClose={() => setShowConfig(false)}
      />
    </div>
  );
};
