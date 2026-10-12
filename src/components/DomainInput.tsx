import React, { useState } from 'react';
import { Search, Globe, Key, Loader2 } from 'lucide-react';
import { extractDomain } from '../lib/utils';

interface DomainInputProps {
  onAudit: (domain: string, selector: string) => void;
  loading: boolean;
}

const SAMPLE_DOMAINS = [
  { name: 'stripe.com', selector: 'google' },
  { name: 'microsoft.com', selector: 'selector1' },
  { name: 'hubspot.com', selector: 'hs1' },
];

export const DomainInput: React.FC<DomainInputProps> = ({ onAudit, loading }) => {
  const [domain, setDomain] = useState('');
  const [selector, setSelector] = useState('google');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) return;
    
    const cleanDomain = extractDomain(domain);
    setDomain(cleanDomain);
    onAudit(cleanDomain, selector);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-sm shadow-sm p-6 sm:p-8 max-w-4xl mx-auto my-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight text-gray-900">Domain Deliverability Audit</h2>
        <p className="text-sm text-gray-600 mt-1">
          Inspect SPF lookup limits, DKIM validity, DMARC enforcement, MX records, and blacklist status.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <Globe className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="Enter domain (e.g. example.com)"
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-300 rounded-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 text-sm font-medium transition-all"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !domain.trim()}
            className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 text-white text-sm font-medium rounded-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed min-w-[140px]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Auditing...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Run Audit</span>
              </>
            )}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-700">Test Samples:</span>
            {SAMPLE_DOMAINS.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => { setDomain(item.name); setSelector(item.selector); onAudit(item.name, item.selector); }}
                className="px-2 py-1 rounded bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 transition-colors font-mono text-[11px]"
              >
                {item.name}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-gray-600 hover:text-gray-900 underline underline-offset-2 font-medium mt-2 sm:mt-0"
          >
            {showAdvanced ? 'Hide DKIM Selector' : 'Custom DKIM Selector'}
          </button>
        </div>

        {showAdvanced && (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-sm flex items-center gap-3">
            <Key className="w-4 h-4 text-gray-500" />
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-700 mb-1">DKIM Selector</label>
              <input
                type="text"
                value={selector}
                onChange={(e) => setSelector(e.target.value)}
                placeholder="google"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-sm text-sm font-mono text-gray-800 focus:outline-none focus:border-gray-900"
              />
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
