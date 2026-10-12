import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { DomainInput } from '../components/DomainInput';
import { AuditOverview } from '../components/AuditOverview';
import { Layer1DnsAuth } from '../components/Layer1DnsAuth';
import { Layer2Infrastructure } from '../components/Layer2Infrastructure';
import { Layer3ContentReputation } from '../components/Layer3ContentReputation';
import { AiInsightsTab } from '../components/AiInsightsTab';
import { ToolsModal } from '../components/ToolsModal';
import { DomainAuditResult } from '../types';
import { Download, Printer, PhoneCall } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DomainAuditResult | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'dns' | 'infra' | 'reputation' | 'ai'>('overview');
  const [showTools, setShowTools] = useState(false);
  const { user, getToken } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.state?.auditData) {
      setResult(location.state.auditData);
      setActiveTab('overview');
      // Clear state so a reload doesn't keep showing it if they do another search
      navigate('.', { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  const handleAudit = async (domain: string, selector: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/check-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, selector })
      });
      const data = await res.json();
      setResult(data);
      setActiveTab('overview');
      
      if (user) {
        try {
          const token = await getToken();
          if (token && token !== 'null' && token !== 'undefined') {
            await fetch('/api/audits', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                domain: data.domain,
                score: data.score,
                grade: data.grade,
                resultData: JSON.stringify(data)
              })
            });
          }
        } catch (dbErr) {
          console.warn('Failed to save audit to database:', dbErr);
        }
      }
    } catch (err) {
      console.error(err);
      alert('Failed to run domain audit.');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    if (!result) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `audit-${result.domain}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handlePrint = () => {
    window.print();
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'dns', label: 'DNS Auth' },
    { id: 'infra', label: 'Infrastructure' },
    { id: 'reputation', label: 'Content Analysis' },
    { id: 'ai', label: 'Audit Report' }
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-16 print:bg-white print:pb-0">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 print:py-0 print:space-y-4">
        <div className="print:hidden">
          <DomainInput onAudit={handleAudit} loading={loading} />
        </div>

        {result && (
          <div className="space-y-6 print:space-y-0">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-gray-200 print:hidden">
              <div className="flex items-center gap-6 overflow-x-auto w-full sm:w-auto">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-3 text-[13px] font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                      activeTab === tab.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end pb-2 sm:pb-0">
                <button
                  onClick={() => navigate(`/outreach?domain=${result.domain}`, { state: { domain: result.domain, auditData: result } })}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold uppercase tracking-wider rounded-sm shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Phone Outreach Script</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-[11px] font-bold uppercase tracking-wider rounded-sm shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Report</span>
                </button>
                <button
                  onClick={exportReport}
                  className="px-4 py-2 bg-gray-900 border border-gray-900 hover:bg-gray-800 text-white text-[11px] font-bold uppercase tracking-wider rounded-sm shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export JSON</span>
                </button>
              </div>
            </div>

            <div className="print:block">
              {activeTab === 'overview' && <AuditOverview result={result} onOpenTools={() => setShowTools(true)} />}
              {activeTab === 'dns' && <Layer1DnsAuth result={result} />}
              {activeTab === 'infra' && <Layer2Infrastructure result={result} />}
              {activeTab === 'reputation' && <Layer3ContentReputation result={result} />}
              {activeTab === 'ai' && <AiInsightsTab result={result} />}
            </div>
          </div>
        )}
        <ToolsModal isOpen={showTools} onClose={() => setShowTools(false)} domain={result?.domain || ''} />
      </main>
    </div>
  );
};
