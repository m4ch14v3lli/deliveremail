import React, { useState } from 'react';
import { X, Database, CheckCircle2, ExternalLink, ShieldCheck, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getSupabaseCredentials, testSupabaseConnection } from '../lib/supabase';

interface SupabaseSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseSettingsModal: React.FC<SupabaseSettingsModalProps> = ({ isOpen, onClose }) => {
  const { isSupabase, saveSupabaseConfig } = useAuth();
  const current = getSupabaseCredentials();
  const [url, setUrl] = useState(current.url);
  const [anonKey, setAnonKey] = useState(current.anonKey);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleTest = async () => {
    if (!url.trim() || !anonKey.trim()) {
      setTestResult({ success: false, message: 'Please provide both the Project URL and Anon Key.' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection(url.trim(), anonKey.trim());
      if (res.success) {
        setTestResult({ success: true, message: 'Connection successful! Valid Supabase Project & Key.' });
      } else {
        setTestResult({ success: false, message: res.error || 'Connection check failed. Please verify the URL and Key.' });
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || 'Connection test failed.' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseConfig(url.trim(), anonKey.trim());
    setSaved(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleDisconnect = () => {
    setUrl('');
    setAnonKey('');
    saveSupabaseConfig('', '');
    setSaved(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-sm border border-gray-200 shadow-xl max-w-lg w-full p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Supabase Authentication Setup</h3>
              <p className="text-[11px] text-gray-500">Universal Auth & User Session Provider</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-sm cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status banner */}
        <div className={`p-3 rounded-sm border text-xs flex items-start gap-2.5 ${
          isSupabase 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}>
          <ShieldCheck className={`w-4 h-4 shrink-0 mt-0.5 ${isSupabase ? 'text-emerald-600' : 'text-amber-600'}`} />
          <div className="leading-relaxed">
            <strong>Status: {isSupabase ? 'Supabase Active & Configured' : 'Supabase Not Connected'}</strong>
            <p className="text-[11px] mt-0.5 opacity-90">
              {isSupabase 
                ? 'All login, registration, and user token verifications are handled through your Supabase project.' 
                : 'Paste your project URL and anon public key below or set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                Supabase Project URL
              </label>
              <span className="text-[10px] text-gray-400">Settings &gt; API &gt; Project URL</span>
            </div>
            <input
              type="url"
              required
              placeholder="https://xyzcompany.supabase.co"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setTestResult(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-sm text-xs font-mono focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                Anon Public API Key
              </label>
              <span className="text-[10px] text-gray-400">Settings &gt; API &gt; Project API keys (anon public)</span>
            </div>
            <textarea
              required
              rows={3}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6..."
              value={anonKey}
              onChange={(e) => {
                setAnonKey(e.target.value);
                setTestResult(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-sm text-xs font-mono focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 resize-none"
            />
          </div>

          {/* Test connection feedback */}
          {testResult && (
            <div className={`p-2.5 rounded-sm border text-xs flex items-start gap-2 ${
              testResult.success 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between gap-2 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !url || !anonKey}
                className="px-2.5 py-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {testing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Test Connection
              </button>
              {isSupabase && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-2.5 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-sm transition-colors cursor-pointer flex items-center gap-1"
                  title="Disconnect Supabase credentials"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Disconnect
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 rounded-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-sm transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {saved && <CheckCircle2 className="w-3.5 h-3.5" />}
                {saved ? 'Saved!' : 'Save & Activate Supabase'}
              </button>
            </div>
          </div>
        </form>

        <div className="text-[11px] text-gray-500 pt-2 border-t border-gray-100 flex items-center justify-between">
          <span>You can also set <code>VITE_SUPABASE_URL</code> &amp; <code>VITE_SUPABASE_ANON_KEY</code> in Vercel.</span>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="text-emerald-700 hover:underline inline-flex items-center gap-1 font-semibold"
          >
            Supabase Console <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
