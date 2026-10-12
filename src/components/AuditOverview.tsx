import React from 'react';
import { DomainAuditResult } from '../types';
import { CheckCircle2, AlertTriangle, XCircle, Settings2 } from 'lucide-react';

interface AuditOverviewProps {
  result: DomainAuditResult;
  onOpenTools: () => void;
}

export const AuditOverview: React.FC<AuditOverviewProps> = ({ result, onOpenTools }) => {
  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'text-green-700 bg-green-50 border-green-200';
    if (grade.startsWith('B')) return 'text-blue-700 bg-blue-50 border-blue-200';
    if (grade.startsWith('C')) return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    return 'text-red-700 bg-red-50 border-red-200';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'pass') return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    if (status === 'warning') return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    return <XCircle className="w-5 h-5 text-red-600" />;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className={`w-20 h-20 rounded-sm border flex flex-col items-center justify-center font-bold text-3xl shadow-sm ${getGradeColor(result.grade)}`}>
            <span>{result.grade}</span>
            <span className="text-[10px] font-bold opacity-80 uppercase tracking-wider mt-1">{result.score}/100</span>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold tracking-tight text-gray-900 font-mono">{result.domain}</h2>
              <span className="text-[11px] px-2 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-600 font-mono">
                {new Date(result.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1 max-w-xl leading-relaxed">
              {result.score >= 85
                ? 'Authentication mechanisms are securely configured. Deliverability risk is low.'
                : result.score >= 60
                ? 'Moderate misconfigurations detected. Action recommended to prevent spam filtering.'
                : 'Critical authentication failures detected. Immediate remediation required.'}
            </p>
          </div>
        </div>

        <div className="flex w-full md:w-auto justify-end">
          <button
            onClick={onOpenTools}
            className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-900 text-sm font-medium rounded-sm shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <Settings2 className="w-4 h-4 text-gray-500" />
            <span>DNS Record Tools</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-sm p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">SPF Alignment</span>
            {getStatusIcon(result.spf.status)}
          </div>
          <div className="text-lg font-semibold text-gray-900 capitalize">
            {result.spf.status === 'pass' ? `Valid (${result.spf.lookups})` : result.spf.status}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">DKIM Validity</span>
            {getStatusIcon(result.dkim.status)}
          </div>
          <div className="text-lg font-semibold text-gray-900 capitalize">
            {result.dkim.status === 'pass' ? `Active (${result.dkim.selector})` : 'Missing / Invalid'}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">DMARC Policy</span>
            {getStatusIcon(result.dmarc.status)}
          </div>
          <div className="text-lg font-semibold text-gray-900 uppercase">
            p={result.dmarc.policy}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">IP Blacklists</span>
            {result.blacklists.listedCount === 0 ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600" />
            )}
          </div>
          <div className="text-lg font-semibold text-gray-900">
            {result.blacklists.listedCount === 0 ? 'Clean (0/5)' : `${result.blacklists.listedCount} Listed`}
          </div>
        </div>
      </div>
    </div>
  );
};
