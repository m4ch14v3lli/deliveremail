import React from 'react';
import { PhoneCall, LogOut, ShieldCheck, UserCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CallerSession } from '../../types/caller';

interface CallerHeaderProps {
  session: CallerSession;
  totalLeads: number;
  onLogout: () => void;
}

export const CallerHeader: React.FC<CallerHeaderProps> = ({ session, totalLeads, onLogout }) => {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        
        {/* Left: Branding & Caller Identity */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-sm bg-indigo-900 text-white flex items-center justify-center shadow-xs">
            <PhoneCall className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-gray-900 tracking-tight">
                Caller Dial Sheet &amp; Leads
              </h1>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Live Queue
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Authenticated Caller: <strong className="text-gray-900">{session.name}</strong>
              {session.email ? ` (${session.email})` : ''} • {totalLeads} Assigned Leads
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="text-xs font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-1.5 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-gray-400" />
            <span>Auditor</span>
          </Link>

          <div className="h-4 w-px bg-gray-200"></div>

          <button
            type="button"
            onClick={onLogout}
            className="px-3 py-1.5 bg-gray-100 hover:bg-red-50 hover:text-red-700 text-gray-700 text-xs font-bold rounded-xs cursor-pointer transition-colors flex items-center gap-1.5"
            title="Sign out of caller session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

      </div>
    </header>
  );
};
