import React, { useState } from 'react';
import { DomainAuditResult } from '../types';
import { Server, CheckCircle2, XCircle, ShieldAlert, Wrench } from 'lucide-react';
import { FixItSidebar } from './FixItSidebar';

interface Layer2InfrastructureProps {
  result: DomainAuditResult;
}

export const Layer2Infrastructure: React.FC<Layer2InfrastructureProps> = ({ result }) => {
  const [fixModalConfig, setFixModalConfig] = useState<{ isOpen: boolean; title: string; steps: string[] }>({
    isOpen: false,
    title: '',
    steps: []
  });

  const openFixModal = (type: 'mx' | 'rdns' | 'blacklists') => {
    let title = '';
    let steps: string[] = [];
    let copySnippet: string | undefined = undefined;

    if (type === 'mx') {
      title = 'Fixing MX Records';
      steps = [
        'Log in to your DNS provider control panel.',
        'Locate the MX records section for your domain.',
        'Ensure you have valid MX records pointing to your email service provider (e.g., Google Workspace, Microsoft 365).',
        'Verify the priority values are set correctly according to your provider\'s documentation.',
        'Remove any old or duplicate MX records pointing to unused servers.'
      ];
      // Example for Google Workspace
      copySnippet = 'Name: @\nType: MX\nPriority: 1\nValue: smtp.google.com';
    } else if (type === 'rdns') {
      title = 'Fixing Reverse DNS (PTR) Record';
      steps = [
        'PTR records can only be configured by the entity that controls the IP address (your ISP, VPS, or cloud hosting provider like AWS, DigitalOcean, Linode, Hetzner, etc.).',
        `Log in to your hosting provider's management console for IP: ${result.rdns.ip || 'your mail server IP'}.`,
        'Locate the "Reverse DNS" or "PTR" networking settings for this IP.',
        `Set the reverse PTR record to match your mail server host name (e.g., ${result.mx.records[0]?.exchange || 'mail.' + result.domain}).`,
        'Ensure an A record exists for that host name pointing back to this same IP to achieve Forward-Confirmed Reverse DNS (FCrDNS).'
      ];
      if (result.rdns.ip) {
        copySnippet = `IP: ${result.rdns.ip}\nPTR Hostname: ${result.mx.records[0]?.exchange || 'mail.' + result.domain}`;
      }
    } else if (type === 'blacklists') {
      title = 'Resolving Blacklist Issues';
      steps = [
        `Identify which specific blocklists your sending IP (${result.blacklists.ipChecked || 'server IP'}) is listed on.`,
        'Investigate the root cause: Check for compromised user accounts, open relays, malware, or sudden spikes in bounce rates.',
        'Fix the underlying issue immediately before submitting any removal request.',
        'Visit the specific DNSBL lookup & delisting page (e.g. SpamCop, Barracuda, UCEPROTECT) and submit a delisting request.',
        'Ensure SPF, DKIM, and DMARC are fully authenticated to build positive sender reputation.'
      ];
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
        <Server className="w-5 h-5 text-gray-700" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900">2. Infrastructure & Network Health</h3>
          <p className="text-xs text-gray-500 mt-0.5">Physical mail servers, MX routing, reverse DNS, and global blocklists.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* MX Records */}
        <div className="bg-white border border-gray-200 rounded-sm p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-semibold text-sm text-gray-900">Mail Exchanger (MX)</h4>
              <div className="flex items-center gap-2">
                {result.mx.status !== 'pass' && (
                  <button onClick={() => openFixModal('mx')} className="print:hidden text-[10px] uppercase font-bold tracking-wider text-gray-600 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded-sm flex items-center gap-1 transition-colors cursor-pointer">
                    <Wrench className="w-3 h-3" /> Fix It
                  </button>
                )}
                {result.mx.status === 'pass' ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
              </div>
            </div>

            <div className="space-y-2">
              {result.mx.records && result.mx.records.length > 0 ? (
                result.mx.records.map((mx, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                    <span className="font-mono text-gray-800 truncate pr-2">{mx.exchange}</span>
                    <span className="text-gray-500 font-mono text-[11px] font-bold">PRI:{mx.priority}</span>
                  </div>
                ))
              ) : (
                <div className="p-3 bg-red-50 border border-red-100 rounded-sm text-xs text-red-800">
                  {result.mx.error || 'No MX records found.'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* rDNS / PTR */}
        <div className="bg-white border border-gray-200 rounded-sm p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-semibold text-sm text-gray-900">rDNS / PTR</h4>
                <span className="text-[11px] text-gray-500 font-mono">
                  {result.rdns.ip ? `IP: ${result.rdns.ip}` : 'No Mail Server IP'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {result.rdns.status !== 'pass' && (
                  <button onClick={() => openFixModal('rdns')} className="print:hidden text-[10px] uppercase font-bold tracking-wider text-gray-600 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded-sm flex items-center gap-1 transition-colors cursor-pointer">
                    <Wrench className="w-3 h-3" /> Fix It
                  </button>
                )}
                {result.rdns.status === 'pass' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600" />
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="border-b border-gray-100 pb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-0.5">Resolution</span>
                <span className={`font-medium text-sm ${result.rdns.status === 'pass' ? 'text-green-700' : 'text-red-700'}`}>
                  {result.rdns.status === 'pass' ? 'Resolved Successfully' : 'Missing PTR Record'}
                </span>
              </div>
              <div className="border-b border-gray-100 pb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-0.5">PTR Hostname</span>
                <span className="font-mono text-xs text-gray-900 break-all">
                  {result.rdns.ptr || 'No PTR record configured'}
                </span>
              </div>
              {result.rdns.fcrdns && (
                <div className="pt-1">
                  <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-sm bg-green-50 text-green-700 border border-green-200">
                    FCrDNS Verified
                  </span>
                </div>
              )}
              {result.rdns.error && result.rdns.status !== 'pass' && (
                <div className="p-2 bg-red-50 border border-red-100 rounded-sm text-[11px] text-red-700">
                  {result.rdns.error}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Blacklists */}
        <div className="bg-white border border-gray-200 rounded-sm p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-semibold text-sm text-gray-900">Global Blocklists</h4>
                <span className="text-[11px] text-gray-500 font-mono">
                  {result.blacklists.ipChecked ? `Target: ${result.blacklists.ipChecked}` : 'No sending IP resolved'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {result.blacklists.listedCount > 0 && (
                  <button onClick={() => openFixModal('blacklists')} className="print:hidden text-[10px] uppercase font-bold tracking-wider text-gray-600 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded-sm flex items-center gap-1 transition-colors cursor-pointer">
                    <Wrench className="w-3 h-3" /> Fix It
                  </button>
                )}
                {result.blacklists.listedCount === 0 ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <ShieldAlert className="w-4 h-4 text-red-600" />}
              </div>
            </div>

            <div className="space-y-2">
              {result.blacklists.checks.map((check, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                  <div>
                    <span className="text-gray-800 font-medium">{check.name}</span>
                    <span className="text-[10px] text-gray-400 block font-mono">{check.zone}</span>
                  </div>
                  <span className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded-sm ${
                    check.status === 'clean' ? 'text-green-700 bg-green-50 border border-green-200' :
                    check.status === 'listed' ? 'text-red-700 bg-red-50 border border-red-200' :
                    'text-gray-500 bg-gray-100'
                  }`}>
                    {check.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
