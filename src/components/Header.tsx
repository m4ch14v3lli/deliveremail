import React from 'react';
import { ShieldCheck, Mail, Server, History, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
          {user ? (
            <>
              <Link to="/bulk" className="flex items-center gap-1.5 hover:text-gray-900 transition-colors">
                <Server className="w-4 h-4" />
                <span className="hidden sm:inline">Bulk Audit (200)</span>
              </Link>
              <Link to="/history" className="flex items-center gap-1.5 hover:text-gray-900 transition-colors">
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">Audit History</span>
              </Link>
              <div className="h-4 w-px bg-gray-300"></div>
              <span className="truncate max-w-[120px] sm:max-w-[200px] text-gray-700 font-medium">{user.email}</span>
              <button onClick={handleLogout} className="flex items-center gap-1.5 hover:text-gray-900 transition-colors cursor-pointer">
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          ) : (
            <>
              <Link to="/bulk" className="flex items-center gap-1.5 hover:text-gray-900 transition-colors">
                <Server className="w-4 h-4" />
                <span className="hidden sm:inline">Bulk Audit</span>
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
    </header>
  );
};
