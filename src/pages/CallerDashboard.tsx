import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CallerLead, CallerSession, CallOutcomeStatus } from '../types/caller';
import { CallerHeader } from '../components/caller/CallerHeader';
import { CallerStatsBar } from '../components/caller/CallerStatsBar';
import { CallerSpreadsheetTable } from '../components/caller/CallerSpreadsheetTable';
import { Loader2, AlertCircle, RefreshCw, PhoneCall } from 'lucide-react';

export const CallerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<CallerSession | null>(null);
  const [leads, setLeads] = useState<CallerLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  // 1. Verify caller session on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('caller_session');
      if (!stored) {
        navigate('/caller-access');
        return;
      }
      const parsed: CallerSession = JSON.parse(stored);
      if (!parsed || !parsed.callerKey) {
        navigate('/caller-access');
        return;
      }
      setSession(parsed);
      loadLeads(parsed.callerKey);
    } catch {
      navigate('/caller-access');
    }
  }, [navigate]);

  // 2. Fetch assigned leads for this caller
  const loadLeads = async (callerKey: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/my-queue?callerKey=${encodeURIComponent(callerKey)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Failed to retrieve leads (${res.status})`);
      }
      const data = await res.json();
      setLeads(data.leads || []);
    } catch (err: any) {
      console.error('Failed to load caller leads:', err);
      setError(err.message || 'Unable to connect to lead service.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    if (session) {
      setRefreshing(true);
      loadLeads(session.callerKey);
    }
  };

  // 3. Update lead call outcome and notes
  const handleUpdateStatus = async (id: number, status: CallOutcomeStatus, notes?: string) => {
    // Optimistic local update
    setLeads(prev => prev.map(l => {
      if (l.id === id) {
        return {
          ...l,
          status,
          ...(notes !== undefined ? { notes } : {}),
          updatedAt: new Date().toISOString(),
        };
      }
      return l;
    }));

    try {
      const res = await fetch('/api/leads/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status,
          notes,
        }),
      });

      if (!res.ok) {
        // Fallback to PATCH if needed
        await fetch(`/api/leads/${id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, notes }),
        });
      }
    } catch (err) {
      console.warn('Status update network notice:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('caller_session');
    localStorage.removeItem('caller_token');
    navigate('/login');
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100/60 flex flex-col font-sans">
      {/* 1. Header showing authenticated caller and sign out */}
      <CallerHeader
        session={session}
        totalLeads={leads.length}
        onLogout={handleLogout}
      />

      {/* 2. Main Content: ONLY assigned leads and the spreadsheet */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Top Controls: Refresh & Queue Indicator */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 border border-gray-200 rounded-sm shadow-xs">
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>Your Dial Sheet</span>
              <span className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold px-2 py-0.5 rounded-xs">
                {leads.length} Target Domains
              </span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Click any phone number to dial directly. Choose the call outcome and type notes into the spreadsheet.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing || loading}
              className="px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-xs font-semibold rounded-xs cursor-pointer flex items-center gap-1.5 shadow-2xs transition-colors"
              title="Refresh queue from server"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-sm text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
            <button 
              onClick={handleManualRefresh}
              className="ml-auto underline font-semibold text-red-800 cursor-pointer"
            >
              Try Again
            </button>
          </div>
        )}

        {/* 3. Fast Queue Stats Bar */}
        <CallerStatsBar
          leads={leads}
          activeFilter={activeFilter}
          onFilterChange={(st) => setActiveFilter(st)}
        />

        {/* 4. Loading State or Spreadsheet Table */}
        {loading && leads.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-sm p-16 text-center shadow-xs">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-gray-900">Loading your assigned leads...</h3>
            <p className="text-xs text-gray-500 mt-1">Fetching your live dial sheet.</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-sm p-12 text-center shadow-xs space-y-3">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto border border-amber-200">
              <PhoneCall className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900">No leads currently assigned</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Your caller account (<strong className="text-gray-900">{session.name}</strong>) is active, but no leads have been allocated to your queue yet. Once your team manager runs an audit and partitions the targets, they will appear right here in your spreadsheet.
            </p>
            <button
              type="button"
              onClick={handleManualRefresh}
              className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-xs cursor-pointer shadow-xs inline-flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Check for New Leads</span>
            </button>
          </div>
        ) : (
          /* 5. The Spreadsheet: high-density table for dialing */
          <CallerSpreadsheetTable
            leads={leads}
            onUpdateStatus={handleUpdateStatus}
            callerName={session.name}
          />
        )}

      </main>
    </div>
  );
};
