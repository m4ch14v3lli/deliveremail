import React, { useState } from 'react';
import { Header } from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, CheckCircle2, XCircle, Clock, Play, PhoneCall, ExternalLink, Download, Filter, AlertTriangle, ShieldCheck, Eye, ListFilter, Trash2, Users, UserCheck, Check, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { DomainAuditResult } from '../types';
import { extractDomain } from '../lib/utils';

const MAX_DOMAINS = 200;
const CONCURRENCY = 6;

interface BulkDomainJob {
  domain: string;
  phone?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  score?: number;
  grade?: string;
  errorMsg?: string;
  resultData?: DomainAuditResult;
}

export interface ParsedBulkItem {
  domain: string;
  phone?: string;
}

export function parseBulkInputLines(text: string): ParsedBulkItem[] {
  if (!text || !text.trim()) return [];
  const lines = text.split(/\r?\n/);
  const items: ParsedBulkItem[] = [];
  const seenDomains = new Set<string>();

  const domainRegex = /(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}/i;
  // Matches phone numbers like +1 469-591-7663, (469) 591-7663, 469-591-7663, +44 20 7946 0919, etc.
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,5}/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Check for delimiter like ' - ', ',', '|', '\t', or ';'
    const domainMatch = line.match(domainRegex);
    if (!domainMatch) continue;

    const domain = domainMatch[0].toLowerCase().trim();
    if (seenDomains.has(domain)) continue;

    // Extract remainder of line or search for phone number pattern
    let phone: string | undefined = undefined;

    // Check if line contains a dash/separator like domain - phone
    const sepSplit = line.split(/\s*[-–—|;,]\s*/);
    if (sepSplit.length > 1) {
      // Find the piece that isn't the domain and has phone digits
      for (const piece of sepSplit) {
        const pMatch = piece.match(phoneRegex);
        if (pMatch && !piece.includes(domainMatch[0])) {
          phone = piece.trim();
          break;
        }
      }
    }

    if (!phone) {
      // Try searching whole line minus the domain
      const remainingLine = line.replace(domainMatch[0], '').trim();
      const pMatch = remainingLine.match(phoneRegex);
      if (pMatch && pMatch[0].replace(/\D/g, '').length >= 7) {
        phone = pMatch[0].trim();
      }
    }

    seenDomains.add(domain);
    items.push({ domain, phone: phone || undefined });
  }

  return items;
}

export const BulkAudit: React.FC = () => {
  const { user, getToken } = useAuth();
  const navigate = useNavigate();
  const [inputText, setInputText] = useState('');
  const [jobs, setJobs] = useState<BulkDomainJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'targets' | 'completed' | 'errors'>('all');
  const [showDomainPreview, setShowDomainPreview] = useState(true);

  // Compute parsed unique domains & optional phone numbers dynamically
  const parsedItems = React.useMemo(() => {
    return parseBulkInputLines(inputText);
  }, [inputText]);

  const activeQueuedItems = parsedItems.slice(0, MAX_DOMAINS);
  const activeQueuedDomains = activeQueuedItems.map(item => item.domain);
  const overflowCount = Math.max(0, parsedItems.length - MAX_DOMAINS);

  const handleStartBulk = async () => {
    if (activeQueuedItems.length === 0) {
      alert("Please enter at least one valid domain.");
      return;
    }

    const initialJobs: BulkDomainJob[] = activeQueuedItems.map(item => ({
      domain: item.domain,
      phone: item.phone,
      status: 'pending' as const,
    }));
    setJobs(initialJobs);
    setIsProcessing(true);

    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < activeQueuedItems.length) {
        const i = nextIndex++;
        const currentItem = activeQueuedItems[i];

        setJobs(prev => prev.map((j, idx) => idx === i ? { ...j, status: 'running' } : j));

        try {
          const res = await fetch('/api/check-domain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain: currentItem.domain, selector: 'default', skipAi: true })
          });

          if (!res.ok) throw new Error('API Error');

          const data: DomainAuditResult = await res.json();

          // Persist to PostgreSQL if authenticated
          if (user) {
            try {
              let token = await getToken();
              if (!token && typeof window !== 'undefined') {
                token = localStorage.getItem('app_auth_jwt_token');
              }
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
              console.warn('Failed to save bulk audit in database:', dbErr);
            }
          }

          setJobs(prev => prev.map((j, idx) => idx === i ? { 
            ...j, 
            status: 'completed',
            score: data.score,
            grade: data.grade,
            resultData: data
          } : j));
        } catch (err: any) {
          setJobs(prev => prev.map((j, idx) => idx === i ? { 
            ...j, 
            status: 'error',
            errorMsg: err.message || 'Audit failed'
          } : j));
        }
      }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY, activeQueuedItems.length) }, () => worker());
    await Promise.all(workers);

    setJobs(currentJobs => {
      const completed = currentJobs.filter(j => j.status === 'completed');
      if (completed.length > 0 && typeof window !== 'undefined') {
        try {
          localStorage.setItem('bulk_audit_outreach_queue', JSON.stringify(completed));
        } catch (e) {
          console.warn('Failed to save bulk queue to localStorage:', e);
        }
      }
      return currentJobs;
    });

    setIsProcessing(false);
  };

  const [isDistributing, setIsDistributing] = useState(false);
  const [distributeSuccessNotice, setDistributeSuccessNotice] = useState<string | null>(null);

  const handleLoadSample200 = () => {
    const sampleData = [
      { domain: "dallascommercialroofingcompany.net", phone: "+1 469-591-7663" },
      { domain: "sunsetplumbingco.com", phone: "+1 817-552-9014" },
      { domain: "bakerlawgroup.org", phone: "+1 972-401-8899" },
      { domain: "metroautoexpress.com", phone: "+1 214-774-3200" },
      { domain: "oakridgerealtypros.com", phone: "+1 469-820-1123" },
      { domain: "brightsmileclinic.org", phone: "+1 817-664-9988" },
      { domain: "apexconsultingllc.com", phone: "+1 214-902-5561" },
      { domain: "beaconlogisticsllc.com", phone: "+1 972-331-4040" },
      { domain: "summitcounselingcenter.org", phone: "+1 469-238-7712" },
      { domain: "coastalhvacservice.com", phone: "+1 817-490-6621" },
      { domain: "vanguardaccounting.org", phone: "+1 214-885-3309" },
      { domain: "clearwaterpoolpros.com", phone: "+1 972-710-4491" },
      { domain: "evergreenlandscapes.org", phone: "+1 469-501-8842" },
      { domain: "precisionmechanicgroup.com", phone: "+1 817-331-2900" },
      { domain: "northstartraveladvisors.com", phone: "+1 214-640-1289" },
      { domain: "highlandinsuranceco.org", phone: "+1 972-882-7740" },
      { domain: "primeveterinarycare.com", phone: "+1 469-910-6677" },
      { domain: "cedarwoodcontractors.org", phone: "+1 817-720-3341" },
      { domain: "horizonphysiotherapy.com", phone: "+1 214-551-9923" },
      { domain: "valleydermatologysuite.org", phone: "+1 972-663-8810" },
      { domain: "libertyroofingpros.com", phone: "+1 469-440-2219" },
      { domain: "nexusdigitalmedia.org", phone: "+1 817-883-1150" },
      { domain: "atlasmovingpros.com", phone: "+1 214-332-9090" },
      { domain: "silverlinecouriers.org", phone: "+1 972-224-5511" },
      { domain: "premierchiropracticcare.com", phone: "+1 469-771-3348" },
    ];

    const lines: string[] = sampleData.map(item => `${item.domain} - ${item.phone}`);
    // If we want more to showcase up to 100 or 200, generate additional realistic items
    const baseNames = [
      "crestviewelectric", "goldenstateflooring", "heritageappraisals", "blueharboreats",
      "frontiermortgages", "benchmarksecurity", "cascadecleaning", "sterlingwealthmgmt",
      "zenithengineering", "clarityoptometry", "firstchoiceplumbing", "alliancelandtitle",
      "dynamicprintworks", "gatewayrehabclinic", "paramountpainting", "apexpropertymgmt",
      "vectorcreativestudio", "truenortharchitects", "trinityhealthcenter", "expressbailbonds",
      "libertyfinancialadvisors", "solarisenergypros", "cornerstonepestcontrol", "radianthealthclinic",
      "premiercommercialroof", "vanguardsecuritypros", "coastalbreezehvac", "apexlegalpartners",
      "bluehorizonmarine", "summitpeakrealty", "everlastflooringco", "integrityautocare",
      "solarpowersolutions", "aspenfamilydentistry", "bayviewcardiology", "centralpediatrics",
      "deltaorthodontics", "eagleeyecare", "falconsecuritypros", "granitecountertoppros",
      "harborwealthadvisors", "ironcladroofing", "jupiterlogistics", "kingstonlegalgroup",
      "lakesidemarinapros", "meridianaccounting", "novusmarketinglabs", "olympusfitnessclub",
      "pacificcoasthvac", "quantumtechrepairs", "riverfrontlawfirm", "sierraelectricpros"
    ];

    let areaCode = 214;
    let seq = 100;
    for (const name of baseNames) {
      if (lines.length < 200) {
        areaCode = (areaCode === 214 ? 469 : areaCode === 469 ? 817 : areaCode === 817 ? 972 : 214);
        seq += 13;
        lines.push(`${name}.com - +1 ${areaCode}-${seq.toString().padStart(3, '0')}-${(4000 + seq).toString()}`);
      }
    }

    setInputText(lines.slice(0, 200).join('\n'));
  };

  const handleDistributeTo4Callers = async () => {
    const completed = jobs.filter(j => j.status === 'completed');
    if (completed.length === 0) {
      alert("Please run the bulk audit first. Once domains are audited, you can distribute 25 leads to each caller.");
      return;
    }

    try {
      setIsDistributing(true);
      setDistributeSuccessNotice(null);
      const res = await fetch('/api/leads/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads: completed.map(c => ({
            domain: c.domain,
            phone: c.phone || undefined,
            companyName: c.domain.split('.')[0].replace(/[-_]/g, ' ').toUpperCase(),
            grade: c.grade,
            score: c.score,
            resultData: c.resultData,
          })),
          leadsPerCaller: 25,
          assignerEmail: 'melbourne258@gmail.com',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to distribute leads.");
      }

      const data = await res.json();
      setDistributeSuccessNotice(
        `Split ${data.totalDistributed} leads equally to 4 callers by main assigner melbourne258@gmail.com without duplicates: Larry [@f1n3ssing_l4rry]: ${data.distribution?.larry || 0} leads | Kelly [@4mg_kyl14n]: ${data.distribution?.kelly || 0} leads | Ramadhan [@r4m4dh4n]: ${data.distribution?.ramadhan || 0} leads | Melbourne [@M3lbourn3]: ${data.distribution?.melbourne || 0} leads.`
      );

      // Cache completed jobs in localStorage for outreach
      try {
        localStorage.setItem('bulk_audit_outreach_queue', JSON.stringify(completed));
      } catch (e) {}
    } catch (err: any) {
      alert(err.message || "Failed to distribute leads to the 4 callers.");
    } finally {
      setIsDistributing(false);
    }
  };

  const completedCount = jobs.filter(j => j.status === 'completed' || j.status === 'error').length;
  const progressPercent = jobs.length > 0 ? (completedCount / jobs.length) * 100 : 0;

  // Stats calculation
  const totalCompleted = jobs.filter(j => j.status === 'completed');
  const primeCallTargets = totalCompleted.filter(j => j.grade?.startsWith('D') || j.grade?.startsWith('F'));
  const warningsCount = totalCompleted.filter(j => j.grade?.startsWith('C'));
  const healthyCount = totalCompleted.filter(j => j.grade?.startsWith('A') || j.grade?.startsWith('B'));

  // Filtered jobs
  const displayedJobs = jobs.filter(job => {
    if (filterType === 'targets') {
      return job.status === 'completed' && (job.grade?.startsWith('D') || job.grade?.startsWith('F'));
    }
    if (filterType === 'completed') {
      return job.status === 'completed';
    }
    if (filterType === 'errors') {
      return job.status === 'error';
    }
    return true;
  });

  const exportCsv = () => {
    if (jobs.length === 0) return;
    const headers = ["Domain", "Phone", "Status", "Score", "Grade", "SPF Status", "DMARC Policy", "Blacklist Clean", "Cold Call Priority"];
    const rows = jobs.map(j => {
      const isTarget = j.grade?.startsWith('D') || j.grade?.startsWith('F');
      return [
        j.domain,
        j.phone || "",
        j.status,
        j.score ?? "N/A",
        j.grade ?? "N/A",
        j.resultData?.spf.status ?? "N/A",
        j.resultData?.dmarc.policy ?? "N/A",
        j.resultData?.blacklists.clean ? "Clean" : "Listed",
        isTarget ? "HIGH (Grade D/F)" : "NORMAL"
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `domain_audit_batch_${jobs.length}_domains.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLaunchOutreach = (job: BulkDomainJob) => {
    const completedJobs = jobs.filter(j => j.status === 'completed');
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('bulk_audit_outreach_queue', JSON.stringify(completedJobs));
      } catch (e) {}
    }
    navigate(`/outreach?domain=${job.domain}`, {
      state: {
        domain: job.domain,
        phone: job.phone,
        auditData: job.resultData,
        auditQueue: completedJobs,
        fromBulk: true
      }
    });
  };

  const handleOpenOutreachDashboard = () => {
    const completedJobs = jobs.filter(j => j.status === 'completed');
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('bulk_audit_outreach_queue', JSON.stringify(completedJobs));
      } catch (e) {}
    }
    navigate('/outreach', {
      state: {
        auditQueue: completedJobs,
        fromBulk: true
      }
    });
  };

  const handleViewAudit = (job: BulkDomainJob) => {
    if (!job.resultData) return;
    navigate('/', {
      state: {
        auditData: job.resultData
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-16">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900">Bulk Domain Deliverability Audit</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 uppercase tracking-wider">
                {MAX_DOMAINS} Domains Capacity
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Audit up to {MAX_DOMAINS} domains in parallel, uncover critical email delivery failures, and generate cold call phone scripts for at-risk prospects.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/outreach')}
              className="px-3.5 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-800 text-xs font-semibold rounded-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              Phone Outreach Playbook
            </button>
          </div>
        </div>

        {jobs.length === 0 ? (
          <div className="bg-white p-6 rounded-sm border border-gray-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between mb-1">
              <div>
                <label className="block text-sm font-bold text-gray-900">
                  Paste domains & phone numbers (one per line, up to {MAX_DOMAINS} items)
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Paste plain domains or with telephone numbers (e.g. <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-700 font-bold">domain.com - +1 469-591-7663</code>). Phone numbers automatically appear on the lead cards & caller spreadsheets.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {inputText.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => setInputText('')}
                    className="text-xs text-red-600 hover:text-red-800 font-semibold cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleLoadSample200}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  + Load Sample Domains with Phone Numbers
                </button>
              </div>
            </div>

            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              className="w-full h-56 p-4 text-sm font-mono border border-gray-300 rounded-sm focus:ring-1 focus:ring-gray-900 focus:border-gray-900 resize-y"
              placeholder={`dallascommercialroofingcompany.net - +1 469-591-7663\napexconsultinggroup.com - +1 (214) 839-4412\nsunsetplumbingco.com - +1 817-552-9014\nbakerlawgroup.org - +1 972-401-8899\n... (Paste up to ${MAX_DOMAINS} lines with domains and phone numbers)`}
            />

            {/* Parsed List Full Inspector: Shows domains and detected phone numbers */}
            {activeQueuedItems.length > 0 && (
              <div className="border border-gray-200 rounded-sm bg-gray-50 p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                      <ListFilter className="w-3.5 h-3.5 text-gray-700" />
                      Queued Leads ({activeQueuedItems.length} of {MAX_DOMAINS} max)
                    </span>
                    {activeQueuedItems.length === MAX_DOMAINS && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded border border-emerald-200">
                        Full {MAX_DOMAINS} Capacity Reached
                      </span>
                    )}
                    {overflowCount > 0 && (
                      <span className="text-[10px] font-medium px-2 py-0.5 bg-amber-100 text-amber-800 rounded border border-amber-200">
                        {overflowCount} extra domains trimmed to fit limit
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDomainPreview(!showDomainPreview)}
                    className="text-xs text-gray-600 hover:text-gray-900 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {showDomainPreview ? 'Collapse Full List' : `Look at All ${activeQueuedItems.length} Leads`}
                  </button>
                </div>

                {showDomainPreview && (
                  <div className="max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-sm p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 font-mono text-xs text-gray-800 divide-y sm:divide-y-0">
                    {activeQueuedItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 py-1 px-1.5 rounded-xs hover:bg-gray-50 border border-gray-100 sm:border-0">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-[10px] font-bold text-gray-400 w-5 select-none shrink-0">{String(idx + 1).padStart(2, '0')}.</span>
                          <span className="truncate select-all text-gray-900 font-semibold">{item.domain}</span>
                        </div>
                        {item.phone && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-2xs font-mono font-bold shrink-0">
                            📞 {item.phone}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <span className="text-xs text-gray-500 font-medium">
                {activeQueuedDomains.length} unique domains detected ({activeQueuedDomains.length}/{MAX_DOMAINS} capacity)
              </span>
              <button
                onClick={handleStartBulk}
                disabled={activeQueuedDomains.length === 0}
                className="w-full sm:w-auto px-6 py-2.5 bg-gray-900 text-white text-[13px] font-bold uppercase tracking-wider rounded-sm shadow-xs hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4" /> Start Bulk Audit ({activeQueuedDomains.length} / {MAX_DOMAINS} Max)
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Progress & Quick Stats Card */}
            <div className="bg-white p-6 rounded-sm border border-gray-200 shadow-xs">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
                <div className="w-full">
                  <div className="flex justify-between text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                    <span className="flex items-center gap-2">
                      {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />}
                      Audit Progress
                    </span>
                    <span>{completedCount} of {jobs.length} completed ({Math.round(progressPercent)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-gray-900 h-2.5 rounded-full transition-all duration-300" 
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                </div>

                {!isProcessing && (
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {totalCompleted.length > 0 && (
                      <button
                        onClick={handleOpenOutreachDashboard}
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-sm transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title="Open Phone Outreach Dashboard with all audited prospects"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        Outreach Dashboard ({totalCompleted.length})
                      </button>
                    )}
                    <button
                      onClick={exportCsv}
                      className="px-3.5 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-sm transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" /> Export CSV ({jobs.length})
                    </button>
                    <button
                      onClick={() => { setJobs([]); setInputText(''); }}
                      className="px-3.5 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-sm transition-colors cursor-pointer shadow-2xs"
                    >
                      New Audit
                    </button>
                  </div>
                )}
              </div>

              {/* KPI Summary Tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-gray-100">
                <div className="bg-gray-50 p-3 rounded-xs border border-gray-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Total Audited</span>
                  <span className="text-xl font-black text-gray-900">{jobs.length} / {MAX_DOMAINS}</span>
                </div>
                <div className="bg-red-50 p-3 rounded-xs border border-red-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 block flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Cold Call Targets (D/F)
                  </span>
                  <span className="text-xl font-black text-red-800">{primeCallTargets.length}</span>
                </div>
                <div className="bg-yellow-50 p-3 rounded-xs border border-yellow-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-700 block">Warnings (Grade C)</span>
                  <span className="text-xl font-black text-yellow-800">{warningsCount.length}</span>
                </div>
                <div className="bg-green-50 p-3 rounded-xs border border-green-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-green-700 block flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Healthy (A/B)
                  </span>
                  <span className="text-xl font-black text-green-800">{healthyCount.length}</span>
                </div>
              </div>
            </div>

            {/* Lead Split Notification */}
            {distributeSuccessNotice && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-4 rounded-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-800">4-Caller Split Complete (No Duplicates)</h5>
                    <p className="text-xs text-emerald-900 font-medium mt-0.5">{distributeSuccessNotice}</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/outreach')}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xs shrink-0 cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Open Callers Dashboard →</span>
                </button>
              </div>
            )}

            {/* Campaign Ready Call-to-Action Banner */}
            {totalCompleted.length > 0 && (
              <div className="bg-gradient-to-r from-gray-900 via-indigo-950 to-gray-900 border border-indigo-800 text-white p-4.5 rounded-sm shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-800/80 rounded-sm shrink-0 border border-indigo-700">
                    <PhoneCall className="w-5 h-5 text-indigo-300" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                      <span>Phone Outreach Campaign Ready</span>
                      {primeCallTargets.length > 0 && (
                        <span className="text-[10px] bg-red-500 text-white font-black px-1.5 py-0.5 rounded-xs">
                          {primeCallTargets.length} Cold Call Targets (D/F)
                        </span>
                      )}
                      <span className="text-[10px] bg-indigo-700/80 text-indigo-200 font-semibold px-1.5 py-0.5 rounded-xs">
                        Main Assigner: melbourne258@gmail.com
                      </span>
                    </h4>
                    <p className="text-xs text-indigo-200 mt-0.5">
                      Distribute 25 unique leads to each of the 4 callers (Larry, Kelly, Ramadhan, Melbourne) without duplicate domains. Main assigner: <strong>melbourne258@gmail.com</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto justify-end">
                  <button
                    onClick={handleDistributeTo4Callers}
                    disabled={isDistributing}
                    className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
                    title="Split 25 unique leads each via main assigner melbourne258@gmail.com to Larry (@f1n3ssing_l4rry), Kelly (@4mg_kyl14n), Ramadhan (@r4m4dh4n), and Melbourne (@M3lbourn3)"
                  >
                    {isDistributing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                    <span>{isDistributing ? "Splitting Leads..." : "Assign 25 Leads to 4 Callers"}</span>
                  </button>

                  <button
                    onClick={handleOpenOutreachDashboard}
                    className="w-full sm:w-auto px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Launch Outreach Dashboard ({totalCompleted.length}) →</span>
                  </button>
                </div>
              </div>
            )}

            {/* Filter Tabs */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1 bg-white border border-gray-200 p-1 rounded-sm shadow-2xs">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xs cursor-pointer transition-colors ${
                    filterType === 'all' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All ({jobs.length})
                </button>
                <button
                  onClick={() => setFilterType('targets')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xs cursor-pointer transition-colors ${
                    filterType === 'targets' ? 'bg-red-600 text-white' : 'text-red-700 hover:bg-red-50'
                  }`}
                >
                  Cold Call Targets ({primeCallTargets.length})
                </button>
                <button
                  onClick={() => setFilterType('completed')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xs cursor-pointer transition-colors ${
                    filterType === 'completed' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Completed ({totalCompleted.length})
                </button>
                <button
                  onClick={() => setFilterType('errors')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xs cursor-pointer transition-colors ${
                    filterType === 'errors' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Errors ({jobs.filter(j => j.status === 'error').length})
                </button>
              </div>

              <span className="text-xs text-gray-500 font-medium">
                Showing all {displayedJobs.length} of {jobs.length} domains
              </span>
            </div>

            {/* Domains Table: Displays all 60 rows */}
            <div className="bg-white border border-gray-200 rounded-sm shadow-xs overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-gray-500 w-12">#</th>
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-gray-500">Domain</th>
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-gray-500">Status</th>
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-gray-500">Score & Grade</th>
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-gray-500">Core Findings</th>
                    <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-gray-500 text-right">Outreach Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayedJobs.map((job, index) => {
                    const isFailing = job.grade?.startsWith('D') || job.grade?.startsWith('F');
                    return (
                      <tr key={index} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs text-gray-400 select-none">
                          {String(index + 1).padStart(2, '0')}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs">
                          <span className="font-bold text-gray-900 block truncate max-w-[240px]">
                            {job.domain}
                          </span>
                          {job.phone && (
                            <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                              📞 {job.phone}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {job.status === 'pending' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-medium bg-gray-100 text-gray-600">
                              <Clock className="w-3 h-3" /> Pending
                            </span>
                          )}
                          {job.status === 'running' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              <Loader2 className="w-3 h-3 animate-spin" /> Auditing...
                            </span>
                          )}
                          {job.status === 'completed' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-medium bg-green-50 text-green-700 border border-green-200">
                              <CheckCircle2 className="w-3 h-3" /> Done
                            </span>
                          )}
                          {job.status === 'error' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">
                              <XCircle className="w-3 h-3" /> Error
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {job.status === 'completed' && job.grade ? (
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-xs text-xs font-bold ${
                                job.grade.startsWith('A') ? 'bg-green-100 text-green-800 border border-green-200' :
                                job.grade.startsWith('B') ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                job.grade.startsWith('C') ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                'bg-red-100 text-red-800 border border-red-200'
                              }`}>
                                {job.grade}
                              </span>
                              <span className="text-xs text-gray-500 font-mono">{job.score}/100</span>
                            </div>
                          ) : job.status === 'error' ? (
                            <span className="text-xs text-red-600 truncate max-w-[150px] block" title={job.errorMsg}>
                              {job.errorMsg}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-600">
                          {job.resultData ? (
                            <div className="flex flex-wrap gap-1 text-[10px]">
                              <span className={`px-1.5 py-0.5 rounded-xs ${
                                job.resultData.spf.status === 'pass' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
                              }`}>
                                SPF: {job.resultData.spf.status}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded-xs ${
                                job.resultData.dmarc.policy !== 'none' && job.resultData.dmarc.status === 'pass' 
                                  ? 'bg-green-50 text-green-700 border border-green-100' 
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}>
                                DMARC: {job.resultData.dmarc.policy || job.resultData.dmarc.status}
                              </span>
                              {!job.resultData.blacklists.clean && (
                                <span className="px-1.5 py-0.5 rounded-xs bg-red-100 text-red-800 border border-red-200 font-bold">
                                  BLACKLISTED
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {job.status === 'completed' ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleLaunchOutreach(job)}
                                className={`px-2.5 py-1 text-xs font-bold rounded-xs transition-colors flex items-center gap-1 cursor-pointer ${
                                  isFailing 
                                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-2xs' 
                                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                                }`}
                                title="Generate phone call scripts for this domain"
                              >
                                <PhoneCall className="w-3 h-3" />
                                {isFailing ? 'Call Script (Prime Target)' : 'Call Script'}
                              </button>

                              <button
                                onClick={() => handleViewAudit(job)}
                                className="p-1 text-gray-500 hover:text-gray-900 cursor-pointer"
                                title="View detailed technical audit"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
