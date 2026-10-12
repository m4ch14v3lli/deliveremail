import React from 'react';
import { DomainAuditResult } from '../types';
import { 
  FileText, 
  ShieldCheck, 
  Server, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Printer, 
  Calendar, 
  Globe,
  Sparkles
} from 'lucide-react';

interface AiInsightsTabProps {
  result: DomainAuditResult;
}

export const AiInsightsTab: React.FC<AiInsightsTabProps> = ({ result }) => {
  const formattedDate = new Date(result.timestamp).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  const getGradeBadge = (grade: string) => {
    if (grade.startsWith('A')) return 'bg-green-50 text-green-800 border-green-200';
    if (grade.startsWith('B')) return 'bg-blue-50 text-blue-800 border-blue-200';
    if (grade.startsWith('C')) return 'bg-yellow-50 text-yellow-800 border-yellow-200';
    return 'bg-red-50 text-red-800 border-red-200';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'pass') return <CheckCircle2 className="w-4 h-4 text-green-600 inline shrink-0" />;
    if (status === 'warning') return <AlertTriangle className="w-4 h-4 text-yellow-600 inline shrink-0" />;
    return <XCircle className="w-4 h-4 text-red-600 inline shrink-0" />;
  };

  // Helper to format markdown text with bolding and headers
  const renderFormattedNarrative = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return <div key={idx} className="h-3" />;
      }
      if (trimmed.startsWith('### ')) {
        return (
          <h4 key={idx} className="text-base font-bold text-gray-900 mt-6 mb-2 border-b border-gray-100 pb-1.5 flex items-center gap-2">
            {trimmed.replace('### ', '')}
          </h4>
        );
      }
      if (trimmed.startsWith('## ')) {
        return (
          <h3 key={idx} className="text-lg font-bold text-gray-900 mt-7 mb-3 border-b border-gray-200 pb-2">
            {trimmed.replace('## ', '')}
          </h3>
        );
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const itemText = trimmed.substring(2);
        return (
          <li key={idx} className="ml-5 list-disc text-sm text-gray-700 leading-relaxed my-1">
            <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(itemText) }} />
          </li>
        );
      }
      if (/^\d+\.\s/.test(trimmed)) {
        const itemText = trimmed.replace(/^\d+\.\s/, '');
        return (
          <li key={idx} className="ml-5 list-decimal text-sm text-gray-700 leading-relaxed my-1">
            <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(itemText) }} />
          </li>
        );
      }
      return (
        <p key={idx} className="text-sm text-gray-700 leading-relaxed my-2" dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed) }} />
      );
    });
  };

  const formatInlineMarkdown = (str: string) => {
    return str
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono text-gray-800">$1</code>');
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 print:px-0">
      {/* Official Audit Document Header */}
      <div className="bg-white border border-gray-200 rounded-sm p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
              <FileText className="w-4 h-4 text-gray-700" />
              <span>Executive Verification Document</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 font-mono">
              {result.domain}
            </h2>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-600 flex-wrap">
              <span className="flex items-center gap-1.5 font-medium">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                Audit Timestamp: {formattedDate}
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Globe className="w-3.5 h-3.5 text-gray-400" />
                RFC 7489 / RFC 7208 Compliant
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={`px-4 py-2.5 rounded-sm border flex items-center gap-3 ${getGradeBadge(result.grade)}`}>
              <div>
                <span className="text-2xl font-black">{result.grade}</span>
              </div>
              <div className="border-l border-current/20 pl-3">
                <div className="text-xs font-bold uppercase tracking-wider">Health Score</div>
                <div className="text-sm font-extrabold font-mono">{result.score}/100</div>
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="print:hidden p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-sm transition-colors cursor-pointer"
              title="Print / Save as PDF"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Section 1: Ground Truth DNS Records & Network Evidence (100% Deterministic) */}
        <div className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Server className="w-4 h-4 text-gray-700" />
                1. Verified DNS Ground Truth & Network Evidence
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Exact DNS records and network telemetry resolved live from authoritative nameservers (zero AI inference).
              </p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-sm">
              Live Verified
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* MX Records Evidence */}
            <div className="border border-gray-200 rounded-sm p-4 bg-gray-50/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                  Mail Exchangers (MX)
                </span>
                <span className="flex items-center gap-1 text-xs font-medium">
                  {getStatusIcon(result.mx.status)}
                  <span className="capitalize">{result.mx.status}</span>
                </span>
              </div>
              <div className="space-y-1.5 mb-2 font-mono text-xs">
                {result.mx.records.length > 0 ? (
                  result.mx.records.map((r, i) => (
                    <div key={i} className="flex justify-between bg-white px-2.5 py-1.5 border border-gray-200 rounded-sm text-gray-800">
                      <span className="truncate pr-2">{r.exchange}</span>
                      <span className="text-gray-500 font-bold shrink-0">Priority {r.priority}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-red-700 bg-red-50 p-2 rounded-sm border border-red-200">
                    No MX records discovered in DNS.
                  </div>
                )}
              </div>
              {result.mx.primaryIp && (
                <div className="text-[11px] text-gray-500 font-mono">
                  Primary Sending IP: <strong className="text-gray-900">{result.mx.primaryIp}</strong>
                </div>
              )}
            </div>

            {/* Reverse DNS (PTR) Evidence */}
            <div className="border border-gray-200 rounded-sm p-4 bg-gray-50/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                  Reverse DNS (rDNS / PTR)
                </span>
                <span className="flex items-center gap-1 text-xs font-medium">
                  {getStatusIcon(result.rdns.status)}
                  <span className="capitalize">{result.rdns.status}</span>
                </span>
              </div>
              <div className="bg-white p-2.5 border border-gray-200 rounded-sm space-y-1 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-500">Queried IP:</span>
                  <span className="text-gray-900 font-semibold">{result.rdns.ip || 'No IP resolved'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">PTR Hostname:</span>
                  <span className="text-gray-900 font-semibold truncate max-w-[200px]" title={result.rdns.ptr || ''}>
                    {result.rdns.ptr || 'No PTR record published'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">FCrDNS Forward Match:</span>
                  <span className={result.rdns.fcrdns ? 'text-green-700 font-bold' : 'text-red-600'}>
                    {result.rdns.fcrdns ? 'Confirmed Match' : 'Unconfirmed / Mismatch'}
                  </span>
                </div>
              </div>
            </div>

            {/* SPF Evidence */}
            <div className="border border-gray-200 rounded-sm p-4 bg-gray-50/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                  SPF Alignment (v=spf1)
                </span>
                <span className="flex items-center gap-1 text-xs font-medium">
                  {getStatusIcon(result.spf.status)}
                  <span>Lookups: {result.spf.lookups}/10</span>
                </span>
              </div>
              <div className="bg-white p-2.5 border border-gray-200 rounded-sm text-xs font-mono text-gray-800 break-all leading-relaxed">
                {result.spf.record || 'No SPF TXT record published'}
              </div>
            </div>

            {/* DKIM Evidence */}
            <div className="border border-gray-200 rounded-sm p-4 bg-gray-50/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                  DKIM Signature ({result.dkim.detectedSelector || result.dkim.selector}._domainkey)
                </span>
                <span className="flex items-center gap-1 text-xs font-medium">
                  {getStatusIcon(result.dkim.status)}
                  <span className="capitalize">{result.dkim.status}</span>
                </span>
              </div>
              <div className="bg-white p-2.5 border border-gray-200 rounded-sm text-xs font-mono text-gray-800 break-all max-h-20 overflow-y-auto leading-relaxed">
                {result.dkim.record || result.dkim.error || 'Record not published'}
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-gray-500 font-mono">
                <span>Selector: <strong>{result.dkim.detectedSelector || result.dkim.selector}</strong></span>
                <span>Strength: <strong>{result.dkim.keySize || 'N/A'}</strong></span>
              </div>
            </div>

            {/* DMARC Evidence */}
            <div className="border border-gray-200 rounded-sm p-4 bg-gray-50/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                  DMARC Policy (_dmarc)
                </span>
                <span className="flex items-center gap-1 text-xs font-medium">
                  {getStatusIcon(result.dmarc.status)}
                  <span className="uppercase font-mono font-bold">p={result.dmarc.policy}</span>
                </span>
              </div>
              <div className="bg-white p-2.5 border border-gray-200 rounded-sm text-xs font-mono text-gray-800 break-all leading-relaxed">
                {result.dmarc.record || 'No DMARC record published'}
              </div>
              {result.dmarc.rua && (
                <div className="mt-1.5 text-[11px] text-gray-500 font-mono truncate">
                  Reports (rua): <span className="text-gray-900">{result.dmarc.rua}</span>
                </div>
              )}
            </div>

            {/* DNSBL Blacklists Evidence */}
            <div className="border border-gray-200 rounded-sm p-4 bg-gray-50/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                  Global DNSBL Blocklists
                </span>
                <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-sm ${
                  result.blacklists.listedCount === 0 ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {result.blacklists.listedCount === 0 ? '0 Listed (Clean)' : `${result.blacklists.listedCount} Listed`}
                </span>
              </div>
              <div className="bg-white p-2.5 border border-gray-200 rounded-sm space-y-1.5 text-xs">
                {result.blacklists.checks.map((check, idx) => (
                  <div key={idx} className="flex justify-between items-center border-b border-gray-100 last:border-0 pb-1 last:pb-0">
                    <span className="text-gray-700">{check.name}</span>
                    <span className={`font-mono text-[10px] font-bold ${check.status === 'clean' ? 'text-green-700' : check.status === 'listed' ? 'text-red-600' : 'text-gray-400'}`}>
                      {check.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-1.5 text-[11px] text-gray-500 font-mono">
                Target IP Queried: <strong className="text-gray-900">{result.blacklists.ipChecked || 'N/A'}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Strategic Deliverability Assessment (AI Narrative Layer) */}
        <div className="pt-8 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-gray-800" />
            <div>
              <h3 className="text-base font-bold text-gray-900">
                2. Strategic Deliverability & Provider Impact Assessment
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Executive analysis synthesizing compliance risks for Gmail, Yahoo, and Microsoft Outlook.
              </p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-sm p-6 sm:p-8">
            {result.aiAnalysis ? (
              <div className="prose max-w-none text-gray-800 text-sm leading-relaxed">
                {renderFormattedNarrative(result.aiAnalysis)}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">
                AI deliverability narrative unavailable or skipped for this request.
              </div>
            )}
          </div>
        </div>

        {/* Document Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-400">
          <span>Generated by Email Deliverability Health Checker</span>
          <span>Validated against RFC 7208, RFC 6376, RFC 7489, and RFC 8058</span>
        </div>
      </div>
    </div>
  );
};
