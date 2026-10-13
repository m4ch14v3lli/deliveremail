import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';

export const Register: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { registerWithEmail, loginWithSupabaseOAuth, isSupabase } = useAuth();
  const navigate = useNavigate();

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
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-1">Create an Account</h2>
        <p className="text-xs text-gray-500 text-center mb-6">
          Save audit history and perform automated multi-domain scans
        </p>

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
            Create Account
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

        <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col items-center gap-2.5">
          <p className="text-center text-xs text-gray-600">
            Already have an account? <Link to="/login" className="text-gray-900 font-bold hover:underline">Sign In</Link>
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
