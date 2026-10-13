import React from 'react';
import { CallerLead, CallerStats } from '../../types/caller';
import { PhoneCall, CheckCircle2, Trophy, Clock, XCircle, ListFilter } from 'lucide-react';

interface CallerStatsBarProps {
  leads: CallerLead[];
  activeFilter: string;
  onFilterChange: (status: string) => void;
}

export const CallerStatsBar: React.FC<CallerStatsBarProps> = ({ leads, activeFilter, onFilterChange }) => {
  const stats: CallerStats = React.useMemo(() => {
    let pending = 0;
    let interested = 0;
    let waiting = 0;
    let meetingBooked = 0;
    let notInterested = 0;

    leads.forEach(l => {
      const s = (l.status || 'pending').toLowerCase();
      if (s === 'interested') interested++;
      else if (s === 'waiting' || s === 'callback') waiting++;
      else if (s === 'meeting_booked') meetingBooked++;
      else if (s === 'not_interested' || s === 'disqualified') notInterested++;
      else pending++;
    });

    const called = leads.length - pending;
    return {
      total: leads.length,
      pending,
      called,
      interested,
      waiting,
      meetingBooked,
      notInterested,
    };
  }, [leads]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* 1. Total Leads */}
      <button
        type="button"
        onClick={() => onFilterChange('all')}
        className={`p-3 rounded-sm border text-left cursor-pointer transition-all ${
          activeFilter === 'all'
            ? 'bg-gray-900 border-gray-900 text-white shadow-xs'
            : 'bg-white border-gray-200 text-gray-800 hover:border-gray-400'
        }`}
      >
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-semibold uppercase tracking-wider opacity-80">All Leads</span>
          <ListFilter className="w-3.5 h-3.5" />
        </div>
        <div className="text-xl font-black">{stats.total}</div>
        <div className="text-[10px] opacity-70">Assigned Queue</div>
      </button>

      {/* 2. Pending to Call */}
      <button
        type="button"
        onClick={() => onFilterChange('pending')}
        className={`p-3 rounded-sm border text-left cursor-pointer transition-all ${
          activeFilter === 'pending'
            ? 'bg-amber-600 border-amber-600 text-white shadow-xs'
            : 'bg-white border-gray-200 text-gray-800 hover:border-gray-400'
        }`}
      >
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-semibold uppercase tracking-wider opacity-80">To Call</span>
          <PhoneCall className="w-3.5 h-3.5" />
        </div>
        <div className="text-xl font-black">{stats.pending}</div>
        <div className="text-[10px] opacity-70">Uncalled Targets</div>
      </button>

      {/* 3. Interested */}
      <button
        type="button"
        onClick={() => onFilterChange('interested')}
        className={`p-3 rounded-sm border text-left cursor-pointer transition-all ${
          activeFilter === 'interested'
            ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
            : 'bg-white border-gray-200 text-gray-800 hover:border-gray-400'
        }`}
      >
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-semibold uppercase tracking-wider opacity-80">Interested</span>
          <CheckCircle2 className="w-3.5 h-3.5" />
        </div>
        <div className="text-xl font-black">{stats.interested}</div>
        <div className="text-[10px] opacity-70">Positive Responses</div>
      </button>

      {/* 4. Meetings Booked */}
      <button
        type="button"
        onClick={() => onFilterChange('meeting_booked')}
        className={`p-3 rounded-sm border text-left cursor-pointer transition-all ${
          activeFilter === 'meeting_booked'
            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
            : 'bg-white border-gray-200 text-gray-800 hover:border-gray-400'
        }`}
      >
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-semibold uppercase tracking-wider opacity-80">Booked</span>
          <Trophy className="w-3.5 h-3.5" />
        </div>
        <div className="text-xl font-black">{stats.meetingBooked}</div>
        <div className="text-[10px] opacity-70">Scheduled Audits</div>
      </button>

      {/* 5. Waiting / Call Back */}
      <button
        type="button"
        onClick={() => onFilterChange('waiting')}
        className={`p-3 rounded-sm border text-left cursor-pointer transition-all ${
          activeFilter === 'waiting'
            ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
            : 'bg-white border-gray-200 text-gray-800 hover:border-gray-400'
        }`}
      >
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-semibold uppercase tracking-wider opacity-80">Call Back</span>
          <Clock className="w-3.5 h-3.5" />
        </div>
        <div className="text-xl font-black">{stats.waiting}</div>
        <div className="text-[10px] opacity-70">Follow-Up Required</div>
      </button>

      {/* 6. Not Interested */}
      <button
        type="button"
        onClick={() => onFilterChange('not_interested')}
        className={`p-3 rounded-sm border text-left cursor-pointer transition-all ${
          activeFilter === 'not_interested'
            ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
            : 'bg-white border-gray-200 text-gray-800 hover:border-gray-400'
        }`}
      >
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-semibold uppercase tracking-wider opacity-80">Not Int.</span>
          <XCircle className="w-3.5 h-3.5" />
        </div>
        <div className="text-xl font-black">{stats.notInterested}</div>
        <div className="text-[10px] opacity-70">Declined / Disqualified</div>
      </button>
    </div>
  );
};
