import React, { useState } from 'react';
import { DomainAuditResult } from '../types';
import { Shield, AlertTriangle, Lock, Key, Image as ImageIcon, Wrench } from 'lucide-react';
import { FixItSidebar } from './FixItSidebar';

interface Layer1DnsAuthProps {
  result: DomainAuditResult;
}

export const Layer1DnsAuth: React.FC<Layer1DnsAuthProps> = ({ result }) => {
  const [fixModalConfig, setFixModalConfig] = useState<{ isOpen: boolean; title: string; steps: string[]; copySnippet?: string }>({
    isOpen: false,
    title: '',
    steps: []
  });

  const openFixModal = (type: 'spf' | 'dkim' | 'dmarc' | 'bimi') => {
    let title = '';
    let steps: string[] = [];
    let copySnippet: string | undefined = undefined;

    switch (type) {
      case 'spf':
        title = 'Fixing SPF Configuration';
        steps = [
          'Log in to your DNS provider control panel.',
          'Locate the TXT record for your domain (e.g., @ or blank).',
          'Ensure you only have ONE TXT record starting with "v=spf1". Multiple records will cause failures.',
          'Update your record to include all sending sources.',
          'Check your lookup count. If it exceeds 10, consider flattening your SPF or removing unused services.'
        ];
        copySnippet = 'v=spf1 include:_spf.google.com ~all';
        break;
      case 'dkim':
        title = 'Fixing DKIM Configuration';
        steps = [
          'Generate or locate the DKIM selector & key in your Email Service Provider (ESP).',
          'Common ESP selectors: Google Workspace ("google"), Microsoft 365 ("selector1"), Mailchimp ("k1"), SendGrid ("s1"), Postmark.',
          'Log in to your DNS provider control panel.',
          'Create a new TXT or CNAME record (as provided by your email host).',
          'The host name will follow the format: [selector]._domainkey (e.g. google._domainkey or selector1._domainkey).',
          'Paste the public key or CNAME target provided by your email host into the value field.',
          'Activate DKIM signing in your email service provider dashboard.'
        ];
        break;
      case 'dmarc':
        title = 'Fixing DMARC Configuration';
        steps = [
          'Log in to your DNS provider control panel.',
          'Create a new TXT record with the host name "_dmarc".',
          'Set the value to start monitoring.',
          'Monitor your DMARC reports for a few weeks to ensure legitimate email passes SPF and DKIM.',
          'Gradually enforce the policy by changing "p=none" to "p=quarantine", and eventually "p=reject".'
        ];
        copySnippet = `v=DMARC1; p=none; rua=mailto:dmarc-reports@${result.domain};`;
        break;
      case 'bimi':
        title = 'Fixing BIMI Configuration';
        steps = [
          'Ensure DMARC is at enforcement (p=quarantine or p=reject).',
          'Create an SVG Tiny PS version of your logo.',
          'Host the SVG logo on a secure HTTPS URL.',
          'Obtain a Verified Mark Certificate (VMC) from a certified issuing authority.',
          'Create a TXT record for "default._bimi" with your SVG and VMC URLs.'
        ];
        copySnippet = `v=BIMI1; l=https://${result.domain}/logo.svg; a=https://${result.domain}/cert.pem;`;
        break;
    }

    setFixModalConfig({ isOpen: true, title, steps, copySnippet });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 print-break-inside-avoid">
      <FixItSidebar 
        isOpen={fixModalConfig.isOpen} 
        onClose={() => setFixModalConfig(prev => ({ ...prev, isOpen: false }))} 
        title={fixModalConfig.title} 
        steps={fixModalConfig.steps} 
        copySnippet={fixModalConfig.copySnippet}
      />

      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <Shield className="w-5 h-5 text-gray-700" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">1. Core Authentication Records (DNS Layer)</h3>
          <p className="text-xs text-gray-500 mt-0.5">Cryptographic records verifying domain ownership and sender authorization.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* SPF Card */}
        <div className="bg-white border border-gray-200 rounded-sm p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-gray-500" />
                <h4 className="font-semibold text-sm text-gray-900">SPF Alignment</h4>
              </div>
              <div className="flex items-center gap-2">
                {result.spf.status !== 'pass' && (
                  <button onClick={() => openFixModal('spf')} className="print:hidden text-[10px] uppercase font-bold tracking-wider text-gray-600 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded-sm flex items-center gap-1 transition-colors cursor-pointer">
                    <Wrench className="w-3 h-3" /> Fix It
                  </button>
                )}
                <span className={`text-[10px] px-2 py-0.5 rounded-sm font-bold tracking-wider border ${
                  result.spf.status === 'pass' ? 'bg-green-50 text-green-700 border-green-200' :
                  result.spf.status === 'warning' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-red-50 text-red-700 border-red-200'
                }`}>
                  {result.spf.status.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-sm p-3 mb-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">DNS Record</span>
              <code className="text-xs font-mono text-gray-800 break-all block leading-relaxed">
                {result.spf.record || 'No SPF record found'}
              </code>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600 font-medium">Lookup Usage</span>
                <span className={`font-mono font-medium ${result.spf.lookups > 10 ? 'text-red-600' : 'text-gray-900'}`}>
                  {result.spf.lookups} / 10
                </span>
              </div>
              <div className="w-full bg-gray-200 h-1.5 rounded-none overflow-hidden">
                <div 
                  className={`h-full ${result.spf.lookups > 10 ? 'bg-red-500' : 'bg-gray-800'}`}
                  style={{ width: `${Math.min(100, (result.spf.lookups / 10) * 100)}%` }}
                />
              </div>
            </div>

            {result.spf.warnings.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-sm text-xs text-red-800 space-y-1">
                {result.spf.warnings.map((w, idx) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-600 mt-0.5" />
                    <span className="leading-relaxed">{w}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* DKIM Card */}
        <div className="bg-white border border-gray-200 rounded-sm p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-gray-500" />
                <h4 className="font-semibold text-sm text-gray-900">DKIM Signature</h4>
              </div>
              <div className="flex items-center gap-2">
                {result.dkim.status !== 'pass' && (
                  <button onClick={() => openFixModal('dkim')} className="print:hidden text-[10px] uppercase font-bold tracking-wider text-gray-600 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded-sm flex items-center gap-1 transition-colors cursor-pointer">
                    <Wrench className="w-3 h-3" /> Fix It
                  </button>
                )}
                <span className={`text-[10px] px-2 py-0.5 rounded-sm font-bold tracking-wider border ${
                  result.dkim.status === 'pass' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                }`}>
                  {result.dkim.status.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="border border-gray-200 rounded-sm p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">Selector</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <code className="font-mono text-sm text-gray-900 font-bold">{result.dkim.detectedSelector || result.dkim.selector}</code>
                  {result.dkim.detectedSelector && result.dkim.detectedSelector !== result.dkim.selector && (
                    <span className="text-[9px] bg-blue-50 text-blue-700 px-1 py-0.5 rounded border border-blue-200">
                      Auto-detected
                    </span>
                  )}
                </div>
              </div>
              <div className="border border-gray-200 rounded-sm p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">Strength</span>
                <span className="font-mono text-sm text-gray-900">{result.dkim.keySize || (result.dkim.status === 'pass' ? '1024/2048-bit' : 'N/A')}</span>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-sm p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">
                {result.dkim.status === 'pass' ? 'Public Key' : 'Status Detail'}
              </span>
              <code className="text-[11px] font-mono text-gray-700 break-all block max-h-24 overflow-y-auto leading-relaxed">
                {result.dkim.record || result.dkim.error || `Not found under selector '${result.dkim.selector}'`}
              </code>
              {result.dkim.status !== 'pass' && result.dkim.probedSelectors && (
                <div className="mt-2 text-[10px] text-gray-500 border-t border-gray-200 pt-1.5 font-mono">
                  Probed selectors: {result.dkim.probedSelectors.join(', ')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* DMARC Card */}
        <div className="bg-white border border-gray-200 rounded-sm p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-gray-500" />
                <h4 className="font-semibold text-sm text-gray-900">DMARC Enforcement</h4>
              </div>
              <div className="flex items-center gap-2">
                {result.dmarc.policy !== 'reject' && (
                  <button onClick={() => openFixModal('dmarc')} className="print:hidden text-[10px] uppercase font-bold tracking-wider text-gray-600 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded-sm flex items-center gap-1 transition-colors cursor-pointer">
                    <Wrench className="w-3 h-3" /> Fix It
                  </button>
                )}
                <span className={`text-[10px] px-2 py-0.5 rounded-sm font-bold tracking-wider border ${
                  result.dmarc.policy === 'reject' ? 'bg-green-50 text-green-700 border-green-200' :
                  result.dmarc.policy === 'quarantine' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-red-50 text-red-700 border-red-200'
                }`}>
                  P={result.dmarc.policy.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="border border-gray-200 rounded-sm p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">Policy</span>
                <span className="font-mono text-sm font-medium text-gray-900">{result.dmarc.policy}</span>
              </div>
              <div className="border border-gray-200 rounded-sm p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">Enforcement</span>
                <span className="font-mono text-sm font-medium text-gray-900">{result.dmarc.pct}%</span>
              </div>
            </div>

            {result.dmarc.rua && (
              <div className="mb-4 border border-gray-200 rounded-sm p-2.5 text-xs truncate">
                <span className="text-gray-500 mr-2 font-medium">Reports (rua):</span>
                <code className="text-gray-900 font-mono">{result.dmarc.rua}</code>
              </div>
            )}

            <div className="bg-gray-50 border border-gray-200 rounded-sm p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">DNS Record</span>
              <code className="text-xs font-mono text-gray-800 break-all block leading-relaxed">
                {result.dmarc.record || 'No DMARC record found'}
              </code>
            </div>
          </div>
        </div>

        {/* BIMI & VMC Card */}
        <div className="bg-white border border-gray-200 rounded-sm p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-gray-500" />
                <h4 className="font-semibold text-sm text-gray-900">BIMI Authentication</h4>
              </div>
              <div className="flex items-center gap-2">
                {result.bimi.status !== 'pass' && (
                  <button onClick={() => openFixModal('bimi')} className="print:hidden text-[10px] uppercase font-bold tracking-wider text-gray-600 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded-sm flex items-center gap-1 transition-colors cursor-pointer">
                    <Wrench className="w-3 h-3" /> Fix It
                  </button>
                )}
                <span className={`text-[10px] px-2 py-0.5 rounded-sm font-bold tracking-wider border ${
                  result.bimi.status === 'pass' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                }`}>
                  {result.bimi.status === 'pass' ? 'PUBLISHED' : 'MISSING'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="border border-gray-200 rounded-sm p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">SVG Logo</span>
                <span className="font-medium text-sm text-gray-900">{result.bimi.logoUrl ? 'Present' : 'None'}</span>
              </div>
              <div className="border border-gray-200 rounded-sm p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">VMC</span>
                <span className="font-medium text-sm text-gray-900">{result.bimi.vmcPresent ? 'Present' : 'None'}</span>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-sm p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">DNS Record</span>
              <code className="text-xs font-mono text-gray-800 break-all block leading-relaxed">
                {result.bimi.record || 'default._bimi TXT record not published'}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
