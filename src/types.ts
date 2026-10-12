export interface DomainAuditResult {
  domain: string;
  timestamp: string;
  score: number;
  grade: string;
  spf: {
    status: 'pass' | 'warning' | 'fail' | 'missing';
    record: string | null;
    lookups: number;
    mechanisms: string[];
    warnings: string[];
  };
  dkim: {
    status: 'pass' | 'fail' | 'missing';
    selector: string;
    probedSelectors?: string[];
    record: string | null;
    keySize?: string;
    detectedSelector?: string;
    error?: string;
  };
  dmarc: {
    status: 'pass' | 'warning' | 'fail' | 'missing';
    record: string | null;
    policy: 'none' | 'quarantine' | 'reject' | 'missing';
    pct: number;
    rua: string | null;
    error?: string;
  };
  bimi: {
    status: 'pass' | 'not_configured';
    record: string | null;
    logoUrl: string | null;
    vmcPresent?: boolean;
  };
  mx: {
    status: 'pass' | 'fail' | 'missing';
    records: Array<{ exchange: string; priority: number }>;
    primaryIp?: string | null;
    error?: string;
  };
  rdns: {
    status: 'pass' | 'fail' | 'warning' | 'unknown';
    ip: string | null;
    host: string | null;
    ptr: string | null;
    fcrdns?: boolean;
    error?: string;
  };
  blacklists: {
    clean: boolean;
    ipChecked: string | null;
    listedCount: number;
    checks: Array<{ name: string; zone: string; status: 'clean' | 'listed' | 'untested'; returnIp?: string }>;
  };
  aiAnalysis: string | null;
}

export interface ContentAnalysisResult {
  wordCount: number;
  imgCount: number;
  spamScore: number;
  detectedTriggers: string[];
  aiContentAnalysis: string | null;
}

export interface ScriptObjection {
  pushback: string;
  rebuttal: string;
}

export interface PlainEnglishBreakdownItem {
  technicalIssue: string;
  plainEnglishAnalogy: string;
  businessImpact: string;
}

export interface PhoneOutreachScript {
  domain: string;
  companyName: string;
  auditSummaryPlainEnglish: string;
  frontDeskScript: {
    targetRole: string;
    goal: string;
    opener: string;
    reasonForCalling: string;
    transferAsk: string;
    objections: ScriptObjection[];
  };
  ownerScript: {
    targetRole: string;
    goal: string;
    opener30Sec: string;
    plainEnglishBreakdown: PlainEnglishBreakdownItem[];
    diagnosticQuestions: string[];
    closingCta: string;
    objections: ScriptObjection[];
  };
  voicemailScript: {
    duration: string;
    script: string;
  };
}

export interface SavedOutreachRecord {
  id: number;
  userId: string;
  domain: string;
  companyName?: string | null;
  grade?: string | null;
  score?: number | null;
  scriptData: string; // JSON of PhoneOutreachScript
  createdAt: string;
}
