import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { 
  PhoneCall, ShieldAlert, Sparkles, Copy, Check, Users, UserCheck, 
  PhoneForwarded, MessageSquare, AlertTriangle, ArrowRight, ArrowLeft, 
  Loader2, Bookmark, Trash2, Printer, RefreshCw, FileText, ChevronLeft, 
  ChevronRight, Search, ShieldCheck, LayoutDashboard, Table, X, CheckSquare, Clock,
  Key, CheckCircle2, Lock 
} from 'lucide-react';
import { PhoneOutreachScript, SavedOutreachRecord, DomainAuditResult } from '../types';

function safeJsonParse(val: any): any {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}

export interface QueueProspect {
  domain: string;
  phone?: string;
  companyName?: string;
  score?: number;
  grade?: string;
  resultData?: any;
}

export interface CallerSession {
  callerKey: string;
  name: string;
  email?: string;
  token?: string;
}

export interface AssignedLeadItem {
  id: number;
  callerKey: string;
  callerName: string;
  domain: string;
  phone?: string | null;
  companyName: string | null;
  grade: string | null;
  score: number | null;
  resultData?: any;
  status: string;
  notes: string | null;
  batchId?: string;
  assignedAt?: string;
  updatedAt?: string;
}

export const Outreach: React.FC = () => {
  const { user, getToken } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Search parameters
  const searchParams = new URLSearchParams(location.search);
  const initialDomain = searchParams.get('domain') || location.state?.domain || '';

  // Bulk Audited Domains Queue State
  const [queue, setQueue] = useState<QueueProspect[]>(() => {
    if (location.state?.auditQueue && Array.isArray(location.state.auditQueue)) {
      return location.state.auditQueue.map((item: any) => ({
        domain: item.domain,
        phone: item.phone,
        companyName: item.companyName || item.domain.split('.')[0].replace(/[-_]/g, ' '),
        score: item.score,
        grade: item.grade,
        resultData: safeJsonParse(item.resultData),
      }));
    }
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('bulk_audit_outreach_queue');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((item: any) => ({
              domain: item.domain,
              phone: item.phone,
              companyName: item.companyName || item.domain.split('.')[0].replace(/[-_]/g, ' '),
              score: item.score,
              grade: item.grade,
              resultData: safeJsonParse(item.resultData),
            }));
          }
        }
      } catch (e) {}
    }
    return [];
  });

  // View Mode: 'dashboard' shows all bulk audited domains; 'script' shows a specific domain battlecard
  const [viewMode, setViewMode] = useState<'dashboard' | 'script'>(() => {
    if (location.state?.viewDashboard) return 'dashboard';
    if (!initialDomain && (location.state?.auditQueue?.length || 0) > 0) return 'dashboard';
    if (initialDomain) return 'script';
    // If we have items in queue from localStorage and no explicit domain was requested
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('bulk_audit_outreach_queue');
      if (stored && !initialDomain) {
        try {
          const p = JSON.parse(stored);
          if (Array.isArray(p) && p.length > 0) return 'dashboard';
        } catch {}
      }
    }
    return 'dashboard';
  });

  const [selectedQueueIndex, setSelectedQueueIndex] = useState<number>(() => {
    if (initialDomain && queue.length > 0) {
      const idx = queue.findIndex(q => q.domain.toLowerCase() === initialDomain.toLowerCase());
      return idx !== -1 ? idx : 0;
    }
    return 0;
  });

  const [dashboardFilter, setDashboardFilter] = useState<'all' | 'targets' | 'warnings' | 'healthy'>('all');
  const [dashboardSearch, setDashboardSearch] = useState('');

  // Form State
  const [domain, setDomain] = useState(initialDomain);
  const [phone, setPhone] = useState(location.state?.phone || '');
  const [companyName, setCompanyName] = useState(location.state?.companyName || '');
  const [officeManagerName, setOfficeManagerName] = useState('');
  const [callerName, setCallerName] = useState('');
  const [callStyle, setCallStyle] = useState<'consultative' | 'urgent' | 'friendly'>('consultative');

  // Script State
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentScript, setCurrentScript] = useState<PhoneOutreachScript | null>(null);
  const [activeTab, setActiveTab] = useState<'frontDesk' | 'owner' | 'voicemail'>('frontDesk');
  const [auditInfo, setAuditInfo] = useState<any>(location.state?.auditData || null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Saved Scripts State
  const [savedScripts, setSavedScripts] = useState<SavedOutreachRecord[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Role-Based Caller Authentication & Lead Assignment State
  const [currentCaller, setCurrentCaller] = useState<CallerSession | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('caller_session');
        if (stored) return JSON.parse(stored);
      } catch (e) {}
    }
    return null;
  });

  const [showCallerModal, setShowCallerModal] = useState(false);
  const [callerNameInput, setCallerNameInput] = useState('');
  const [callerEmailInput, setCallerEmailInput] = useState('');
  const [callerCodeInput, setCallerCodeInput] = useState('');
  const [callerLoginError, setCallerLoginError] = useState<string | null>(null);
  const [callerLoginLoading, setCallerLoginLoading] = useState(false);

  // Assigned leads for caller
  const [assignedLeads, setAssignedLeads] = useState<AssignedLeadItem[]>([]);
  const [isLoadingAssignedLeads, setIsLoadingAssignedLeads] = useState(false);
  const [allAssignedLeads, setAllAssignedLeads] = useState<AssignedLeadItem[]>([]);
  const [allAssignedCounts, setAllAssignedCounts] = useState<Record<string, number>>({});
  const [dashboardTab, setDashboardTab] = useState<'my-leads' | 'quick-sheet' | 'team-distribution' | 'all-queue'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('caller_session');
      if (stored) return 'my-leads';
    }
    return 'all-queue';
  });
  const [sheetCallerFilter, setSheetCallerFilter] = useState<string>('all');
  const [sheetStatusFilter, setSheetStatusFilter] = useState<'all' | 'interested' | 'not_interested' | 'waiting' | 'pending'>('all');
  const [sheetSearch, setSheetSearch] = useState('');
  const [copiedPhoneId, setCopiedPhoneId] = useState<number | null>(null);
  const [teamCallerFilter, setTeamCallerFilter] = useState<string>('all');

  // Dynamic active caller list derived from current session and assigned leads (no hardcoded credentials)
  const activeCallerList = React.useMemo(() => {
    const map = new Map<string, { key: string; name: string }>();
    if (currentCaller?.callerKey) {
      map.set(currentCaller.callerKey, { key: currentCaller.callerKey, name: currentCaller.name });
    }
    allAssignedLeads.forEach(lead => {
      if (lead.callerKey && !map.has(lead.callerKey)) {
        map.set(lead.callerKey, { key: lead.callerKey, name: lead.callerName || lead.callerKey });
      }
    });
    return Array.from(map.values());
  }, [allAssignedLeads, currentCaller]);
  const [leadStatusFilter, setLeadStatusFilter] = useState<string>('all');
  const [isDistributingNow, setIsDistributingNow] = useState(false);
  const [distributionMsg, setDistributionMsg] = useState<string | null>(null);
  const [statusUpdateMsg, setStatusUpdateMsg] = useState<{ id: number; msg: string } | null>(null);

  // Quick Direct Caller Passcode Entry State
  const [inlineCodeInput, setInlineCodeInput] = useState('');
  const [inlineCodeLoading, setInlineCodeLoading] = useState(false);
  const [inlineCodeError, setInlineCodeError] = useState<string | null>(null);
  const [callerLoginSuccessToast, setCallerLoginSuccessToast] = useState<string | null>(null);

  const loadCallerLeads = async (callerKey?: string) => {
    const key = callerKey || currentCaller?.callerKey;
    if (!key) return;
    try {
      setIsLoadingAssignedLeads(true);
      const res = await fetch(`/api/leads/my-queue?callerKey=${encodeURIComponent(key)}`);
      if (res.ok) {
        const data = await res.json();
        setAssignedLeads(data.leads || []);
      }
    } catch (err) {
      console.warn('Failed to load caller leads:', err);
    } finally {
      setIsLoadingAssignedLeads(false);
    }
  };

  const loadAllAssignedLeads = async () => {
    try {
      const res = await fetch('/api/leads/all-assigned');
      if (res.ok) {
        const data = await res.json();
        if (data.counts) {
          setAllAssignedCounts(data.counts);
        }
        const flattened: AssignedLeadItem[] = [];
        if (data.grouped) {
          Object.values(data.grouped).forEach((group: any) => {
            if (Array.isArray(group)) flattened.push(...group);
          });
        }
        setAllAssignedLeads(flattened);
      }
    } catch (err) {
      console.warn('Failed to load all assigned leads:', err);
    }
  };

  useEffect(() => {
    // Dedicated caller routing: Callers only see their assigned leads and spreadsheet at /caller
    const stored = localStorage.getItem('caller_session');
    if (stored && !user) {
      navigate('/caller', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (currentCaller) {
      loadCallerLeads(currentCaller.callerKey);
      if (!callerName) {
        setCallerName(currentCaller.name);
      }
    }
    loadAllAssignedLeads();
  }, [currentCaller?.callerKey]);

  // Fast direct verification by secret code alone
  const handleVerifyDirectCode = async (rawCode?: string) => {
    const codeToTest = (rawCode || inlineCodeInput).trim();
    if (!codeToTest) {
      setInlineCodeError('Please enter your secret caller code.');
      return;
    }
    setInlineCodeLoading(true);
    setInlineCodeError(null);
    try {
      const res = await fetch('/api/caller/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: codeToTest,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = null;
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => null);
      } else {
        const text = await res.text().catch(() => '');
        throw new Error(res.status === 404 ? 'API service unreachable.' : `Server response (${res.status}): ${text.slice(0, 100)}`);
      }

      if (!res.ok || !data?.caller) {
        throw new Error(data?.error || 'Invalid caller passcode. Please verify your assigned access code.');
      }

      const callerData = data.caller;
      const token = data.token || '';

      const session: CallerSession = {
        callerKey: callerData.callerKey,
        name: callerData.name,
        email: callerData.email || '',
        token: token,
      };

      localStorage.setItem('caller_session', JSON.stringify(session));
      if (token) {
        localStorage.setItem('caller_token', token);
      }

      setCurrentCaller(session);
      setCallerName(session.name);
      setDashboardTab('quick-sheet');
      setCallerLoginSuccessToast(`Passcode Verified! Welcome, ${session.name}. Loaded your assigned leads in the Call Spreadsheet.`);
      setTimeout(() => setCallerLoginSuccessToast(null), 5000);

      await loadCallerLeads(session.callerKey);
      await loadAllAssignedLeads();
      setInlineCodeInput('');
      setShowCallerModal(false);
    } catch (err: any) {
      setInlineCodeError(err.message || 'Verification failed. Please check your assigned code.');
    } finally {
      setInlineCodeLoading(false);
    }
  };

  const handleCallerLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = callerCodeInput.trim();
    if (!code) {
      setCallerLoginError('Please enter your assigned access code.');
      return;
    }
    setCallerLoginLoading(true);
    setCallerLoginError(null);
    try {
      const res = await fetch('/api/caller/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: callerNameInput.trim() || undefined,
          email: callerEmailInput.trim() || undefined,
          code: code,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      let data: any = null;
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => null);
      } else {
        const text = await res.text().catch(() => '');
        throw new Error(res.status === 404 ? 'API service unreachable.' : `Server response (${res.status}): ${text.slice(0, 100)}`);
      }

      if (!res.ok || !data?.caller) {
        throw new Error(data?.error || 'Invalid caller passcode. Please verify your assigned code.');
      }

      const callerData = data.caller;
      const token = data.token || '';

      const session: CallerSession = {
        callerKey: callerData.callerKey,
        name: callerData.name,
        email: callerData.email || callerEmailInput.trim(),
        token: token,
      };
      localStorage.setItem('caller_session', JSON.stringify(session));
      if (token) {
        localStorage.setItem('caller_token', token);
      }
      setCurrentCaller(session);
      setCallerName(session.name);
      setShowCallerModal(false);
      setDashboardTab('my-leads');
      await loadCallerLeads(session.callerKey);
      await loadAllAssignedLeads();
    } catch (err: any) {
      setCallerLoginError(err.message || 'Login failed. Please verify your assigned code.');
    } finally {
      setCallerLoginLoading(false);
    }
  };

  const handleCallerLogout = () => {
    localStorage.removeItem('caller_session');
    setCurrentCaller(null);
    setAssignedLeads([]);
    setDashboardTab('all-queue');
  };

  const handleUpdateLeadStatus = async (leadId: number, newStatus: string, notes?: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, notes }),
      });
      if (res.ok) {
        setAssignedLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus, ...(notes !== undefined ? { notes } : {}) } : l));
        setAllAssignedLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus, ...(notes !== undefined ? { notes } : {}) } : l));
        setStatusUpdateMsg({ id: leadId, msg: 'Saved' });
        setTimeout(() => setStatusUpdateMsg(null), 2000);
      }
    } catch (e) {
      console.warn('Failed to update lead status:', e);
    }
  };

  const handleSelectAssignedLead = (lead: AssignedLeadItem) => {
    setDomain(lead.domain);
    setPhone(lead.phone || '');
    const cleanName = lead.companyName || lead.domain.split('.')[0].replace(/[-_]/g, ' ');
    const formatted = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    setCompanyName(formatted);
    setCallerName(currentCaller ? currentCaller.name : lead.callerName || '');
    const auditObj = safeJsonParse(lead.resultData) || { domain: lead.domain, score: lead.score, grade: lead.grade };
    setAuditInfo(auditObj);
    setCurrentScript(null);
    setViewMode('script');
    generateScript(lead.domain, auditObj);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDistributeLeadsInOutreach = async () => {
    if (queue.length === 0) {
      alert("No bulk audited domains found in queue. Please run a bulk audit first.");
      return;
    }
    try {
      setIsDistributingNow(true);
      setDistributionMsg(null);
      const res = await fetch('/api/leads/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads: queue.map(q => ({
            domain: q.domain,
            phone: q.phone,
            companyName: q.companyName || q.domain.split('.')[0].toUpperCase(),
            grade: q.grade,
            score: q.score,
            resultData: q.resultData,
          })),
          leadsPerCaller: 25,
          assignerEmail: user?.email || 'admin@company.com',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to distribute leads.');
      }
      const data = await res.json();
      setDistributionMsg(
        `Successfully split ${data.totalDistributed} leads equally across callers without duplicates (25 unique leads each).`
      );
      if (currentCaller) {
        await loadCallerLeads(currentCaller.callerKey);
      }
      await loadAllAssignedLeads();
    } catch (err: any) {
      alert(err.message || 'Error distributing leads.');
    } finally {
      setIsDistributingNow(false);
    }
  };

  // Source leads for Spreadsheet View
  const sheetLeadsSource: AssignedLeadItem[] = React.useMemo(() => {
    if (allAssignedLeads.length > 0) {
      if (sheetCallerFilter === 'my' && currentCaller) {
        return assignedLeads;
      }
      if (sheetCallerFilter === 'all') {
        return allAssignedLeads;
      }
      return allAssignedLeads.filter(l => l.callerKey === sheetCallerFilter);
    }
    // Fallback: if no leads distributed to DB yet, adapt from queue so callers can still preview
    return queue.map((q, idx) => ({
      id: -(idx + 1),
      callerKey: 'unassigned',
      callerName: 'Unassigned',
      domain: q.domain,
      phone: q.phone,
      companyName: q.companyName,
      grade: q.grade,
      score: q.score,
      status: 'pending',
      notes: null,
      resultData: q.resultData,
      assignedBy: user?.email || 'admin@company.com',
      assignedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  }, [allAssignedLeads, assignedLeads, sheetCallerFilter, currentCaller, queue]);

  const filteredSheetLeads = React.useMemo(() => {
    return sheetLeadsSource.filter(lead => {
      // Status filter
      if (sheetStatusFilter === 'interested' && !(lead.status === 'interested' || lead.status === 'meeting_booked')) {
        return false;
      }
      if (sheetStatusFilter === 'not_interested' && !(lead.status === 'not_interested' || lead.status === 'disqualified')) {
        return false;
      }
      if (sheetStatusFilter === 'waiting' && !(lead.status === 'waiting' || lead.status === 'voicemail' || lead.status === 'gatekeeper')) {
        return false;
      }
      if (sheetStatusFilter === 'pending' && !(lead.status === 'pending' || !lead.status)) {
        return false;
      }

      // Search filter
      if (sheetSearch.trim()) {
        const q = sheetSearch.toLowerCase().trim();
        const matchesDomain = lead.domain.toLowerCase().includes(q);
        const matchesPhone = lead.phone ? lead.phone.toLowerCase().includes(q) : false;
        const matchesName = lead.companyName ? lead.companyName.toLowerCase().includes(q) : false;
        if (!matchesDomain && !matchesPhone && !matchesName) return false;
      }

      return true;
    });
  }, [sheetLeadsSource, sheetStatusFilter, sheetSearch]);

  const exportSpreadsheetCsv = () => {
    if (filteredSheetLeads.length === 0) {
      alert("No leads in current view to export.");
      return;
    }
    const headers = ["#", "Domain", "Phone", "Assigned Caller", "Status", "Grade", "Score", "Notes"];
    const rows = filteredSheetLeads.map((l, idx) => {
      let friendlyStatus = 'Pending';
      if (l.status === 'interested' || l.status === 'meeting_booked') friendlyStatus = 'Interested (Tick)';
      else if (l.status === 'not_interested' || l.status === 'disqualified') friendlyStatus = 'Not Interested (X)';
      else if (l.status === 'waiting' || l.status === 'voicemail' || l.status === 'gatekeeper') friendlyStatus = 'Waiting';
      else if (l.status) friendlyStatus = l.status;

      return [
        idx + 1,
        l.domain,
        l.phone || '',
        l.callerName || '',
        friendlyStatus,
        l.grade || '',
        l.score ?? '',
        l.notes || '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `caller_outreach_spreadsheet_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Auto-populate queue from user's history if queue is empty
  useEffect(() => {
    if (queue.length === 0 && user) {
      const loadHistoryQueue = async () => {
        try {
          const token = await getToken();
          if (!token || token === 'null' || token === 'undefined') return;
          const res = await fetch('/api/audits', {
            headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
          });
          const ct = res.headers.get('content-type') || '';
          if (res.ok && ct.includes('application/json')) {
            const data = await res.json();
            if (data.audits && Array.isArray(data.audits) && data.audits.length > 0) {
              const formatted: QueueProspect[] = data.audits.map((a: any) => ({
                domain: a.domain,
                companyName: a.domain.split('.')[0].replace(/[-_]/g, ' '),
                score: a.score,
                grade: a.grade,
                resultData: safeJsonParse(a.resultData),
              }));
              setQueue(formatted);
            }
          }
        } catch {}
      };
      loadHistoryQueue();
    }
  }, [user, queue.length]);

  // Load saved scripts from backend
  const loadSavedScripts = async () => {
    if (!user) return;
    try {
      setIsLoadingSaved(true);
      const token = await getToken();
      if (!token || token === 'null' || token === 'undefined') return;

      const res = await fetch('/api/outreach', {
        headers: { 
          Accept: 'application/json',
          Authorization: `Bearer ${token}` 
        },
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setSavedScripts(data.scripts || []);
      }
    } catch (err) {
      console.warn('Failed to load saved outreach scripts:', err);
    } finally {
      setIsLoadingSaved(false);
    }
  };

  useEffect(() => {
    loadSavedScripts();
  }, [user]);

  // If initial domain exists and we have audit data, or if user navigated from Dashboard/Bulk
  useEffect(() => {
    if (initialDomain && !currentScript && !isGenerating) {
      setDomain(initialDomain);
      if (!companyName) {
        const cleanName = initialDomain.split('.')[0].replace(/[-_]/g, ' ');
        setCompanyName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
      }
      // If auditData was passed in location.state, automatically trigger generation
      if (location.state?.auditData) {
        setAuditInfo(location.state.auditData);
        generateScript(initialDomain, location.state.auditData);
      }
    }
  }, [initialDomain]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const generateScript = async (targetDomain?: string, customAuditData?: any) => {
    const domainToAudit = (targetDomain || domain).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!domainToAudit) {
      setErrorMessage('Please enter a valid domain name.');
      return;
    }

    setErrorMessage(null);
    setIsGenerating(true);

    try {
      let auditPayload = customAuditData || auditInfo;

      // If we don't have audit details yet, perform a quick domain audit first
      if (!auditPayload) {
        try {
          const auditRes = await fetch('/api/check-domain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain: domainToAudit, selector: 'default', skipAi: true }),
          });
          if (auditRes.ok) {
            auditPayload = await auditRes.json();
            setAuditInfo(auditPayload);
          }
        } catch (e) {
          console.warn('Fast audit check before outreach generation had an error:', e);
        }
      }

      const res = await fetch('/api/outreach/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          domain: domainToAudit,
          companyName: companyName.trim() || undefined,
          officeManagerName: officeManagerName.trim() || undefined,
          callerName: callerName.trim() || undefined,
          callStyle,
          auditData: auditPayload || undefined,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Server returned unexpected format. Please retry.');
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate outreach battlecard.');
      }

      if (data.script) {
        setCurrentScript(data.script);
        setActiveTab('frontDesk');
      } else {
        throw new Error('Received invalid script structure from server.');
      }
    } catch (err: any) {
      console.error('Outreach generation error:', err);
      setErrorMessage(err.message || 'Error communicating with Groq outreach generator.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveCurrentScript = async () => {
    if (!currentScript || !user) return;
    try {
      setIsSaving(true);
      const token = await getToken();
      if (!token || token === 'null' || token === 'undefined') return;

      const res = await fetch('/api/outreach/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          domain: currentScript.domain,
          companyName: currentScript.companyName,
          grade: auditInfo?.grade || undefined,
          score: auditInfo?.score !== undefined ? auditInfo.score : undefined,
          scriptData: JSON.stringify(currentScript),
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        loadSavedScripts();
        alert('Phone battlecard saved to your account!');
      }
    } catch (err) {
      console.error('Save script error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSavedScript = async (id: number) => {
    if (!confirm('Are you sure you want to delete this saved script?')) return;
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`/api/outreach/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSavedScripts(prev => prev.filter(s => s.id !== id));
      }
    } catch (err) {
      console.error('Delete script error:', err);
    }
  };

  const handleLoadSavedRecord = (record: SavedOutreachRecord) => {
    try {
      const parsed = JSON.parse(record.scriptData);
      setCurrentScript(parsed);
      setDomain(record.domain);
      if (record.companyName) setCompanyName(record.companyName);
      if (record.score !== null && record.score !== undefined) {
        setAuditInfo({ score: record.score, grade: record.grade, domain: record.domain });
      }
      setActiveTab('frontDesk');
      window.scrollTo({ top: 300, behavior: 'smooth' });
    } catch (e) {
      console.error('Error parsing saved script:', e);
    }
  };

  // Compile entire battlecard as plain text for full copy
  const getFullBattlecardText = () => {
    if (!currentScript) return '';
    return `=== COLD CALL BATTLECARD: ${currentScript.companyName.toUpperCase()} (${currentScript.domain}) ===
AUDIT SUMMARY (PLAIN ENGLISH):
${currentScript.auditSummaryPlainEnglish}

--- PART 1: FRONT DESK / GATEKEEPER SCRIPT ---
Target: ${currentScript.frontDeskScript.targetRole}
Goal: ${currentScript.frontDeskScript.goal}

OPENER:
"${currentScript.frontDeskScript.opener}"

REASON FOR CALLING:
"${currentScript.frontDeskScript.reasonForCalling}"

TRANSFER ASK:
"${currentScript.frontDeskScript.transferAsk}"

GATEKEEPER REBUTTALS:
${currentScript.frontDeskScript.objections.map(o => `* "${o.pushback}"\n  -> Rep: "${o.rebuttal}"`).join('\n\n')}

--- PART 2: OWNER / OFFICE MANAGER SCRIPT ---
Target: ${currentScript.ownerScript.targetRole}
Goal: ${currentScript.ownerScript.goal}

30-SECOND OPENER:
"${currentScript.ownerScript.opener30Sec}"

PLAIN-ENGLISH FINDINGS & ANALOGIES:
${currentScript.ownerScript.plainEnglishBreakdown.map(f => `* ${f.technicalIssue.toUpperCase()}:\n  - Analogy: ${f.plainEnglishAnalogy}\n  - Business Risk: ${f.businessImpact}`).join('\n\n')}

DIAGNOSTIC QUESTIONS:
${currentScript.ownerScript.diagnosticQuestions.map((q, i) => `${i + 1}. "${q}"`).join('\n')}

CLOSING ASK:
"${currentScript.ownerScript.closingCta}"

DECISION MAKER REBUTTALS:
${currentScript.ownerScript.objections.map(o => `* "${o.pushback}"\n  -> Rep: "${o.rebuttal}"`).join('\n\n')}

--- PART 3: VOICEMAIL SCRIPT (20s) ---
"${currentScript.voicemailScript.script}"
`;
  };

  // Stats and filtering
  const coldCallTargets = queue.filter(q => q.grade?.startsWith('D') || q.grade?.startsWith('F'));
  const warningTargets = queue.filter(q => q.grade?.startsWith('C'));
  const healthyTargets = queue.filter(q => q.grade?.startsWith('A') || q.grade?.startsWith('B'));

  const filteredQueue = queue.filter(item => {
    const query = dashboardSearch.trim().toLowerCase();
    const matchesSearch = !query || 
      item.domain.toLowerCase().includes(query) ||
      (item.companyName && item.companyName.toLowerCase().includes(query));
    if (!matchesSearch) return false;

    if (dashboardFilter === 'targets') {
      return item.grade?.startsWith('D') || item.grade?.startsWith('F');
    }
    if (dashboardFilter === 'warnings') {
      return item.grade?.startsWith('C');
    }
    if (dashboardFilter === 'healthy') {
      return item.grade?.startsWith('A') || item.grade?.startsWith('B');
    }
    return true;
  });

  const handleSelectProspect = (prospect: QueueProspect, index: number) => {
    setSelectedQueueIndex(index);
    setDomain(prospect.domain);
    setPhone(prospect.phone || '');
    const cleanName = prospect.companyName || prospect.domain.split('.')[0].replace(/[-_]/g, ' ');
    const formatted = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    setCompanyName(formatted);
    const auditObj = prospect.resultData || { domain: prospect.domain, score: prospect.score, grade: prospect.grade };
    setAuditInfo(auditObj);
    setCurrentScript(null);
    setViewMode('script');
    generateScript(prospect.domain, auditObj);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevProspect = () => {
    if (selectedQueueIndex > 0) {
      const prevIdx = selectedQueueIndex - 1;
      const prevItem = queue[prevIdx];
      handleSelectProspect(prevItem, prevIdx);
    }
  };

  const handleNextProspect = () => {
    if (selectedQueueIndex < queue.length - 1) {
      const nextIdx = selectedQueueIndex + 1;
      const nextItem = queue[nextIdx];
      handleSelectProspect(nextItem, nextIdx);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-16">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-50 text-indigo-700 rounded-sm border border-indigo-200">
                <PhoneCall className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">Phone Outreach Playbook</h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-sm bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Groq LPU
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1 max-w-3xl">
              Turn complex technical email deliverability audits into high-converting telephone scripts. 
              Designed specifically with a two-tier phone workflow: <strong>navigate past the front desk</strong> and <strong>explain the crisis in plain English to the owner or office manager</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {queue.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setViewMode('dashboard');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`px-3.5 py-2 text-xs font-bold rounded-sm transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                  viewMode === 'dashboard'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Outreach Dashboard ({queue.length})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setViewMode('script');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`px-3.5 py-2 text-xs font-bold rounded-sm transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                viewMode === 'script'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'
              }`}
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>{domain ? `Phone Script: ${domain}` : 'Phone Script'}</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/bulk')}
              className="px-3.5 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-sm transition-colors cursor-pointer"
            >
              Bulk Audit (200)
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-3.5 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-sm transition-colors cursor-pointer"
            >
              Single Audit
            </button>
          </div>
        </div>

        {/* SUCCESS TOAST FOR CALLER LOGIN */}
        {callerLoginSuccessToast && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 rounded-sm text-xs font-semibold text-emerald-900 flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{callerLoginSuccessToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setCallerLoginSuccessToast(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* ROLE-BASED CALLER STATUS & AUTHENTICATION BAR */}
        {currentCaller ? (
          <div className="mb-6 bg-white border border-emerald-200 rounded-sm p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start md:items-center gap-3">
              <div className="p-2.5 rounded-sm shrink-0 bg-emerald-50 border border-emerald-200 text-emerald-700">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-xs border border-emerald-200">
                    Caller Authenticated
                  </span>
                  <h3 className="text-sm font-bold text-gray-900">
                    {currentCaller.name} <span className="font-mono text-gray-500 font-normal">({currentCaller.fixedCode})</span>
                  </h3>
                  <span className="text-xs font-bold px-2 py-0.5 bg-gray-100 rounded-xs text-indigo-900 border border-gray-200">
                    {assignedLeads.length} Assigned Leads (Zero Duplicates)
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Logged in with persistent code <strong>{currentCaller.fixedCode}</strong>. You only see your exclusive 25 leads to prevent duplicate calling.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setViewMode('dashboard');
                  setDashboardTab('quick-sheet');
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-xs cursor-pointer shadow-2xs transition-colors flex items-center gap-1.5 ${
                  viewMode === 'dashboard' && dashboardTab === 'quick-sheet'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Call Spreadsheet ({assignedLeads.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('dashboard');
                  setDashboardTab('my-leads');
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-xs cursor-pointer shadow-2xs transition-colors flex items-center gap-1.5 ${
                  viewMode === 'dashboard' && dashboardTab === 'my-leads'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>My Leads List</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate('/caller-access');
                }}
                className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xs transition-colors cursor-pointer"
                title="Enter a different caller passcode"
              >
                Switch Code
              </button>
              <button
                type="button"
                onClick={handleCallerLogout}
                className="px-3 py-1.5 text-gray-500 hover:text-red-600 text-xs font-medium cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          /* SECURE CALLER ACCESS BAR */
          <div className="mb-6 bg-white border border-gray-200 rounded-sm p-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xs shrink-0">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    Outreach Caller Access
                  </h3>
                  <p className="text-xs text-gray-500">
                    Enter your assigned access passcode to unlock your 25 leads.
                  </p>
                </div>
              </div>

              {/* Secure Passcode Entry Form */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleVerifyDirectCode();
                }} 
                className="flex items-center gap-2"
              >
                <input
                  type="password"
                  value={inlineCodeInput}
                  onChange={(e) => setInlineCodeInput(e.target.value)}
                  placeholder="Enter caller passcode"
                  className="w-48 sm:w-56 px-3 py-1.5 text-xs font-mono bg-white border border-gray-300 rounded-xs text-gray-900 focus:outline-none focus:border-indigo-600"
                />
                <button
                  type="submit"
                  disabled={inlineCodeLoading || !inlineCodeInput.trim()}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white text-xs font-bold rounded-xs cursor-pointer shadow-2xs transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  {inlineCodeLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Unlock Leads</span>
                  )}
                </button>
                <Link
                  to="/caller-access"
                  className="text-xs font-semibold text-indigo-700 hover:underline px-2 py-1.5 whitespace-nowrap"
                >
                  Portal Login →
                </Link>
              </form>
            </div>

            {inlineCodeError && (
              <div className="mt-2.5 p-2 bg-red-50 border border-red-200 rounded-xs text-xs text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <span>{inlineCodeError}</span>
              </div>
            )}
          </div>
        )}

        {/* VIEW MODE 1: CAMPAIGN DASHBOARD */}
        {viewMode === 'dashboard' ? (
          <div className="space-y-6 mb-12">
            {/* Top Navigation Tabs for Dashboard */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-sm">
                <button
                  type="button"
                  onClick={() => setDashboardTab('my-leads')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xs cursor-pointer transition-all flex items-center gap-1.5 ${
                    dashboardTab === 'my-leads'
                      ? 'bg-white text-emerald-800 shadow-xs border border-emerald-200 font-black'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>My Assigned Leads ({currentCaller ? assignedLeads.length : 'Sign In'})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDashboardTab('quick-sheet')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xs cursor-pointer transition-all flex items-center gap-1.5 ${
                    dashboardTab === 'quick-sheet'
                      ? 'bg-emerald-600 text-white shadow-xs font-black'
                      : 'text-gray-700 hover:text-gray-900'
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>Call Spreadsheet (Tick / X / Waiting)</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                    dashboardTab === 'quick-sheet' ? 'bg-emerald-800 text-white' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {allAssignedLeads.length > 0 ? allAssignedLeads.length : queue.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setDashboardTab('team-distribution')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xs cursor-pointer transition-all flex items-center gap-1.5 ${
                    dashboardTab === 'team-distribution'
                      ? 'bg-white text-indigo-800 shadow-xs border border-indigo-200 font-black'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>4-Caller Team Distribution ({allAssignedLeads.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDashboardTab('all-queue')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xs cursor-pointer transition-all flex items-center gap-1.5 ${
                    dashboardTab === 'all-queue'
                      ? 'bg-white text-gray-900 shadow-xs border border-gray-200 font-black'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>All Audited Domains ({queue.length})</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {distributionMsg && (
                  <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xs border border-emerald-200 font-medium">
                    {distributionMsg}
                  </span>
                )}
                {queue.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDistributeLeadsInOutreach}
                    disabled={isDistributingNow}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Evenly split 25 leads each to team callers without duplicates"
                  >
                    {isDistributingNow ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                    <span>Assign 25 Leads to Callers</span>
                  </button>
                )}
              </div>
            </div>

            {/* TAB CONTENT 1: MY ASSIGNED LEADS */}
            {dashboardTab === 'my-leads' && (
              <div className="space-y-4">
                {!currentCaller ? (
                  <div className="bg-white border border-gray-200 p-8 rounded-sm shadow-xs text-center space-y-4">
                    <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-full w-fit mx-auto text-indigo-700">
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="max-w-md mx-auto">
                      <h3 className="text-base font-bold text-gray-900">Caller Login Required</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        To view your assigned 25 leads partition without duplicates, please sign in with your Name, Email, and assigned passcode.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCallerModal(true)}
                      className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-xs cursor-pointer shadow-xs inline-flex items-center gap-2"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Sign In as Caller</span>
                    </button>
                  </div>
                ) : assignedLeads.length === 0 ? (
                  <div className="bg-white border border-gray-200 p-8 rounded-sm shadow-xs text-center space-y-4">
                    <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                    <div className="max-w-md mx-auto">
                      <h3 className="text-base font-bold text-gray-900">No Leads Currently Assigned to {currentCaller.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Run a bulk audit on up to 200 domains, then click <strong>"Split 25 Leads to 4 Callers"</strong> to automatically populate {currentCaller.name}'s exclusive queue.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      {queue.length > 0 && (
                        <button
                          type="button"
                          onClick={handleDistributeLeadsInOutreach}
                          disabled={isDistributingNow}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xs cursor-pointer shadow-xs inline-flex items-center gap-2"
                        >
                          <Users className="w-4 h-4" />
                          <span>Distribute {queue.length} Queue Leads Now</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => navigate('/bulk')}
                        className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-xs cursor-pointer shadow-xs"
                      >
                        Go to Bulk Audit (200)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Header stats & filters for Caller */}
                    <div className="bg-white p-4.5 rounded-sm border border-gray-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-gray-900">
                            {currentCaller.name}'s Assigned Leads Queue
                          </h3>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-xs bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {assignedLeads.length} Leads Total
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Strict role-based assignment: these leads belong solely to you. No other caller will contact them.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-gray-500">Filter Status:</span>
                        <select
                          value={leadStatusFilter}
                          onChange={e => setLeadStatusFilter(e.target.value)}
                          className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-xs bg-white text-gray-800 font-medium focus:ring-1 focus:ring-gray-900"
                        >
                          <option value="all">All Statuses ({assignedLeads.length})</option>
                          <option value="pending">⏳ Pending Call ({assignedLeads.filter(l => l.status === 'pending').length})</option>
                          <option value="voicemail">📞 Voicemail Left ({assignedLeads.filter(l => l.status === 'voicemail').length})</option>
                          <option value="gatekeeper">🛡️ Gatekeeper ({assignedLeads.filter(l => l.status === 'gatekeeper').length})</option>
                          <option value="owner_call">🗣️ Spoke with Owner ({assignedLeads.filter(l => l.status === 'owner_call').length})</option>
                          <option value="meeting_booked">🏆 Meeting Booked ({assignedLeads.filter(l => l.status === 'meeting_booked').length})</option>
                          <option value="disqualified">❌ Disqualified ({assignedLeads.filter(l => l.status === 'disqualified').length})</option>
                        </select>
                      </div>
                    </div>

                    {/* Assigned Leads Table */}
                    <div className="bg-white border border-gray-200 rounded-sm shadow-xs overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                            <th className="py-3 px-3.5 w-12">#</th>
                            <th className="py-3 px-3.5">Prospect & Domain</th>
                            <th className="py-3 px-3.5">Deliverability Grade</th>
                            <th className="py-3 px-3.5">Call Outcome Status</th>
                            <th className="py-3 px-3.5 min-w-[200px]">Notes & Objections</th>
                            <th className="py-3 px-3.5 text-right">Phone Playbook</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-xs">
                          {assignedLeads
                            .filter(lead => leadStatusFilter === 'all' || lead.status === leadStatusFilter)
                            .map((lead, idx) => {
                              const isFailing = lead.grade?.startsWith('D') || lead.grade?.startsWith('F');
                              return (
                                <tr key={lead.id} className="hover:bg-gray-50/80 transition-colors">
                                  <td className="py-3 px-3.5 font-mono text-gray-400 select-none">
                                    {String(idx + 1).padStart(2, '0')}
                                  </td>
                                  <td className="py-3 px-3.5">
                                    <span className="font-mono font-bold text-gray-900 block truncate max-w-[220px]">
                                      {lead.domain}
                                    </span>
                                    {lead.phone ? (
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <a
                                          href={`tel:${lead.phone.replace(/[^+\d]/g, '')}`}
                                          className="text-[11px] text-emerald-700 font-mono font-bold hover:underline inline-flex items-center gap-1"
                                          title="Click to dial"
                                        >
                                          <PhoneCall className="w-3 h-3 text-emerald-600" />
                                          <span>{lead.phone}</span>
                                        </a>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(lead.phone || '');
                                            setCopiedPhoneId(lead.id);
                                            setTimeout(() => setCopiedPhoneId(null), 1500);
                                          }}
                                          className="p-0.5 text-gray-400 hover:text-gray-700 cursor-pointer"
                                          title="Copy phone"
                                        >
                                          {copiedPhoneId === lead.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-gray-400 font-mono italic">No phone attached</span>
                                    )}
                                    <span className="text-[11px] text-gray-500 capitalize block">
                                      {lead.companyName || lead.domain.split('.')[0]}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3.5">
                                    <div className="flex items-center gap-1.5">
                                      {lead.grade ? (
                                        <span className={`px-2 py-0.5 rounded-2xs text-[11px] font-bold ${
                                          lead.grade.startsWith('A') ? 'bg-green-100 text-green-800' :
                                          lead.grade.startsWith('B') ? 'bg-blue-100 text-blue-800' :
                                          lead.grade.startsWith('C') ? 'bg-yellow-100 text-yellow-800' :
                                          'bg-red-100 text-red-800 border border-red-200'
                                        }`}>
                                          Grade {lead.grade} ({lead.score ?? 0})
                                        </span>
                                      ) : (
                                        <span className="text-gray-400">Audited</span>
                                      )}
                                      {isFailing && (
                                        <span className="text-[10px] text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded-2xs border border-red-100">
                                          Priority Target
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3.5 space-y-1.5">
                                    {/* 1-Click Fast Outcome Toggles */}
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateLeadStatus(lead.id, lead.status === 'interested' || lead.status === 'meeting_booked' ? 'pending' : 'interested', lead.notes || '')}
                                        title="Tick (Interested / Booked)"
                                        className={`px-2 py-0.5 rounded-2xs text-[11px] font-bold flex items-center gap-1 cursor-pointer border transition-colors ${
                                          lead.status === 'interested' || lead.status === 'meeting_booked'
                                            ? 'bg-emerald-600 border-emerald-700 text-white shadow-2xs font-black'
                                            : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                                        }`}
                                      >
                                        <Check className="w-3 h-3 stroke-[3]" />
                                        <span>Tick</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleUpdateLeadStatus(lead.id, lead.status === 'not_interested' || lead.status === 'disqualified' ? 'pending' : 'not_interested', lead.notes || '')}
                                        title="X (Not Interested)"
                                        className={`px-2 py-0.5 rounded-2xs text-[11px] font-bold flex items-center gap-1 cursor-pointer border transition-colors ${
                                          lead.status === 'not_interested' || lead.status === 'disqualified'
                                            ? 'bg-rose-600 border-rose-700 text-white shadow-2xs font-black'
                                            : 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100'
                                        }`}
                                      >
                                        <X className="w-3 h-3 stroke-[3]" />
                                        <span>X</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleUpdateLeadStatus(lead.id, lead.status === 'waiting' || lead.status === 'voicemail' || lead.status === 'gatekeeper' ? 'pending' : 'waiting', lead.notes || '')}
                                        title="Waiting (Follow up / Callback)"
                                        className={`px-2 py-0.5 rounded-2xs text-[11px] font-bold flex items-center gap-1 cursor-pointer border transition-colors ${
                                          lead.status === 'waiting' || lead.status === 'voicemail' || lead.status === 'gatekeeper'
                                            ? 'bg-amber-500 border-amber-600 text-white shadow-2xs font-black'
                                            : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                                        }`}
                                      >
                                        <Clock className="w-3 h-3" />
                                        <span>Waiting</span>
                                      </button>
                                    </div>

                                    <select
                                      value={lead.status}
                                      onChange={e => handleUpdateLeadStatus(lead.id, e.target.value, lead.notes || '')}
                                      className={`text-xs px-2 py-1 rounded-xs border font-medium cursor-pointer w-full ${
                                        lead.status === 'meeting_booked' || lead.status === 'interested' ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold' :
                                        lead.status === 'owner_call' ? 'bg-blue-50 text-blue-800 border-blue-300 font-bold' :
                                        lead.status === 'waiting' || lead.status === 'voicemail' ? 'bg-yellow-50 text-yellow-800 border-yellow-300 font-bold' :
                                        lead.status === 'gatekeeper' ? 'bg-amber-50 text-amber-800 border-amber-300' :
                                        lead.status === 'disqualified' || lead.status === 'not_interested' ? 'bg-gray-100 text-gray-500 border-gray-300' :
                                        'bg-white text-gray-700 border-gray-300'
                                      }`}
                                    >
                                      <option value="pending">⏳ Pending (Not Called)</option>
                                      <option value="interested">✓ Tick: Interested</option>
                                      <option value="not_interested">✗ X: Not Interested</option>
                                      <option value="waiting">⏳ Waiting / Callback</option>
                                      <option value="meeting_booked">🏆 Meeting Booked / Won</option>
                                      <option value="voicemail">📞 Voicemail Left</option>
                                      <option value="gatekeeper">🛡️ Gatekeeper Pushback</option>
                                      <option value="owner_call">🗣️ Decision Maker In Discussion</option>
                                      <option value="disqualified">❌ Disqualified</option>
                                    </select>
                                  </td>
                                  <td className="py-3 px-3.5">
                                    <input
                                      type="text"
                                      defaultValue={lead.notes || ''}
                                      onBlur={e => handleUpdateLeadStatus(lead.id, lead.status, e.target.value)}
                                      placeholder="Notes e.g. Gatekeeper: Sarah, Call back 2pm..."
                                      className="w-full text-xs px-2 py-1 border border-gray-200 rounded-xs focus:ring-1 focus:ring-gray-900 bg-gray-50/50 hover:bg-white focus:bg-white"
                                    />
                                    {statusUpdateMsg?.id === lead.id && (
                                      <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">
                                        ✓ Saved
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3.5 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleSelectAssignedLead(lead)}
                                      className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-xs transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                                    >
                                      <PhoneCall className="w-3 h-3" />
                                      <span>Open Phone Script →</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: QUICK CALL SPREADSHEET (TICK / X / WAITING) */}
            {dashboardTab === 'quick-sheet' && (
              <div className="space-y-4">
                {/* Spreadsheet Top Card */}
                <div className="bg-white p-5 rounded-sm border border-gray-200 shadow-xs space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <Table className="w-5 h-5 text-emerald-600" />
                          <span>Caller Outreach Spreadsheet</span>
                        </h2>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-xs bg-emerald-50 border border-emerald-200 text-emerald-800 uppercase tracking-wider">
                          1-Click Outcome Tracking
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        High-speed caller dial sheet. Review domains and phone numbers in spreadsheet view. Click <strong className="text-emerald-700">Tick (✓ Interested)</strong>, <strong className="text-rose-700">X (✗ Not Interested)</strong>, or <strong className="text-amber-700">Waiting (⏳ Waiting)</strong> to record results in real-time.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={exportSpreadsheetCsv}
                        className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title="Download CSV spreadsheet"
                      >
                        <FileText className="w-3.5 h-3.5 text-gray-500" />
                        <span>Download CSV</span>
                      </button>
                      {queue.length > 0 && allAssignedLeads.length === 0 && (
                        <button
                          type="button"
                          onClick={handleDistributeLeadsInOutreach}
                          disabled={isDistributingNow}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          title="Assign 25 leads each to the 4 callers"
                        >
                          {isDistributingNow ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                          <span>Assign 25 to 4 Callers</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Summary metric counters */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-3 border-t border-gray-100">
                    <div className="bg-gray-50 p-2.5 rounded-xs border border-gray-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Total On Sheet</span>
                      <span className="text-lg font-black text-gray-900">{filteredSheetLeads.length}</span>
                    </div>
                    <div className="bg-emerald-50 p-2.5 rounded-xs border border-emerald-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600 stroke-[3]" /> Tick (Interested)
                      </span>
                      <span className="text-lg font-black text-emerald-800">
                        {sheetLeadsSource.filter(l => l.status === 'interested' || l.status === 'meeting_booked').length}
                      </span>
                    </div>
                    <div className="bg-rose-50 p-2.5 rounded-xs border border-rose-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block flex items-center gap-1">
                        <X className="w-3 h-3 text-rose-600 stroke-[3]" /> X (Not Interested)
                      </span>
                      <span className="text-lg font-black text-rose-800">
                        {sheetLeadsSource.filter(l => l.status === 'not_interested' || l.status === 'disqualified').length}
                      </span>
                    </div>
                    <div className="bg-amber-50 p-2.5 rounded-xs border border-amber-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-600" /> Waiting / Callback
                      </span>
                      <span className="text-lg font-black text-amber-800">
                        {sheetLeadsSource.filter(l => l.status === 'waiting' || l.status === 'voicemail' || l.status === 'gatekeeper').length}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xs border border-slate-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">Pending / Uncalled</span>
                      <span className="text-lg font-black text-slate-800">
                        {sheetLeadsSource.filter(l => l.status === 'pending' || !l.status).length}
                      </span>
                    </div>
                  </div>

                  {/* Filter and Search Bar */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-sm overflow-x-auto w-full md:w-auto">
                      {currentCaller && (
                        <button
                          type="button"
                          onClick={() => setSheetCallerFilter('my')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-xs cursor-pointer ${
                            sheetCallerFilter === 'my' ? 'bg-white text-emerald-800 shadow-xs font-black' : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          My Leads ({currentCaller.name})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSheetCallerFilter('all')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xs cursor-pointer ${
                          sheetCallerFilter === 'all' ? 'bg-white text-gray-900 shadow-xs font-black' : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        All Callers ({allAssignedLeads.length})
                      </button>
                      {activeCallerList.map(c => (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() => setSheetCallerFilter(c.key as any)}
                          className={`px-2.5 py-1.5 text-xs font-bold rounded-xs cursor-pointer ${
                            sheetCallerFilter === c.key ? 'bg-white text-indigo-900 shadow-xs font-black' : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          {c.name} ({allAssignedCounts[c.key] || 0})
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <select
                        value={sheetStatusFilter}
                        onChange={e => setSheetStatusFilter(e.target.value as any)}
                        className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-xs bg-white font-medium cursor-pointer"
                      >
                        <option value="all">All Outcomes</option>
                        <option value="interested">✓ Tick (Interested)</option>
                        <option value="not_interested">✗ X (Not Interested)</option>
                        <option value="waiting">⏳ Waiting</option>
                        <option value="pending">⏳ Pending / Uncalled</option>
                      </select>

                      <div className="relative w-full md:w-56">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={sheetSearch}
                          onChange={e => setSheetSearch(e.target.value)}
                          placeholder="Filter domain or phone..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-xs bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SPREADSHEET TABLE CONTAINER */}
                <div className="bg-white border border-gray-200 rounded-sm shadow-xs overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-100/80 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-600">
                        <th className="py-3 px-3.5 w-12 text-center">#</th>
                        <th className="py-3 px-3.5 min-w-[200px]">Domain</th>
                        <th className="py-3 px-3.5 min-w-[180px]">Phone Number</th>
                        <th className="py-3 px-3.5 min-w-[120px]">Caller</th>
                        <th className="py-3 px-3.5 min-w-[260px]">1-Click Outcome (Tick / X / Waiting)</th>
                        <th className="py-3 px-3.5 min-w-[200px]">Quick Notes</th>
                        <th className="py-3 px-3.5 text-right w-28">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs">
                      {filteredSheetLeads.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-gray-500">
                            <Table className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                            <p className="font-semibold text-gray-700">No leads match the current filter</p>
                            <p className="text-xs text-gray-400 mt-1">Try resetting the status filter or clearing search.</p>
                          </td>
                        </tr>
                      ) : (
                        filteredSheetLeads.map((lead, idx) => {
                          const isTick = lead.status === 'interested' || lead.status === 'meeting_booked';
                          const isCross = lead.status === 'not_interested' || lead.status === 'disqualified';
                          const isWaiting = lead.status === 'waiting' || lead.status === 'voicemail' || lead.status === 'gatekeeper';

                          return (
                            <tr
                              key={lead.id}
                              className={`transition-colors ${
                                isTick ? 'bg-emerald-50/40 hover:bg-emerald-50/70' :
                                isCross ? 'bg-rose-50/30 hover:bg-rose-50/60' :
                                isWaiting ? 'bg-amber-50/30 hover:bg-amber-50/60' :
                                'hover:bg-gray-50/80'
                              }`}
                            >
                              {/* Row index */}
                              <td className="py-3 px-3.5 font-mono text-gray-400 text-center select-none font-bold">
                                {String(idx + 1).padStart(2, '0')}
                              </td>

                              {/* Domain */}
                              <td className="py-3 px-3.5">
                                <span className="font-mono font-bold text-gray-900 block truncate max-w-[220px]" title={lead.domain}>
                                  {lead.domain}
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[11px] text-gray-500 capitalize truncate max-w-[150px]">
                                    {lead.companyName || lead.domain.split('.')[0]}
                                  </span>
                                  {lead.grade && (
                                    <span className={`px-1.5 py-0.2 rounded-2xs text-[9px] font-bold ${
                                      lead.grade.startsWith('A') ? 'bg-green-100 text-green-800' :
                                      lead.grade.startsWith('B') ? 'bg-blue-100 text-blue-800' :
                                      lead.grade.startsWith('C') ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-red-100 text-red-800'
                                    }`}>
                                      {lead.grade}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Phone Number */}
                              <td className="py-3 px-3.5 font-mono">
                                {lead.phone ? (
                                  <div className="flex items-center gap-1.5">
                                    <a
                                      href={`tel:${lead.phone.replace(/[^+\d]/g, '')}`}
                                      className="text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-xs border border-emerald-300 inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                                      title="Click to dial"
                                    >
                                      <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>{lead.phone}</span>
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(lead.phone || '');
                                        setCopiedPhoneId(lead.id);
                                        setTimeout(() => setCopiedPhoneId(null), 1500);
                                      }}
                                      className="p-1 text-gray-400 hover:text-gray-700 rounded-xs hover:bg-gray-100 cursor-pointer"
                                      title="Copy phone number"
                                    >
                                      {copiedPhoneId === lead.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-gray-400 italic">No phone attached</span>
                                )}
                              </td>

                              {/* Caller */}
                              <td className="py-3 px-3.5">
                                <span className="px-2 py-0.5 rounded-2xs text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 capitalize inline-block">
                                  {lead.callerName || 'Unassigned'}
                                </span>
                              </td>

                              {/* 1-Click Outcome Buttons */}
                              <td className="py-3 px-3.5">
                                <div className="flex items-center gap-1.5">
                                  {/* Tick Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateLeadStatus(lead.id, isTick ? 'pending' : 'interested', lead.notes || '')}
                                    title="Click to mark as Tick (Interested / Meeting Booked)"
                                    className={`px-2.5 py-1 rounded-xs text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                                      isTick
                                        ? 'bg-emerald-600 border-emerald-700 text-white shadow-xs ring-2 ring-emerald-400 font-black'
                                        : 'bg-emerald-50/80 border-emerald-200 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300'
                                    }`}
                                  >
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    <span>Tick</span>
                                  </button>

                                  {/* X Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateLeadStatus(lead.id, isCross ? 'pending' : 'not_interested', lead.notes || '')}
                                    title="Click to mark as X (Not Interested / Disqualified)"
                                    className={`px-2.5 py-1 rounded-xs text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                                      isCross
                                        ? 'bg-rose-600 border-rose-700 text-white shadow-xs ring-2 ring-rose-400 font-black'
                                        : 'bg-rose-50/80 border-rose-200 text-rose-800 hover:bg-rose-100 hover:border-rose-300'
                                    }`}
                                  >
                                    <X className="w-3.5 h-3.5 stroke-[3]" />
                                    <span>X</span>
                                  </button>

                                  {/* Waiting Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateLeadStatus(lead.id, isWaiting ? 'pending' : 'waiting', lead.notes || '')}
                                    title="Click to mark as Waiting (Follow-up / In Discussion)"
                                    className={`px-2.5 py-1 rounded-xs text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                                      isWaiting
                                        ? 'bg-amber-500 border-amber-600 text-white shadow-xs ring-2 ring-amber-300 font-black'
                                        : 'bg-amber-50/80 border-amber-200 text-amber-800 hover:bg-amber-100 hover:border-amber-300'
                                    }`}
                                  >
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>Waiting</span>
                                  </button>
                                </div>

                                {/* Active status badge */}
                                <div className="mt-1">
                                  {isTick && (
                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-2xs border border-emerald-200 inline-block">
                                      ✓ Interested / Booked
                                    </span>
                                  )}
                                  {isCross && (
                                    <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded-2xs border border-rose-200 inline-block">
                                      ✗ Not Interested
                                    </span>
                                  )}
                                  {isWaiting && (
                                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-2xs border border-amber-200 inline-block">
                                      ⏳ Waiting / Callback
                                    </span>
                                  )}
                                  {!isTick && !isCross && !isWaiting && (
                                    <span className="text-[10px] text-gray-400 font-medium italic">
                                      Pending
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Quick Notes Input */}
                              <td className="py-3 px-3.5">
                                <input
                                  type="text"
                                  defaultValue={lead.notes || ''}
                                  onBlur={e => handleUpdateLeadStatus(lead.id, lead.status, e.target.value)}
                                  placeholder="Type notes e.g. Call back 4pm..."
                                  className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-xs focus:ring-1 focus:ring-gray-900 bg-gray-50/60 hover:bg-white focus:bg-white transition-colors"
                                />
                                {statusUpdateMsg?.id === lead.id && (
                                  <span className="text-[9px] text-emerald-600 font-bold block mt-0.5">
                                    ✓ Saved to DB
                                  </span>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="py-3 px-3.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleSelectAssignedLead(lead)}
                                  className="px-2.5 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-[11px] font-bold rounded-xs transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                                  title="Open battlecard phone script"
                                >
                                  <PhoneCall className="w-3 h-3" />
                                  <span>Script →</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: 4-CALLER TEAM DISTRIBUTION */}
            {dashboardTab === 'team-distribution' && (
              <div className="space-y-6">
                {/* Team Caller Overview Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {activeCallerList.length === 0 ? (
                    <div className="col-span-full bg-white border border-gray-200 rounded-sm p-6 text-center text-xs text-gray-500">
                      No active caller assignments yet. Callers sign in with their passcode to unlock their assigned leads.
                    </div>
                  ) : (
                    activeCallerList.map(caller => {
                      const count = allAssignedCounts[caller.key] || 0;
                      const callerLeads = allAssignedLeads.filter(l => l.callerKey === caller.key);
                      const booked = callerLeads.filter(l => l.status === 'meeting_booked').length;
                      const called = callerLeads.filter(l => l.status !== 'pending').length;
                      const isCurrent = currentCaller?.callerKey === caller.key;

                      return (
                        <div 
                          key={caller.key}
                          className={`bg-white border rounded-sm p-4 shadow-xs relative flex flex-col justify-between ${
                            isCurrent ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/10' : 'border-gray-200'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                                Caller
                              </span>
                              {isCurrent && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-2xs">
                                  Active You
                                </span>
                              )}
                            </div>
                            <h4 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
                              {caller.name}
                            </h4>

                            <div className="mt-3 pt-3 border-t border-gray-100 space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Allocated Leads:</span>
                                <span className="font-bold text-gray-900">{count} / 25</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Progress:</span>
                                <span className="font-medium text-gray-700">{called} called</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Meetings Booked:</span>
                                <span className="font-bold text-emerald-700">{booked} 🏆</span>
                              </div>
                            </div>
                          </div>

                          {isCurrent && (
                            <div className="mt-3 py-1 px-2 bg-emerald-50 text-emerald-800 rounded-2xs text-center font-bold text-[11px]">
                              ✓ Currently Authenticated
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Team Filter Bar */}
                <div className="bg-white p-4 rounded-sm border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-sm overflow-x-auto w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setTeamCallerFilter('all')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xs cursor-pointer ${
                        teamCallerFilter === 'all' ? 'bg-white text-gray-900 shadow-xs font-black' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      All Callers ({allAssignedLeads.length})
                    </button>
                    {activeCallerList.map(c => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setTeamCallerFilter(c.key as any)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xs cursor-pointer ${
                          teamCallerFilter === c.key ? 'bg-white text-indigo-900 shadow-xs font-black' : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {c.name} ({allAssignedCounts[c.key] || 0})
                      </button>
                    ))}
                  </div>

                  <span className="text-xs text-gray-500 font-medium">
                    Strict deduplication: exactly 25 leads per caller, no duplicates.
                  </span>
                </div>

                {/* All Assigned Leads Table */}
                <div className="bg-white border border-gray-200 rounded-sm shadow-xs overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        <th className="py-3 px-3.5 w-12">#</th>
                        <th className="py-3 px-3.5">Assigned Caller</th>
                        <th className="py-3 px-3.5">Domain & Business</th>
                        <th className="py-3 px-3.5">Grade</th>
                        <th className="py-3 px-3.5">Status</th>
                        <th className="py-3 px-3.5">Caller Notes</th>
                        <th className="py-3 px-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs">
                      {allAssignedLeads
                        .filter(l => teamCallerFilter === 'all' || l.callerKey === teamCallerFilter)
                        .map((lead, idx) => (
                          <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                            <td className="py-2.5 px-3.5 font-mono text-gray-400 select-none">
                              {String(idx + 1).padStart(2, '0')}
                            </td>
                            <td className="py-2.5 px-3.5">
                              <span className="px-2 py-0.5 rounded-2xs text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 capitalize">
                                {lead.callerName}
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5">
                              <span className="font-mono font-bold text-gray-900 block truncate max-w-[200px]">
                                {lead.domain}
                              </span>
                              {lead.phone && (
                                <a
                                  href={`tel:${lead.phone.replace(/[^+\d]/g, '')}`}
                                  className="text-[11px] text-emerald-700 font-mono font-bold hover:underline inline-flex items-center gap-1 mt-0.5"
                                  title="Click to dial"
                                >
                                  <PhoneCall className="w-3 h-3 text-emerald-600" />
                                  <span>{lead.phone}</span>
                                </a>
                              )}
                              <span className="text-[11px] text-gray-500 capitalize block">
                                {lead.companyName || lead.domain.split('.')[0]}
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5">
                              {lead.grade ? (
                                <span className={`px-2 py-0.5 rounded-2xs text-[10px] font-bold ${
                                  lead.grade.startsWith('A') ? 'bg-green-100 text-green-800' :
                                  lead.grade.startsWith('B') ? 'bg-blue-100 text-blue-800' :
                                  lead.grade.startsWith('C') ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {lead.grade} ({lead.score ?? 0})
                                </span>
                              ) : '-'}
                            </td>
                            <td className="py-2.5 px-3.5">
                              <span className="capitalize text-gray-700 font-medium">
                                {lead.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5 text-gray-600 truncate max-w-[180px]">
                              {lead.notes || <span className="text-gray-400 italic">No notes</span>}
                            </td>
                            <td className="py-2.5 px-3.5 text-right">
                              <button
                                type="button"
                                onClick={() => handleSelectAssignedLead(lead)}
                                className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                              >
                                View Script →
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: ALL AUDITED DOMAINS IN QUEUE */}
            {dashboardTab === 'all-queue' && (
              <div className="space-y-6">
                {/* Campaign Dashboard Overview & Stats Card */}
                <div className="bg-white p-6 rounded-sm border border-gray-200 shadow-xs space-y-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-gray-900">Phone Outreach Campaign Dashboard</h2>
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-xs bg-indigo-50 border border-indigo-200 text-indigo-700 uppercase tracking-wider">
                          {queue.length} Audited Prospects
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Immediately browse phone battlecards for all your bulk audited domains. Click any domain to open its front-desk gatekeeper and decision-maker telephone scripts.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setDomain('');
                          setCompanyName('');
                          setAuditInfo(null);
                          setCurrentScript(null);
                          setViewMode('script');
                        }}
                        className="px-3.5 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-sm transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Single Custom Script</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/bulk')}
                        className="px-3.5 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-sm transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <span>+ Audit More in Bulk (200)</span>
                      </button>
                    </div>
                  </div>

                  {/* KPI Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-gray-100">
                    <div className="bg-gray-50 p-3 rounded-xs border border-gray-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Total Audited Prospects</span>
                      <span className="text-xl font-black text-gray-900">{queue.length}</span>
                    </div>
                    <div className="bg-red-50 p-3 rounded-xs border border-red-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 block flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Cold Call Targets (D/F)
                      </span>
                      <span className="text-xl font-black text-red-800">{coldCallTargets.length}</span>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded-xs border border-yellow-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-700 block">Warnings (Grade C)</span>
                      <span className="text-xl font-black text-yellow-800">{warningTargets.length}</span>
                    </div>
                    <div className="bg-green-50 p-3 rounded-xs border border-green-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-green-700 block flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Healthy (A/B)
                      </span>
                      <span className="text-xl font-black text-green-800">{healthyTargets.length}</span>
                    </div>
                  </div>

                  {/* Filter Tabs & Search Bar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-sm w-full sm:w-auto overflow-x-auto">
                      <button
                        type="button"
                        onClick={() => setDashboardFilter('all')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xs cursor-pointer transition-all ${
                          dashboardFilter === 'all' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        All ({queue.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setDashboardFilter('targets')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xs cursor-pointer transition-all ${
                          dashboardFilter === 'targets' ? 'bg-red-600 text-white shadow-xs' : 'text-red-700 hover:text-red-900'
                        }`}
                      >
                        🔥 High Priority (D/F) ({coldCallTargets.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setDashboardFilter('warnings')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xs cursor-pointer transition-all ${
                          dashboardFilter === 'warnings' ? 'bg-amber-500 text-white shadow-xs' : 'text-amber-800 hover:text-amber-950'
                        }`}
                      >
                        Warnings ({warningTargets.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setDashboardFilter('healthy')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xs cursor-pointer transition-all ${
                          dashboardFilter === 'healthy' ? 'bg-green-700 text-white shadow-xs' : 'text-green-700 hover:text-green-900'
                        }`}
                      >
                        Healthy ({healthyTargets.length})
                      </button>
                    </div>

                    <div className="relative w-full sm:w-72">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={dashboardSearch}
                        onChange={e => setDashboardSearch(e.target.value)}
                        placeholder="Search audited domains..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-gray-900 focus:border-gray-900 bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Prospects Grid */}
                {filteredQueue.length === 0 ? (
                  <div className="bg-white p-12 text-center rounded-sm border border-gray-200 space-y-3">
                    <AlertTriangle className="w-8 h-8 text-gray-400 mx-auto" />
                    <h3 className="text-base font-bold text-gray-900">
                      {queue.length === 0 ? 'No Bulk Audited Domains Yet' : 'No Domains Match Your Filter'}
                    </h3>
                    <p className="text-xs text-gray-500 max-w-md mx-auto">
                      {queue.length === 0
                        ? 'Run a Bulk Audit on up to 200 domains to automatically populate this phone outreach campaign dashboard.'
                        : 'Try clearing your search query or switching to the "All" filter tab.'}
                    </p>
                    {queue.length === 0 && (
                      <button
                        type="button"
                        onClick={() => navigate('/bulk')}
                        className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-sm cursor-pointer shadow-xs"
                      >
                        Go to Bulk Audit (200 Capacity)
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredQueue.map((item, idx) => {
                      const isTarget = item.grade?.startsWith('D') || item.grade?.startsWith('F');
                      const isWarning = item.grade?.startsWith('C');
                      const originalIdx = queue.findIndex(q => q.domain === item.domain);

                      return (
                        <div
                          key={item.domain}
                          onClick={() => handleSelectProspect(item, originalIdx !== -1 ? originalIdx : idx)}
                          className={`bg-white rounded-sm border p-4.5 transition-all hover:shadow-md cursor-pointer flex flex-col justify-between ${
                            isTarget ? 'border-red-200 hover:border-red-400 bg-red-50/20' :
                            isWarning ? 'border-amber-200 hover:border-amber-400' :
                            'border-gray-200 hover:border-gray-400'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="min-w-0">
                                <span className="font-mono text-sm font-black text-gray-900 block truncate" title={item.domain}>
                                  {item.domain}
                                </span>
                                {item.phone && (
                                  <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-800 font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded-xs border border-emerald-200 w-fit">
                                    <PhoneCall className="w-3 h-3 text-emerald-600" />
                                    <span>{item.phone}</span>
                                  </div>
                                )}
                                <span className="text-xs text-gray-500 capitalize truncate block mt-0.5">
                                  {item.companyName || item.domain.split('.')[0]}
                                </span>
                              </div>

                              {item.grade ? (
                                <span className={`px-2 py-0.5 rounded-2xs text-xs font-black shrink-0 ${
                                  item.grade.startsWith('A') ? 'bg-green-100 text-green-800 border border-green-200' :
                                  item.grade.startsWith('B') ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                  item.grade.startsWith('C') ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                  'bg-red-100 text-red-800 border border-red-300'
                                }`}>
                                  {item.grade} ({item.score ?? 0})
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-2xs text-[10px] font-bold">
                                  Audited
                                </span>
                              )}
                            </div>

                            {/* Priority Pill */}
                            <div className="mt-2 mb-3">
                              {isTarget && (
                                <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-xs flex items-center gap-1 w-fit border border-red-200">
                                  <AlertTriangle className="w-3 h-3" /> High Priority Call Target (Failing)
                                </span>
                              )}
                              {isWarning && (
                                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-xs flex items-center gap-1 w-fit border border-amber-200">
                                  <AlertTriangle className="w-3 h-3" /> Warning (Deliverability Gaps)
                                </span>
                              )}
                              {!isTarget && !isWarning && (
                                <span className="text-[10px] font-bold text-green-800 bg-green-100 px-2 py-0.5 rounded-xs flex items-center gap-1 w-fit border border-green-200">
                                  <ShieldCheck className="w-3 h-3" /> Healthy Deliverability
                                </span>
                              )}
                            </div>

                            {/* Technical Badges */}
                            {item.resultData && (
                              <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono text-gray-600 bg-gray-50 p-2 rounded-xs border border-gray-100 mb-3">
                                <div className="truncate">
                                  <span className="text-gray-400 block text-[9px]">SPF:</span>
                                  <strong className={item.resultData.spf?.status === 'pass' ? 'text-green-700' : 'text-red-700'}>
                                    {item.resultData.spf?.status || 'N/A'}
                                  </strong>
                                </div>
                                <div className="truncate">
                                  <span className="text-gray-400 block text-[9px]">DMARC:</span>
                                  <strong className={item.resultData.dmarc?.status === 'pass' ? 'text-green-700' : 'text-red-700'}>
                                    {item.resultData.dmarc?.policy || item.resultData.dmarc?.status || 'N/A'}
                                  </strong>
                                </div>
                                <div className="truncate">
                                  <span className="text-gray-400 block text-[9px]">Blacklist:</span>
                                  <strong className={item.resultData.blacklists?.clean ? 'text-green-700' : 'text-red-700'}>
                                    {item.resultData.blacklists?.clean ? 'Clean' : 'Listed'}
                                  </strong>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs">
                            <span className="text-gray-400 text-[11px] font-medium">Click to launch script</span>
                            <span className="font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                              Open Phone Script <ArrowRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* VIEW MODE 2: SPECIFIC DOMAIN PHONE SCRIPT VIEW */
          <div className="space-y-6">
            {/* PROMINENT TOP BAR: BACK BUTTON & CAROUSEL NAVIGATION */}
            <div className="bg-indigo-50/70 border border-indigo-200 p-3.5 rounded-sm shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 sticky top-2 z-10">
              <button
                type="button"
                onClick={() => {
                  setViewMode('dashboard');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-indigo-50 border border-indigo-300 text-indigo-900 text-xs font-bold rounded-sm flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
                title="Return to the Campaign Dashboard showing all bulk audited domains"
              >
                <ArrowLeft className="w-4 h-4 text-indigo-700" />
                <span>← Back to Outreach Dashboard {queue.length > 0 ? `(${queue.length} Audited Domains)` : ''}</span>
              </button>

              {queue.length > 0 && (
                <div className="flex items-center gap-2 text-xs flex-wrap justify-center">
                  <button
                    type="button"
                    onClick={handlePrevProspect}
                    disabled={selectedQueueIndex <= 0}
                    className="px-2.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 font-semibold rounded-xs flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Prev
                  </button>
                  <span className="font-mono text-gray-700 px-2.5 py-1 font-bold text-xs bg-white rounded-xs border border-gray-200">
                    Prospect {selectedQueueIndex + 1} of {queue.length}: <strong className="text-indigo-900">{domain}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleNextProspect}
                    disabled={selectedQueueIndex >= queue.length - 1}
                    className="px-2.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 font-semibold rounded-xs flex items-center gap-1 cursor-pointer"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Generator Form */}
            <div className="bg-white p-6 rounded-sm border border-gray-200 shadow-xs mb-8">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                Target Prospect Information
              </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Domain Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="e.g. smilebrightdental.com"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm font-mono focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
                <span>Phone Number</span>
                {phone && (
                  <a
                    href={`tel:${phone.replace(/[^+\d]/g, '')}`}
                    className="text-[10px] text-emerald-700 font-bold hover:underline inline-flex items-center gap-0.5"
                    title="Click to dial"
                  >
                    <PhoneCall className="w-2.5 h-2.5" /> Call
                  </a>
                )}
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="e.g. +1 469-591-7663"
                  className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 rounded-sm font-mono focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                />
                <PhoneCall className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Business / Practice Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="e.g. Smile Bright Dental"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Decision Maker Role / Name
              </label>
              <input
                type="text"
                value={officeManagerName}
                onChange={e => setOfficeManagerName(e.target.value)}
                placeholder="e.g. Sarah / Office Manager"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Calling Tone & Strategy
              </label>
              <select
                value={callStyle}
                onChange={e => setCallStyle(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-sm focus:ring-1 focus:ring-gray-900 focus:border-gray-900 bg-white"
              >
                <option value="consultative">Consultative Authority</option>
                <option value="urgent">Urgent Notice</option>
                <option value="friendly">Friendly Local</option>
              </select>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {errorMessage}
            </div>
          )}

          <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {auditInfo && (
                <span className="flex items-center gap-1.5 font-medium bg-gray-100 px-2.5 py-1 rounded-sm border border-gray-200 text-gray-700">
                  Audit Attached: Grade <strong>{auditInfo.grade || 'N/A'}</strong> ({auditInfo.score || 0}/100)
                </span>
              )}
              <span>Generated in real-time with Groq LPU</span>
            </div>

            <button
              onClick={() => generateScript()}
              disabled={isGenerating || !domain.trim()}
              className="w-full sm:w-auto px-6 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-[13px] font-bold uppercase tracking-wider rounded-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Battlecard...
                </>
              ) : (
                <>
                  <PhoneCall className="w-4 h-4" />
                  Generate Phone Script
                </>
              )}
            </button>
          </div>
        </div>

        {/* Script Content Display */}
        {currentScript && (
          <div className="space-y-6">
            {/* Plain English Layman Executive Banner */}
            <div className="bg-amber-50 border border-amber-200 p-5 rounded-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="p-2 bg-amber-100 text-amber-800 rounded-sm shrink-0 mt-0.5">
                    <ShieldAlert className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wider">
                      The Non-Technical Reality for {currentScript.companyName}
                    </h3>
                    <p className="text-sm text-amber-950 mt-1.5 leading-relaxed font-medium">
                      "{currentScript.auditSummaryPlainEnglish}"
                    </p>
                    <p className="text-xs text-amber-800 mt-2">
                      💡 <em>Use this plain explanation on the call. Do NOT recite DNS codes or RFC numbers to the gatekeeper or owner!</em>
                    </p>
                  </div>
                </div>

                {auditInfo?.grade && (
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Audit Grade</div>
                    <div className={`text-2xl font-black ${
                      auditInfo.grade.startsWith('A') ? 'text-green-700' :
                      auditInfo.grade.startsWith('B') ? 'text-blue-700' :
                      auditInfo.grade.startsWith('C') ? 'text-yellow-700' :
                      'text-red-700'
                    }`}>
                      {auditInfo.grade} <span className="text-xs font-normal text-gray-500">({auditInfo.score}/100)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Action Bar */}
            <div className="bg-white p-3 rounded-sm border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
              {/* Tab Navigation */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-sm">
                <button
                  onClick={() => setActiveTab('frontDesk')}
                  className={`px-3.5 py-1.5 rounded-xs text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'frontDesk'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  1. Front Desk Script
                </button>
                <button
                  onClick={() => setActiveTab('owner')}
                  className={`px-3.5 py-1.5 rounded-xs text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'owner'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  2. Owner / Office Manager
                </button>
                <button
                  onClick={() => setActiveTab('voicemail')}
                  className={`px-3.5 py-1.5 rounded-xs text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'voicemail'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <PhoneForwarded className="w-3.5 h-3.5" />
                  3. Voicemail (20s)
                </button>
              </div>

              {/* Utility Buttons */}
              <div className="flex items-center gap-2">
                {user && (
                  <button
                    onClick={handleSaveCurrentScript}
                    disabled={isSaving}
                    className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    {isSaving ? 'Saving...' : 'Save Script'}
                  </button>
                )}
                <button
                  onClick={() => copyToClipboard(getFullBattlecardText(), 'full')}
                  className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-sm transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {copiedKey === 'full' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied Full!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy Entire Battlecard
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* TAB 1: FRONT DESK SCRIPT */}
            {activeTab === 'frontDesk' && (
              <div className="bg-white border border-gray-200 rounded-sm shadow-xs p-6 space-y-6">
                <div className="border-b border-gray-100 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-sm border border-indigo-100">
                        Gatekeeper Navigation
                      </span>
                      <h3 className="text-lg font-bold text-gray-900 mt-1">Front Desk / Receptionist Phone Script</h3>
                    </div>
                    <span className="text-xs text-gray-500 font-medium">
                      Goal: <strong>{currentScript.frontDeskScript.goal}</strong>
                    </span>
                  </div>
                </div>

                {/* Opener Card */}
                <div className="bg-gray-50 border border-gray-200 rounded-sm p-4 relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                      <PhoneCall className="w-3.5 h-3.5 text-gray-700" />
                      Step 1: Your Opening Words
                    </span>
                    <button
                      onClick={() => copyToClipboard(currentScript.frontDeskScript.opener, 'fd-opener')}
                      className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1 cursor-pointer font-medium"
                    >
                      {copiedKey === 'fd-opener' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedKey === 'fd-opener' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-sm font-medium text-gray-900 leading-relaxed font-sans bg-white p-3 border border-gray-200 rounded-xs">
                    "{currentScript.frontDeskScript.opener}"
                  </p>
                </div>

                {/* Reason for Calling */}
                <div className="bg-gray-50 border border-gray-200 rounded-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-gray-700" />
                      Step 2: Reason for Calling (Non-Threatening & Plain English)
                    </span>
                    <button
                      onClick={() => copyToClipboard(currentScript.frontDeskScript.reasonForCalling, 'fd-reason')}
                      className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1 cursor-pointer font-medium"
                    >
                      {copiedKey === 'fd-reason' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedKey === 'fd-reason' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-sm font-medium text-gray-900 leading-relaxed bg-white p-3 border border-gray-200 rounded-xs">
                    "{currentScript.frontDeskScript.reasonForCalling}"
                  </p>
                </div>

                {/* Transfer Ask */}
                <div className="bg-indigo-50/50 border border-indigo-200 rounded-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-700" />
                      Step 3: The Transfer Ask
                    </span>
                    <button
                      onClick={() => copyToClipboard(currentScript.frontDeskScript.transferAsk, 'fd-transfer')}
                      className="text-xs text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer font-medium"
                    >
                      {copiedKey === 'fd-transfer' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedKey === 'fd-transfer' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-sm font-bold text-gray-900 leading-relaxed bg-white p-3 border border-indigo-200 rounded-xs">
                    "{currentScript.frontDeskScript.transferAsk}"
                  </p>
                </div>

                {/* Gatekeeper Objections */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-3 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    How to Handle Front Desk Pushback (Word-for-Word Responses)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {currentScript.frontDeskScript.objections.map((obj, idx) => (
                      <div key={idx} className="border border-gray-200 rounded-sm p-3.5 bg-gray-50 hover:bg-white transition-colors">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-red-700">
                            Front Desk: "{obj.pushback}"
                          </span>
                          <button
                            onClick={() => copyToClipboard(obj.rebuttal, `fd-obj-${idx}`)}
                            className="text-[11px] text-gray-500 hover:text-gray-900 flex items-center gap-1 cursor-pointer"
                          >
                            {copiedKey === `fd-obj-${idx}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            {copiedKey === `fd-obj-${idx}` ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <p className="text-xs font-medium text-gray-800 leading-relaxed bg-white p-2.5 rounded-xs border border-gray-200">
                          <strong>You:</strong> "{obj.rebuttal}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: OWNER / OFFICE MANAGER SCRIPT */}
            {activeTab === 'owner' && (
              <div className="bg-white border border-gray-200 rounded-sm shadow-xs p-6 space-y-6">
                <div className="border-b border-gray-100 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-sm border border-emerald-200">
                        Decision Maker Pitch
                      </span>
                      <h3 className="text-lg font-bold text-gray-900 mt-1">Office Manager & Owner Phone Script</h3>
                    </div>
                    <span className="text-xs text-gray-500 font-medium">
                      Target: <strong>{currentScript.ownerScript.targetRole}</strong>
                    </span>
                  </div>
                </div>

                {/* 30-Second Pattern Interrupt Opener */}
                <div className="bg-gray-50 border border-gray-200 rounded-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                      <PhoneCall className="w-3.5 h-3.5 text-gray-700" />
                      30-Second Attention Opener
                    </span>
                    <button
                      onClick={() => copyToClipboard(currentScript.ownerScript.opener30Sec, 'owner-opener')}
                      className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1 cursor-pointer font-medium"
                    >
                      {copiedKey === 'owner-opener' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedKey === 'owner-opener' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-sm font-medium text-gray-900 leading-relaxed bg-white p-3 border border-gray-200 rounded-xs">
                    "{currentScript.ownerScript.opener30Sec}"
                  </p>
                </div>

                {/* Plain-English Audit Findings with Analogies */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-3 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    Translating Audit Findings into Everyday Language
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    {currentScript.ownerScript.plainEnglishBreakdown.map((item, idx) => (
                      <div key={idx} className="border border-gray-200 rounded-sm p-4 bg-white hover:border-gray-300 transition-colors shadow-2xs">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-xs font-mono">
                            {item.technicalIssue}
                          </span>
                          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                            Real-World Business Impact
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                          <div className="bg-blue-50/60 border border-blue-200/80 p-3 rounded-xs">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 block mb-1">
                              Everyday Analogy to Tell Them:
                            </span>
                            <p className="text-xs text-blue-950 font-medium leading-relaxed">
                              "{item.plainEnglishAnalogy}"
                            </p>
                          </div>
                          <div className="bg-red-50/60 border border-red-200/80 p-3 rounded-xs">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-red-800 block mb-1">
                              Why They Lose Money / Clients:
                            </span>
                            <p className="text-xs text-red-950 font-medium leading-relaxed">
                              {item.businessImpact}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Diagnostic Discovery Questions */}
                <div className="bg-gray-50 border border-gray-200 rounded-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-gray-700" />
                      Probing Diagnostic Questions to Ask
                    </span>
                  </div>
                  <ul className="space-y-2 mt-2">
                    {currentScript.ownerScript.diagnosticQuestions.map((q, idx) => (
                      <li key={idx} className="text-xs font-medium text-gray-900 bg-white p-2.5 rounded-xs border border-gray-200 flex items-start gap-2">
                        <span className="text-gray-400 font-bold">{idx + 1}.</span>
                        <span>"{q}"</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Closing CTA */}
                <div className="bg-emerald-50/60 border border-emerald-200 rounded-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-800" />
                      Low-Friction Closing Ask (CTA)
                    </span>
                    <button
                      onClick={() => copyToClipboard(currentScript.ownerScript.closingCta, 'owner-cta')}
                      className="text-xs text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer font-medium"
                    >
                      {copiedKey === 'owner-cta' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedKey === 'owner-cta' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-sm font-bold text-gray-900 leading-relaxed bg-white p-3 border border-emerald-200 rounded-xs">
                    "{currentScript.ownerScript.closingCta}"
                  </p>
                </div>

                {/* Owner Objection Handling */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-3 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    How to Handle Owner / Manager Objections
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {currentScript.ownerScript.objections.map((obj, idx) => (
                      <div key={idx} className="border border-gray-200 rounded-sm p-3.5 bg-gray-50 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-red-700">
                              "{obj.pushback}"
                            </span>
                            <button
                              onClick={() => copyToClipboard(obj.rebuttal, `owner-obj-${idx}`)}
                              className="text-[11px] text-gray-500 hover:text-gray-900 flex items-center gap-1 cursor-pointer"
                            >
                              {copiedKey === `owner-obj-${idx}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              {copiedKey === `owner-obj-${idx}` ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                          <p className="text-xs font-medium text-gray-800 leading-relaxed bg-white p-2.5 rounded-xs border border-gray-200 mt-2">
                            "{obj.rebuttal}"
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: VOICEMAIL SCRIPT */}
            {activeTab === 'voicemail' && (
              <div className="bg-white border border-gray-200 rounded-sm shadow-xs p-6 space-y-6">
                <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-sm border border-purple-200">
                      High-Curiosity Voicemail
                    </span>
                    <h3 className="text-lg font-bold text-gray-900 mt-1">20-Second Voicemail Script</h3>
                  </div>
                  <span className="text-xs text-gray-500 font-medium">
                    Duration: <strong>{currentScript.voicemailScript.duration}</strong>
                  </span>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Leave This Exact Message If Sent to Voicemail:
                    </span>
                    <button
                      onClick={() => copyToClipboard(currentScript.voicemailScript.script, 'vm-script')}
                      className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1.5 cursor-pointer font-semibold bg-white border border-gray-300 px-2.5 py-1 rounded-sm shadow-2xs"
                    >
                      {copiedKey === 'vm-script' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedKey === 'vm-script' ? 'Copied to Clipboard' : 'Copy Voicemail'}
                    </button>
                  </div>
                  <div className="bg-white p-4 border border-gray-200 rounded-xs">
                    <p className="text-base text-gray-900 font-medium leading-relaxed italic">
                      "{currentScript.voicemailScript.script}"
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    💡 <em>Voicemail Tip: Speak calmly, avoid fast telemarketing speech, and leave your direct phone number twice.</em>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

            {/* Bottom Return to Dashboard Action */}
            <div className="mt-8 pt-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setViewMode('dashboard');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full sm:w-auto px-4 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 text-xs font-bold rounded-sm flex items-center justify-center gap-2 cursor-pointer shadow-2xs transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-indigo-700" />
                <span>← Back to Outreach Dashboard {queue.length > 0 ? `(${queue.length} Audited Domains)` : ''}</span>
              </button>

              {queue.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={handlePrevProspect}
                    disabled={selectedQueueIndex <= 0}
                    className="px-2.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 font-semibold rounded-xs flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Prev Prospect
                  </button>
                  <button
                    type="button"
                    onClick={handleNextProspect}
                    disabled={selectedQueueIndex >= queue.length - 1}
                    className="px-2.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 font-semibold rounded-xs flex items-center gap-1 cursor-pointer"
                  >
                    Next Prospect <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Saved Outreach Battlecards Section */}
        {user && savedScripts.length > 0 && (
          <div className="mt-12 bg-white border border-gray-200 rounded-sm shadow-xs p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-gray-500" />
                Saved Phone Battlecards ({savedScripts.length})
              </h3>
              <button
                onClick={loadSavedScripts}
                className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedScripts.map(record => (
                <div
                  key={record.id}
                  className="border border-gray-200 rounded-sm p-3.5 bg-gray-50/50 hover:bg-white transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs font-bold text-gray-900 truncate max-w-[160px]">
                        {record.domain}
                      </span>
                      {record.grade && (
                        <span className={`px-1.5 py-0.5 rounded-2xs text-[10px] font-bold ${
                          record.grade.startsWith('A') ? 'bg-green-100 text-green-800' :
                          record.grade.startsWith('B') ? 'bg-blue-100 text-blue-800' :
                          record.grade.startsWith('C') ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {record.grade} ({record.score ?? 0})
                        </span>
                      )}
                    </div>
                    {record.companyName && (
                      <p className="text-xs text-gray-600 truncate">{record.companyName}</p>
                    )}
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      Saved {new Date(record.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="mt-3 pt-2 border-t border-gray-200/60 flex items-center justify-between">
                    <button
                      onClick={() => handleLoadSavedRecord(record)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      <PhoneCall className="w-3 h-3" /> View Battlecard
                    </button>
                    <button
                      onClick={() => handleDeleteSavedScript(record.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors p-1 cursor-pointer"
                      title="Delete saved script"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CALLER LOGIN MODAL */}
        {showCallerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-sm border border-gray-200 shadow-xl max-w-md w-full p-6 relative">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-xs border border-indigo-200">
                    <Users className="w-4 h-4" />
                  </span>
                  <h3 className="text-sm font-bold text-gray-900">Caller Role-Based Sign In</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCallerModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-lg font-bold leading-none cursor-pointer"
                >
                  ×
                </button>
              </div>

              <p className="text-xs text-gray-500 mb-4">
                Input your caller name, work email, and assigned secret passcode to access your assigned leads.
              </p>

              <form onSubmit={handleCallerLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Caller Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={callerNameInput}
                    onChange={e => setCallerNameInput(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Work Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={callerEmailInput}
                    onChange={e => setCallerEmailInput(e.target.value)}
                    placeholder="your.email@company.com"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-sm focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Secret Access Passcode <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={callerCodeInput}
                    onChange={e => setCallerCodeInput(e.target.value)}
                    placeholder="Enter assigned passcode"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-sm font-mono focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                  />
                </div>

                {callerLoginError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xs">
                    {callerLoginError}
                  </div>
                )}

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowCallerModal(false)}
                    className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={callerLoginLoading}
                    className="px-4 py-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white text-xs font-bold rounded-xs cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    {callerLoginLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Sign In & Open My 25 Leads</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
