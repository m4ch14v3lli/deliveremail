import React, { useState } from 'react';
import { X, Copy, Check, Settings } from 'lucide-react';

interface ToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  domain: string;
}

export const ToolsModal: React.FC<ToolsModalProps> = ({ isOpen, onClose, domain }) => {
  const [activeTab, setActiveTab] = useState<'spf' | 'dmarc'>('spf');
  const [googleWorkspace, setGoogleWorkspace] = useState(true);
  const [hubspot, setHubspot] = useState(false);
  const [shopify, setShopify] = useState(false);
  const [sendgrid, setSendgrid] = useState(false);
  const [copiedSpf, setCopiedSpf] = useState(false);
  const [policy, setPolicy] = useState<'none' | 'quarantine' | 'reject'>('reject');
  const [percentage, setPercentage] = useState(100);
  const [ruaEmail, setRuaEmail] = useState(`dmarc-reports@${domain || 'yourdomain.com'}`);
  const [copiedDmarc, setCopiedDmarc] = useState(false);

  if (!isOpen) return null;

  const generateSpfRecord = () => {
    let record = 'v=spf1';
    let lookups = 1;
    if (googleWorkspace) { record += ' include:_spf.google.com'; lookups++; }
    if (hubspot) { record += ' include:mail.hubspot.com'; lookups++; }
    if (shopify) { record += ' include:shops.shopify.com'; lookups++; }
    if (sendgrid) { record += ' include:sendgrid.net'; lookups++; }
    record += ' ~all';
    return { record, lookups };
  };

  const spfData = generateSpfRecord();
  const dmarcRecord = `v=DMARC1; p=${policy}; pct=${percentage}; rua=mailto:${ruaEmail}; adkim=s; aspf=s;`;

  const handleCopy = (text: string, type: 'spf' | 'dmarc') => {
    navigator.clipboard.writeText(text);
    if (type === 'spf') {
      setCopiedSpf(true);
      setTimeout(() => setCopiedSpf(false), 2000);
    } else {
      setCopiedDmarc(true);
      setTimeout(() => setCopiedDmarc(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/50 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-sm shadow-2xl max-w-2xl w-full flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-700" />
            <h3 className="font-semibold text-sm text-gray-900 uppercase tracking-wider">DNS Configuration Tools</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-gray-200 px-6 bg-gray-50">
          <button
            onClick={() => setActiveTab('spf')}
            className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'spf' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            SPF Optimizer
          </button>
          <button
            onClick={() => setActiveTab('dmarc')}
            className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'dmarc' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            DMARC Generator
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'spf' ? (
            <div className="space-y-5">
              <p className="text-xs text-gray-600">Select providers to build a compliant SPF record within the 10-lookup limit.</p>
              <div className="grid grid-cols-2 gap-3">
                {[{l: 'Google Workspace', s: googleWorkspace, set: setGoogleWorkspace},
                  {l: 'HubSpot', s: hubspot, set: setHubspot},
                  {l: 'Shopify', s: shopify, set: setShopify},
                  {l: 'SendGrid', s: sendgrid, set: setSendgrid}].map(item => (
                  <label key={item.l} className="flex items-center gap-2 p-2.5 border border-gray-200 rounded-sm cursor-pointer hover:bg-gray-50 transition-colors">
                    <input type="checkbox" checked={item.s} onChange={e => item.set(e.target.checked)} className="rounded-sm border-gray-300 text-gray-900 focus:ring-gray-900" />
                    <span className="text-sm font-medium text-gray-800">{item.l}</span>
                  </label>
                ))}
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1.5 font-medium">
                  <span className="text-gray-600">Lookups used</span>
                  <span className={`font-mono font-bold ${spfData.lookups > 10 ? 'text-red-600' : 'text-gray-900'}`}>{spfData.lookups}/10</span>
                </div>
                <div className="w-full bg-gray-200 h-1.5 rounded-none overflow-hidden">
                  <div className={`h-full ${spfData.lookups > 10 ? 'bg-red-500' : 'bg-gray-800'}`} style={{width: `${(spfData.lookups/10)*100}%`}} />
                </div>
              </div>
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Record (@)</span>
                  <button onClick={() => handleCopy(spfData.record, 'spf')} className="text-xs font-semibold text-gray-700 flex items-center gap-1 hover:text-gray-900 cursor-pointer">
                    {copiedSpf ? <Check className="w-3.5 h-3.5 text-green-600"/> : <Copy className="w-3.5 h-3.5"/>} 
                    {copiedSpf ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <code className="text-xs font-mono text-gray-900 block break-all leading-relaxed">{spfData.record}</code>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <p className="text-xs text-gray-600">Configure DMARC enforcement to protect against spoofing.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1.5">Policy (p=)</label>
                  <select value={policy} onChange={(e: any) => setPolicy(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 bg-white">
                    <option value="none">Monitor (p=none)</option>
                    <option value="quarantine">Quarantine (p=quarantine)</option>
                    <option value="reject">Reject (p=reject)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1.5">Report Email (rua=)</label>
                  <input type="email" value={ruaEmail} onChange={e => setRuaEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm font-mono focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900" />
                </div>
              </div>
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Record (_dmarc)</span>
                  <button onClick={() => handleCopy(dmarcRecord, 'dmarc')} className="text-xs font-semibold text-gray-700 flex items-center gap-1 hover:text-gray-900 cursor-pointer">
                    {copiedDmarc ? <Check className="w-3.5 h-3.5 text-green-600"/> : <Copy className="w-3.5 h-3.5"/>} 
                    {copiedDmarc ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <code className="text-xs font-mono text-gray-900 block break-all leading-relaxed">{dmarcRecord}</code>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
