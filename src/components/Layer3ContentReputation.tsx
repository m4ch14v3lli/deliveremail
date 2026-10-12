import React, { useState } from 'react';
import { DomainAuditResult, ContentAnalysisResult } from '../types';
import { Mail, Loader2, Send, Activity, ShieldCheck, AlertCircle, ExternalLink } from 'lucide-react';

interface Layer3ContentReputationProps {
  result: DomainAuditResult;
}

export const Layer3ContentReputation: React.FC<Layer3ContentReputationProps> = ({ result }) => {
  const [subject, setSubject] = useState('Exclusive Offer: Get 50% Off Today Only! Act Now');
  const [body, setBody] = useState('Congratulations! You have been selected as our winner for a free trial. Click here to claim your cash prize with no obligation. Guarantee 100% money back.');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ContentAnalysisResult | null>(null);

  const handleAnalyzeContent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnalyzing(true);
    try {
      const res = await fetch('/api/analyze-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body })
      });
      const data = await res.json();
      setAnalysisResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 print-break-inside-avoid">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <Mail className="w-5 h-5 text-gray-700" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">3. Email Content & Sender Standards</h3>
          <p className="text-xs text-gray-500 mt-0.5">Spam trigger keyword analysis, inbox compliance rules, and reputation telemetry standards.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Compliance & Telemetry Guidance */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-sm p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-gray-700" />
              <h4 className="text-sm font-semibold text-gray-900">Google & Yahoo 2024 Mandates</h4>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed mb-3">
              Enforced for all bulk senders to prevent domain throttling and domain-wide junk folder placement:
            </p>
            <ul className="text-xs space-y-2 text-gray-700">
              <li className="flex items-start gap-1.5">
                <span className="font-bold text-gray-900">•</span>
                <span><strong>Spam Complaint Threshold:</strong> Must stay strictly under <strong>0.10%</strong> (never exceeding 0.30%).</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="font-bold text-gray-900">•</span>
                <span><strong>Mandatory Authentication:</strong> SPF + DKIM + DMARC alignment required on all marketing & transactional mail.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="font-bold text-gray-900">•</span>
                <span><strong>RFC 8058 One-Click Unsubscribe:</strong> Required in headers for all commercial & promotional email lists.</span>
              </li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-sm p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-semibold text-gray-900">Postmaster Telemetry</h4>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed mb-3">
              Google Postmaster and Yahoo Sender Hub metrics are <strong>first-party, owner-only data</strong> protected by Google & Yahoo. They require cryptographic domain ownership verification.
            </p>
            <div className="pt-2 border-t border-gray-100 flex flex-col gap-2">
              <a
                href="https://postmaster.google.com"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-gray-900 hover:text-blue-600 flex items-center justify-between group"
              >
                <span>Google Postmaster Tools</span>
                <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-600" />
              </a>
              <span className="text-[11px] text-gray-500">
                Register <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-gray-800">{result.domain}</code> to monitor live user-reported spam rates, IP reputation, and TLS delivery rates.
              </span>
            </div>
          </div>
        </div>

        {/* Interactive Scanner */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-sm p-6 shadow-sm flex flex-col h-full">
          <div className="mb-5 border-b border-gray-100 pb-4">
            <h4 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-gray-500" />
              Payload Analysis Tool
            </h4>
            <p className="text-xs text-gray-500 mt-1">
              Scan subject lines and body copy for spam trigger words and heuristic flags.
            </p>
          </div>

          <form onSubmit={handleAnalyzeContent} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1.5">Subject Line</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-sm text-sm font-medium text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1.5">Body Copy</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-sm text-sm font-medium text-gray-900 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                required
              />
            </div>

            <button
              type="submit"
              disabled={analyzing}
              className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 text-white text-sm font-medium rounded-sm transition-all flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
            >
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{analyzing ? 'Scanning...' : 'Run Analysis'}</span>
            </button>
          </form>

          {analysisResult && (
            <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="border border-gray-200 rounded-sm p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">Spam Score</span>
                  <span className={`text-xl font-bold font-mono ${analysisResult.spamScore > 30 ? 'text-red-600' : 'text-green-600'}`}>
                    {analysisResult.spamScore}/100
                  </span>
                </div>
                <div className="border border-gray-200 rounded-sm p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">Words</span>
                  <span className="text-xl font-bold font-mono text-gray-900">{analysisResult.wordCount}</span>
                </div>
                <div className="border border-gray-200 rounded-sm p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">Images</span>
                  <span className="text-xl font-bold font-mono text-gray-900">{analysisResult.imgCount}</span>
                </div>
              </div>

              {analysisResult.detectedTriggers.length > 0 && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 block mb-2">Flagged Keywords</span>
                  <div className="flex flex-wrap gap-1.5">
                    {analysisResult.detectedTriggers.map((word, idx) => (
                      <span key={idx} className="px-1.5 py-0.5 bg-red-50 text-red-700 border border-red-200 text-xs font-mono rounded-sm">
                        {word}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {analysisResult.aiContentAnalysis && (
                <div className="p-4 bg-gray-900 text-gray-100 rounded-sm border border-gray-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-2">Automated Recommendations</span>
                  <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed opacity-90">
                    {analysisResult.aiContentAnalysis}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
