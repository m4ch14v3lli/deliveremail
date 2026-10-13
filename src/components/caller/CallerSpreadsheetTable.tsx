import React, { useState } from 'react';
import { CallerLead, CallOutcomeStatus } from '../../types/caller';
import { 
  Phone, 
  Copy, 
  Check, 
  ExternalLink, 
  Search, 
  Download, 
  Filter, 
  Loader2, 
  CheckCircle2, 
  Clock, 
  Trophy, 
  XCircle, 
  AlertCircle 
} from 'lucide-react';

interface CallerSpreadsheetTableProps {
  leads: CallerLead[];
  onUpdateStatus: (id: number, status: CallOutcomeStatus, notes?: string) => Promise<void>;
  callerName: string;
}

export const CallerSpreadsheetTable: React.FC<CallerSpreadsheetTableProps> = ({
  leads,
  onUpdateStatus,
  callerName,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [localNotes, setLocalNotes] = useState<Record<number, string>>({});
  const [savedNotesId, setSavedNotesId] = useState<number | null>(null);

  // Initialize or update local notes cache
  const getNoteValue = (lead: CallerLead) => {
    if (localNotes[lead.id] !== undefined) {
      return localNotes[lead.id];
    }
    return lead.notes || '';
  };

  const handleCopyPhone = (id: number, phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(phone);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStatusChange = async (id: number, newStatus: CallOutcomeStatus) => {
    setUpdatingId(id);
    try {
      const notes = localNotes[id];
      await onUpdateStatus(id, newStatus, notes);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleNotesBlur = async (lead: CallerLead) => {
    const currentText = localNotes[lead.id];
    if (currentText !== undefined && currentText !== (lead.notes || '')) {
      setUpdatingId(lead.id);
      try {
        await onUpdateStatus(lead.id, lead.status as CallOutcomeStatus, currentText);
        setSavedNotesId(lead.id);
        setTimeout(() => setSavedNotesId(null), 2500);
      } finally {
        setUpdatingId(null);
      }
    }
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Domain', 'Company', 'Phone', 'Grade', 'Score', 'Status', 'Notes', 'Updated At'];
    const rows = leads.map(l => [
      l.id,
      `"${l.domain}"`,
      `"${(l.companyName || '').replace(/"/g, '""')}"`,
      `"${l.phone || ''}"`,
      `"${l.grade || ''}"`,
      l.score || '',
      `"${l.status || 'pending'}"`,
      `"${(localNotes[l.id] ?? l.notes ?? '').replace(/"/g, '""')}"`,
      `"${l.updatedAt || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${callerName.toLowerCase().replace(/\s+/g, '_')}_leads_sheet.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const filteredLeads = React.useMemo(() => {
    return leads.filter(l => {
      // Status filter
      if (statusFilter !== 'all') {
        const s = (l.status || 'pending').toLowerCase();
        if (statusFilter === 'pending' && s !== 'pending') return false;
        if (statusFilter === 'interested' && s !== 'interested') return false;
        if (statusFilter === 'meeting_booked' && s !== 'meeting_booked') return false;
        if (statusFilter === 'waiting' && s !== 'waiting' && s !== 'callback') return false;
        if (statusFilter === 'not_interested' && s !== 'not_interested' && s !== 'disqualified') return false;
      }

      // Search filter
      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const d = (l.domain || '').toLowerCase();
        const c = (l.companyName || '').toLowerCase();
        const p = (l.phone || '').toLowerCase();
        const n = (localNotes[l.id] ?? l.notes ?? '').toLowerCase();
        return d.includes(query) || c.includes(query) || p.includes(query) || n.includes(query);
      }

      return true;
    });
  }, [leads, statusFilter, search, localNotes]);

  return (
    <div className="bg-white border border-gray-200 rounded-sm shadow-xs overflow-hidden">
      
      {/* Controls Bar: Search, Filters & CSV Export */}
      <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row items-center justify-between gap-3 bg-gray-50/70">
        <div className="flex items-center gap-2 w-full md:w-auto flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search domain, company, phone, notes..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-300 rounded-xs focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 font-medium"
            />
          </div>
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="text-xs text-gray-500 hover:text-gray-800 font-semibold cursor-pointer shrink-0"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500 font-medium">Filter:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2 py-1 bg-white border border-gray-300 rounded-xs text-xs font-semibold text-gray-800 focus:outline-none focus:border-indigo-600 cursor-pointer"
            >
              <option value="all">All Outcomes ({leads.length})</option>
              <option value="pending">To Call (Pending)</option>
              <option value="interested">Interested</option>
              <option value="meeting_booked">Meeting Booked</option>
              <option value="waiting">Call Back / Waiting</option>
              <option value="not_interested">Not Interested</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 text-xs font-bold rounded-xs cursor-pointer flex items-center gap-1.5 transition-colors shadow-2xs"
            title="Download CSV of your assigned dial sheet"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Spreadsheet Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100/90 border-b border-gray-200 text-gray-700 uppercase font-mono text-[11px] tracking-wider select-none">
              <th className="py-2.5 px-3 w-10 text-center font-bold">#</th>
              <th className="py-2.5 px-3.5 font-bold">Target Domain</th>
              <th className="py-2.5 px-3.5 font-bold">Company</th>
              <th className="py-2.5 px-3.5 font-bold">Direct Phone</th>
              <th className="py-2.5 px-3 font-bold text-center">Score</th>
              <th className="py-2.5 px-3.5 font-bold min-w-[170px]">Call Outcome</th>
              <th className="py-2.5 px-3.5 font-bold min-w-[260px]">Call Notes &amp; Gatekeeper Info</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-400">
                  <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-700">No leads match your filter</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {search ? 'Try clearing your search query' : 'Your queue is empty or filtered'}
                  </p>
                </td>
              </tr>
            ) : (
              filteredLeads.map((lead, idx) => {
                const s = (lead.status || 'pending').toLowerCase();
                const isUpdating = updatingId === lead.id;
                const isSaved = savedNotesId === lead.id;

                // Color accent based on outcome
                const rowBg = s === 'meeting_booked' 
                  ? 'bg-indigo-50/40' 
                  : s === 'interested' 
                  ? 'bg-emerald-50/40' 
                  : s === 'waiting' 
                  ? 'bg-blue-50/30' 
                  : s === 'not_interested' 
                  ? 'bg-rose-50/20' 
                  : 'hover:bg-gray-50/60';

                return (
                  <tr key={lead.id} className={`transition-colors ${rowBg}`}>
                    {/* # index */}
                    <td className="py-2.5 px-3 text-center text-gray-400 font-mono text-[11px]">
                      {idx + 1}
                    </td>

                    {/* Domain */}
                    <td className="py-2.5 px-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-900 font-mono text-xs">{lead.domain}</span>
                        <a
                          href={`https://${lead.domain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-gray-400 hover:text-indigo-600 transition-colors p-0.5"
                          title="Open website in new tab"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </td>

                    {/* Company */}
                    <td className="py-2.5 px-3.5 text-gray-700 font-semibold truncate max-w-[180px]">
                      {lead.companyName || lead.domain.split('.')[0].toUpperCase()}
                    </td>

                    {/* Phone & 1-Click Dial */}
                    <td className="py-2.5 px-3.5">
                      {lead.phone ? (
                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${lead.phone.replace(/[^0-9+]/g, '')}`}
                            className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xs font-mono font-bold text-xs transition-colors shadow-2xs group"
                            title="Click to dial via phone app"
                          >
                            <Phone className="w-3 h-3 text-emerald-600 group-hover:scale-110 transition-transform" />
                            <span>{lead.phone}</span>
                          </a>
                          <button
                            type="button"
                            onClick={(e) => handleCopyPhone(lead.id, lead.phone!, e)}
                            className="p-1 text-gray-400 hover:text-gray-700 rounded-xs cursor-pointer"
                            title="Copy phone number"
                          >
                            {copiedId === lead.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-[11px]">No direct phone</span>
                      )}
                    </td>

                    {/* Score / Grade */}
                    <td className="py-2.5 px-3 text-center">
                      <div className="inline-flex items-center gap-1">
                        <span className={`px-1.5 py-0.5 rounded-2xs font-bold text-[10px] ${
                          lead.grade?.startsWith('A') ? 'bg-emerald-100 text-emerald-800' :
                          lead.grade?.startsWith('B') ? 'bg-blue-100 text-blue-800' :
                          lead.grade?.startsWith('C') ? 'bg-amber-100 text-amber-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {lead.grade || 'Grade D'}
                        </span>
                        <span className="text-gray-400 font-mono text-[11px]">
                          {lead.score ?? 40}/100
                        </span>
                      </div>
                    </td>

                    {/* Call Outcome Status Select */}
                    <td className="py-2.5 px-3.5">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={lead.status || 'pending'}
                          disabled={isUpdating}
                          onChange={(e) => handleStatusChange(lead.id, e.target.value as CallOutcomeStatus)}
                          className={`w-full px-2 py-1 rounded-xs border text-xs font-bold cursor-pointer focus:outline-none transition-all shadow-2xs ${
                            s === 'meeting_booked' ? 'bg-indigo-600 text-white border-indigo-700' :
                            s === 'interested' ? 'bg-emerald-600 text-white border-emerald-700' :
                            s === 'waiting' ? 'bg-blue-600 text-white border-blue-700' :
                            s === 'not_interested' ? 'bg-rose-600 text-white border-rose-700' :
                            'bg-white text-gray-800 border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <option value="pending" className="bg-white text-gray-900">⚪ To Call (Pending)</option>
                          <option value="interested" className="bg-white text-gray-900">🟢 Interested (Hot)</option>
                          <option value="meeting_booked" className="bg-white text-gray-900">🏆 Meeting Booked</option>
                          <option value="waiting" className="bg-white text-gray-900">🟡 Call Back / Waiting</option>
                          <option value="not_interested" className="bg-white text-gray-900">🔴 Not Interested</option>
                        </select>
                        {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500 shrink-0" />}
                      </div>
                    </td>

                    {/* Call Notes & Gatekeeper Input */}
                    <td className="py-2.5 px-3.5">
                      <div className="relative">
                        <input
                          type="text"
                          value={getNoteValue(lead)}
                          onChange={(e) => setLocalNotes({ ...localNotes, [lead.id]: e.target.value })}
                          onBlur={() => handleNotesBlur(lead)}
                          placeholder="Type notes: gatekeeper name, callback time..."
                          className="w-full px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-xs focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 pr-6"
                        />
                        {isSaved && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Summary */}
      <div className="p-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex items-center justify-between">
        <span>
          Showing <strong>{filteredLeads.length}</strong> of <strong>{leads.length}</strong> assigned leads
        </span>
        <span className="text-[11px] text-gray-400 font-mono">
          Changes auto-save upon selecting outcome or typing notes
        </span>
      </div>

    </div>
  );
};
