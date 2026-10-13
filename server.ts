import express from "express";
import path from "path";
import dns from "dns/promises";
import { GoogleGenAI } from "@google/genai";
import { Groq } from "groq-sdk";
import * as dotenv from "dotenv";
dotenv.config();
import { requireAuth, AuthRequest, generateToken, generateCallerToken } from "./src/middleware/auth.ts";
import { getOrCreateUser, getUserByUid, createPasswordUser, verifyUserPassword } from "./src/db/users.ts";
import { saveAudit, getAuditsByUserId, deleteAuditById, clearAllAuditsByUserId } from "./src/db/audits.ts";
import { saveOutreachScript, getOutreachScriptsByUserId, deleteOutreachScriptById } from "./src/db/outreach.ts";
import { 
  verifyCallerLogin, 
  distributeLeadsEqually, 
  getLeadsForCaller, 
  getAllAssignedLeads, 
  updateLeadStatus, 
  clearAllLeadAssignments,
  ensureCallersInitialized,
  getRegisteredCallers
} from "./src/db/leads.ts";

export const app = express();
const portArgIndex = process.argv.indexOf("--port");
const cliPort = portArgIndex !== -1 && process.argv[portArgIndex + 1] ? parseInt(process.argv[portArgIndex + 1], 10) : null;
const PORT = cliPort || (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);

// Groq initialization - stored securely server-side only
const GROQ_API_KEY = process.env.GROQ_API_KEY || "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";
const groq = new Groq({ apiKey: GROQ_API_KEY });

app.use(express.json({ limit: "2mb" }));

// Helper function to count SPF lookups (recursive mechanism evaluation)
async function evaluateSpf(domain: string, recordText: string, depth = 0): Promise<{ lookups: number; mechanisms: string[]; warnings: string[] }> {
  if (depth > 5) return { lookups: 1, mechanisms: [domain], warnings: ["Max recursion depth reached in SPF check."] };
  
  const mechanisms = recordText.split(/\s+/).filter(Boolean);
  let lookups = 0;
  const warnings: string[] = [];
  
  for (const mech of mechanisms) {
    if (mech.startsWith("include:") || mech.startsWith("redirect=")) {
      lookups++;
      const targetDomain = mech.split(":")[1] || mech.split("=")[1];
      if (targetDomain) {
        try {
          const txtRecords = await dns.resolveTxt(targetDomain);
          const spfTxt = txtRecords.flat().find(t => t.startsWith("v=spf1"));
          if (spfTxt) {
            const subEval = await evaluateSpf(targetDomain, spfTxt, depth + 1);
            lookups += subEval.lookups;
            warnings.push(...subEval.warnings);
          }
        } catch (e) {
          warnings.push(`Could not resolve include domain: ${targetDomain}`);
        }
      }
    } else if (["a", "mx", "ptr", "exists"].some(m => mech === m || mech.startsWith(`${m}:`))) {
      lookups++;
    }
  }

  if (lookups > 10) {
    warnings.push(`SPF lookup limit exceeded! Current lookups: ${lookups} (Max allowed: 10). This causes silent failures with Google and Yahoo.`);
  }

  return { lookups, mechanisms, warnings };
}

// Active, public, real-time DNSBL providers queryable via standard DNS A-record queries
const DNSBL_LISTS = [
  { name: "SpamCop BL", zone: "bl.spamcop.net" },
  { name: "Barracuda Central", zone: "b.barracudacentral.org" },
  { name: "UCEPROTECT Level 1", zone: "dnsbl-1.uceprotect.net" },
  { name: "PSBL (Passive Spam)", zone: "psbl.surriel.com" },
  { name: "DroneBL", zone: "dnsbl.dronebl.org" }
];

async function checkDnsbl(ip: string): Promise<{
  clean: boolean;
  ipChecked: string | null;
  listedCount: number;
  checks: Array<{ name: string; zone: string; status: 'clean' | 'listed' | 'untested'; returnIp?: string }>;
}> {
  if (!ip || !/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    return {
      clean: true,
      ipChecked: null,
      listedCount: 0,
      checks: DNSBL_LISTS.map(l => ({ ...l, status: 'untested' as const }))
    };
  }

  const reversedIp = ip.split('.').reverse().join('.');
  
  const checkPromises = DNSBL_LISTS.map(async (bl) => {
    const query = `${reversedIp}.${bl.zone}`;
    try {
      const resolverPromise = dns.resolve4(query);
      const timeoutPromise = new Promise<string[]>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 2500)
      );
      const addresses = await Promise.race([resolverPromise, timeoutPromise]);
      
      if (addresses && addresses.length > 0) {
        const first = addresses[0];
        // Open recursive resolver refusal codes (e.g. 127.255.255.x)
        if (first.startsWith("127.255.255.")) {
          return { name: bl.name, zone: bl.zone, status: 'untested' as const, returnIp: first };
        }
        return { name: bl.name, zone: bl.zone, status: 'listed' as const, returnIp: first };
      }
      return { name: bl.name, zone: bl.zone, status: 'clean' as const };
    } catch (err: any) {
      if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
        return { name: bl.name, zone: bl.zone, status: 'clean' as const };
      }
      return { name: bl.name, zone: bl.zone, status: 'untested' as const };
    }
  });

  const checks = await Promise.all(checkPromises);
  const listedCount = checks.filter(c => c.status === 'listed').length;
  return {
    clean: listedCount === 0,
    ipChecked: ip,
    listedCount,
    checks
  };
}

async function checkRdns(ip: string, host: string | null): Promise<{
  status: 'pass' | 'fail' | 'warning';
  ip: string;
  host: string | null;
  ptr: string | null;
  fcrdns: boolean;
  error?: string;
}> {
  try {
    const resolverPromise = dns.reverse(ip);
    const timeoutPromise = new Promise<string[]>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 2500)
    );
    const ptrs = await Promise.race([resolverPromise, timeoutPromise]);

    if (ptrs && ptrs.length > 0) {
      const ptr = ptrs[0];
      // Check Forward-Confirmed reverse DNS (FCrDNS)
      let fcrdns = false;
      try {
        const forwardIps = await dns.resolve4(ptr);
        fcrdns = forwardIps.includes(ip);
      } catch (e) {
        fcrdns = false;
      }

      return {
        status: 'pass',
        ip,
        host,
        ptr,
        fcrdns
      };
    }

    return {
      status: 'fail',
      ip,
      host,
      ptr: null,
      fcrdns: false,
      error: 'No reverse DNS (PTR) record configured for this mail server IP.'
    };
  } catch (err: any) {
    return {
      status: 'fail',
      ip,
      host,
      ptr: null,
      fcrdns: false,
      error: err.code === 'ENOTFOUND'
        ? 'No PTR record found for IP.'
        : (err.message || 'Reverse DNS lookup failed')
    };
  }
}

const COMMON_DKIM_SELECTORS = [
  "google",
  "s1",
  "selector1",
  "k1",
  "mandrill",
  "smtp",
  "default",
  "mail",
  "dkim"
];

// API: Check Domain Deliverability
app.post("/api/check-domain", async (req, res) => {
  const { domain, selector, skipAi } = req.body;
  if (!domain) {
    return res.status(400).json({ error: "Domain is required" });
  }

  const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const requestedSelector = (selector || "google").trim();

  const results: any = {
    domain: cleanDomain,
    timestamp: new Date().toISOString(),
    spf: { status: "missing", record: null, lookups: 0, mechanisms: [], warnings: [] },
    dkim: { status: "missing", selector: requestedSelector, record: null },
    dmarc: { status: "missing", record: null, policy: "none", pct: 100, rua: null },
    bimi: { status: "missing", record: null, logoUrl: null, vmcRequired: false },
    mx: { status: "missing", records: [] },
    rdns: { status: "unknown", ip: null, host: null, ptr: null, fcrdns: false },
    blacklists: {
      clean: true,
      ipChecked: null,
      listedCount: 0,
      checks: DNSBL_LISTS.map(l => ({ ...l, status: "untested" }))
    },
    aiAnalysis: null,
    score: 0,
    grade: "F"
  };

  try {
    // 1. MX Records and primary host resolution
    let primaryMxIp: string | null = null;
    let primaryMxHost: string | null = null;

    try {
      const mxRecords = await dns.resolveMx(cleanDomain);
      if (mxRecords && mxRecords.length > 0) {
        const sorted = mxRecords.sort((a, b) => a.priority - b.priority);
        results.mx = {
          status: "pass",
          records: sorted
        };
        primaryMxHost = sorted[0].exchange;
        try {
          const mxIps = await dns.resolve4(primaryMxHost);
          if (mxIps && mxIps.length > 0) {
            primaryMxIp = mxIps[0];
            results.mx.primaryIp = primaryMxIp;
          }
        } catch (e) {
          // Primary MX host IPv4 lookup failed
        }
      } else {
        results.mx = { status: "fail", records: [], error: "No MX records found for domain." };
      }
    } catch (e) {
      results.mx = { status: "fail", records: [], error: "No MX records found or DNS lookup failed." };
    }

    // Determine IP for rDNS and DNSBL checks
    let ipToCheck = primaryMxIp;
    if (!ipToCheck) {
      try {
        const domainIps = await dns.resolve4(cleanDomain);
        if (domainIps && domainIps.length > 0) {
          ipToCheck = domainIps[0];
        }
      } catch (e) {
        // Fallback domain A lookup failed
      }
    }

    // 2. Real rDNS / PTR Verification
    if (ipToCheck) {
      results.rdns = await checkRdns(ipToCheck, primaryMxHost || cleanDomain);
    } else {
      results.rdns = {
        status: "fail",
        ip: null,
        host: primaryMxHost || cleanDomain,
        ptr: null,
        fcrdns: false,
        error: "Could not resolve a valid IPv4 address for mail server or domain."
      };
    }

    // 3. Real DNSBL Blacklist Verification against Sending IP
    if (ipToCheck) {
      results.blacklists = await checkDnsbl(ipToCheck);
    } else {
      results.blacklists = {
        clean: true,
        ipChecked: null,
        listedCount: 0,
        checks: DNSBL_LISTS.map(l => ({ ...l, status: "untested" }))
      };
    }

    // 4. SPF TXT Evaluation
    try {
      const txtRecords = await dns.resolveTxt(cleanDomain);
      const flatTxt = txtRecords.flat();

      const spfRecord = flatTxt.find(t => t.startsWith("v=spf1"));
      if (spfRecord) {
        const spfEval = await evaluateSpf(cleanDomain, spfRecord);
        results.spf = {
          status: spfEval.lookups > 10 ? "warning" : "pass",
          record: spfRecord,
          lookups: spfEval.lookups,
          mechanisms: spfEval.mechanisms,
          warnings: spfEval.warnings
        };
      } else {
        results.spf = { status: "fail", record: null, lookups: 0, mechanisms: [], warnings: ["No SPF (v=spf1) record published."] };
      }
    } catch (e) {
      results.spf = { status: "fail", record: null, lookups: 0, mechanisms: [], warnings: ["Could not fetch TXT records for SPF."] };
    }

    // 5. DMARC Record (_dmarc.domain)
    try {
      const dmarcTxt = await dns.resolveTxt(`_dmarc.${cleanDomain}`);
      const flatDmarc = dmarcTxt.flat();
      const dmarcRecord = flatDmarc.find(t => t.startsWith("v=DMARC1"));
      if (dmarcRecord) {
        let policy = "none";
        if (dmarcRecord.includes("p=reject")) policy = "reject";
        else if (dmarcRecord.includes("p=quarantine")) policy = "quarantine";

        let pct = 100;
        const pctMatch = dmarcRecord.match(/pct=(\d+)/);
        if (pctMatch) pct = parseInt(pctMatch[1], 10);

        let rua = null;
        const ruaMatch = dmarcRecord.match(/rua=([^;\s]+)/);
        if (ruaMatch) rua = ruaMatch[1];

        results.dmarc = {
          status: policy === "none" ? "warning" : "pass",
          record: dmarcRecord,
          policy,
          pct,
          rua
        };
      } else {
        results.dmarc = { status: "fail", record: null, policy: "missing", error: "DMARC record not found in DNS." };
      }
    } catch (e) {
      results.dmarc = { status: "fail", record: null, policy: "missing", error: "DMARC record not found in DNS." };
    }

    // 6. DKIM Record (Multi-selector probing in parallel)
    const selectorsToProbe = Array.from(new Set([requestedSelector, ...COMMON_DKIM_SELECTORS]));
    const dkimProbeResults = await Promise.all(
      selectorsToProbe.map(async (sel) => {
        try {
          const dkimTxt = await dns.resolveTxt(`${sel}._domainkey.${cleanDomain}`);
          const flatDkim = dkimTxt.flat().join("");
          if (flatDkim.includes("k=rsa") || flatDkim.includes("p=") || flatDkim.includes("v=DKIM1")) {
            return { sel, record: flatDkim };
          }
        } catch (e) {
          // not found
        }
        return null;
      })
    );

    const matchedDkim = dkimProbeResults.find(Boolean);
    if (matchedDkim) {
      const is2048 = matchedDkim.record.includes("p=MII") && matchedDkim.record.length > 300;
      results.dkim = {
        status: "pass",
        selector: requestedSelector,
        detectedSelector: matchedDkim.sel,
        probedSelectors: selectorsToProbe,
        record: matchedDkim.record,
        keySize: is2048 ? "2048-bit" : "1024-bit"
      };
    } else {
      results.dkim = {
        status: "fail",
        selector: requestedSelector,
        probedSelectors: selectorsToProbe,
        record: null,
        error: `DKIM record not found under selector '${requestedSelector}' (also probed common selectors: ${COMMON_DKIM_SELECTORS.join(", ")}).`
      };
    }

    // 7. BIMI Record (default._bimi.domain)
    try {
      const bimiTxt = await dns.resolveTxt(`default._bimi.${cleanDomain}`);
      const flatBimi = bimiTxt.flat();
      const bimiRecord = flatBimi.find(t => t.startsWith("v=BIMI1"));
      if (bimiRecord) {
        const logoMatch = bimiRecord.match(/l=([^;\s]+)/);
        const vmcMatch = bimiRecord.match(/a=([^;\s]+)/);
        results.bimi = {
          status: "pass",
          record: bimiRecord,
          logoUrl: logoMatch ? logoMatch[1] : null,
          vmcPresent: !!vmcMatch
        };
      } else {
        results.bimi = { status: "not_configured", record: null };
      }
    } catch (e) {
      results.bimi = { status: "not_configured", record: null };
    }

    // 8. Calculate Score and Grade
    let score = 100;
    if (results.spf.status === "fail") score -= 25;
    else if (results.spf.status === "warning") score -= 10;

    if (results.dkim.status === "fail") score -= 25;

    if (results.dmarc.status === "fail") score -= 25;
    else if (results.dmarc.policy === "none") score -= 15;
    else if (results.dmarc.policy === "quarantine") score -= 5;

    if (results.mx.status === "fail") score -= 20;

    if (results.rdns.status === "fail") score -= 15;

    if (results.blacklists.listedCount > 0) {
      score -= Math.min(40, results.blacklists.listedCount * 20);
    }

    score = Math.max(0, Math.min(100, score));
    let grade = "F";
    if (score >= 95) grade = "A+";
    else if (score >= 85) grade = "A";
    else if (score >= 75) grade = "B";
    else if (score >= 60) grade = "C";
    else if (score >= 40) grade = "D";

    results.score = score;
    results.grade = grade;

    // 9. Gemini AI Expert Analysis (Strategic Narrative Only)
    if (!skipAi && process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const mxListFormatted = results.mx.records.length > 0
          ? results.mx.records.map((r: any) => `Priority ${r.priority}: ${r.exchange}`).join(', ')
          : "None found";
        const prompt = `You are an expert Email Deliverability and Domain Infrastructure Consultant.
Provide an executive deliverability analysis and risk assessment based ONLY on the following verified DNS audit data for "${cleanDomain}":
- Audit Timestamp: ${new Date(results.timestamp).toUTCString()}
- Overall Score: ${score}/100, Grade: ${grade}
- SPF Status: ${results.spf.status}, Lookup Count: ${results.spf.lookups}/10, Record: ${results.spf.record || 'None'}
- DKIM Status: ${results.dkim.status}, Queried Selector: ${results.dkim.selector}, Discovered Selector: ${results.dkim.detectedSelector || 'None'}, Key: ${results.dkim.record ? 'Published (' + results.dkim.keySize + ')' : 'None'}
- DMARC Status: ${results.dmarc.status}, Policy: p=${results.dmarc.policy}, Enforcement: ${results.dmarc.pct}%, RUA: ${results.dmarc.rua || 'None'}
- MX Routing: Status: ${results.mx.status}, Primary Host: ${primaryMxHost || 'None'}, Primary IP: ${primaryMxIp || 'None'}, Verified Records: [${mxListFormatted}]
- Reverse DNS (PTR): Status: ${results.rdns.status}, IP: ${results.rdns.ip || 'None'}, PTR Hostname: ${results.rdns.ptr || 'None'}, FCrDNS Match: ${results.rdns.fcrdns ? 'Yes' : 'No'}
- Blocklists (DNSBL): Clean: ${results.blacklists.clean}, Sending IP Checked: ${results.blacklists.ipChecked || 'None'}, Listed Count: ${results.blacklists.listedCount}
- BIMI Status: ${results.bimi.status}

CRITICAL RULES:
1. DO NOT fabricate, guess, or list any DNS records, IPs, or MX hosts that are not explicitly provided above. The technical DNS records table is rendered separately by our verified system template; your role is strictly high-level strategic interpretation.
2. DO NOT include any document title, date header, author name, or markdown metadata block (e.g., do NOT output "Date: ..."). Begin immediately with Section 1.
3. Structure your response into exactly three clear sections:
   ### 1. Executive Deliverability & Reputation Summary
   (A 2-3 paragraph strategic assessment of inbox placement health, SPF/DMARC alignment status, and risk level with Gmail, Yahoo, and Microsoft 365).
   ### 2. Major Inbox Provider Impact
   (Specific evaluation against Gmail & Yahoo 2024 bulk sender mandates and Microsoft SmartScreen requirements).
   ### 3. Priority Action Plan
   (Bullet points of prioritized, practical business steps to reach or maintain 100% inbox placement).`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });

        let cleaned = (response.text || "").trim();
        // Post-processing defense: Strip any hallucinated date lines or metadata headers
        cleaned = cleaned.replace(/^(#+\s*)?(Audit\s+)?Date:\s*[^\n]+\n+/gmi, "");
        cleaned = cleaned.replace(/^(#+\s*)?(Domain|Target|Author|Report):\s*[^\n]+\n+/gmi, "");
        results.aiAnalysis = cleaned.trim();
      } catch (aiErr) {
        console.error("Gemini AI analysis error:", aiErr);
        results.aiAnalysis = "AI audit recommendations currently unavailable.";
      }
    } else {
      results.aiAnalysis = null;
    }

    res.json(results);
  } catch (err: any) {
    console.error("Domain check error:", err);
    res.status(500).json({ error: err.message || "Failed to analyze domain" });
  }
});

// API: Analyze Email Content (Spam trigger words & text-to-image ratio)
app.post("/api/analyze-content", async (req, res) => {
  const { subject, body, htmlContent } = req.body;
  if (!body && !htmlContent) {
    return res.status(400).json({ error: "Email body or HTML content is required" });
  }

  const textToAnalyze = body || htmlContent || "";

  // Simple heuristic checks
  const imgTags = (textToAnalyze.match(/<img[^>]*>/gi) || []).length;
  const wordCount = textToAnalyze.replace(/<[^>]*>/g, "").split(/\s+/).filter(Boolean).length;
  const hasHtml = !!htmlContent;

  let spamScore = 0;
  const detectedTriggers: string[] = [];
  const commonSpamWords = ["free", "guarantee", "act now", "limited time", "cash", "winner", "congratulations", "urgent", "no obligation", "risk-free", "make money", "100%", "click here", "buy now"];

  const lowerText = textToAnalyze.toLowerCase();
  for (const word of commonSpamWords) {
    if (lowerText.includes(word)) {
      spamScore += 8;
      detectedTriggers.push(word);
    }
  }

  let aiContentAnalysis = null;
  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Analyze this email content for spam deliverability risks, text-to-image ratio concerns, and conversion optimization:
Subject: ${subject || "N/A"}
Body: ${textToAnalyze.substring(0, 3000)}

Provide:
1. Deliverability Risk Level (Low, Medium, High)
2. Spam trigger words or phrases found.
3. Constructive rewritten subject lines or body snippets to improve inbox placement.
4. Estimated text-to-image ratio assessment.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      aiContentAnalysis = response.text;
    } catch (e) {
      aiContentAnalysis = "AI content analysis unavailable.";
    }
  }

  res.json({
    wordCount,
    imgCount: imgTags,
    spamScore: Math.min(100, spamScore),
    detectedTriggers,
    aiContentAnalysis
  });
});

// Native Email/Password Authentication Endpoints (Zero Firebase Dependencies)
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password || password.length < 6) {
      return res.status(400).json({ error: "A valid email and password (minimum 6 characters) are required." });
    }

    const newUser = await createPasswordUser(email, password);
    const token = generateToken({ uid: newUser.uid, email: newUser.email });

    res.json({
      token,
      user: {
        uid: newUser.uid,
        email: newUser.email,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    const msg = error.message && error.message.includes("already exists") 
      ? "An account with this email already exists."
      : "Unable to create account. Please check your information and try again.";
    res.status(400).json({ error: msg });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await verifyUserPassword(email, password);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = generateToken({ uid: user.uid, email: user.email });

    res.json({
      token,
      user: {
        uid: user.uid,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Invalid email or password, or service temporarily unavailable." });
  }
});

// Cloud SQL (PostgreSQL) User Endpoints
app.post("/api/users/sync", requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email || "";
    if (!uid) {
      return res.status(400).json({ error: "Missing user identifier." });
    }
    const syncedUser = await getOrCreateUser(uid, email);
    res.json({ user: syncedUser });
  } catch (error: any) {
    console.error("User sync error:", error);
    res.status(500).json({ error: error.message || "Failed to synchronize user." });
  }
});

app.get("/api/users/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(400).json({ error: "Missing user identifier." });
    }
    const user = await getUserByUid(uid);
    res.json({ user });
  } catch (error: any) {
    console.error("Fetch user error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch user profile." });
  }
});

// Cloud SQL (PostgreSQL) Audit Endpoints
app.post(["/api/audits", "/api/audits/"], requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { domain, score, grade, resultData } = req.body;
    if (!domain || score === undefined || !grade || !resultData) {
      return res.status(400).json({ error: "Missing required audit fields: domain, score, grade, resultData" });
    }

    // Ensure user exists in users table before inserting audit to maintain foreign key integrity
    await getOrCreateUser(uid, req.user?.email || "");

    const audit = await saveAudit({
      userId: uid,
      domain: String(domain),
      score: Number(score),
      grade: String(grade),
      resultData: typeof resultData === "string" ? resultData : JSON.stringify(resultData),
    });

    res.json({ audit });
  } catch (error: any) {
    console.error("Save audit error:", error);
    res.status(500).json({ error: error.message || "Failed to save audit record." });
  }
});

app.get(["/api/audits", "/api/audits/"], requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userAudits = await getAuditsByUserId(uid, req.user?.email);
    res.json({ audits: userAudits });
  } catch (error: any) {
    console.error("Get audits error:", error);
    res.status(500).json({ error: error.message || "Failed to retrieve audit history." });
  }
});

// Clear all audits for current user (supports both DELETE and POST for maximum client compatibility)
const handleClearAllAudits = async (req: AuthRequest, res: any) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const count = await clearAllAuditsByUserId(uid, req.user?.email);
    res.json({ success: true, count, message: `Successfully cleared ${count} audit records.` });
  } catch (error: any) {
    console.error("Clear all audits error:", error);
    res.status(500).json({ error: error.message || "Failed to clear all audit records." });
  }
};

app.delete(["/api/audits", "/api/audits/", "/api/audits/all", "/api/audits/all/"], requireAuth, handleClearAllAudits);
app.post(["/api/audits/clear-all", "/api/audits/clear-all/", "/api/audits/clear", "/api/audits/clear/"], requireAuth, handleClearAllAudits);

app.delete(["/api/audits/:id", "/api/audits/:id/"], requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid audit ID" });
    }

    const success = await deleteAuditById(id, uid, req.user?.email);
    if (!success) {
      return res.status(404).json({ error: "Audit not found or access denied." });
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error("Delete audit error:", error);
    res.status(500).json({ error: error.message || "Failed to delete audit record." });
  }
});

function sanitizeUnicodeJson(str: string): string {
  if (!str) return "";
  return str
    .replace(/[\u2011\u2012\u2013\u2014\u2015]/g, "-") // Non-breaking & en/em dashes to standard hyphen
    .replace(/[\u2018\u2019]/g, "'") // Smart single quotes to standard single quote
    .replace(/[\u201C\u201D]/g, '"') // Smart double quotes to standard double quote
    .replace(/[\u202F\u00A0\u2000-\u200B]/g, " ") // Non-breaking & narrow spaces to standard space
    .trim();
}

function extractJsonFromPayload(raw: any): any {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    if (raw.frontDeskScript || raw.ownerScript || raw.domain) return raw;
  }
  let str = String(raw).trim();
  str = sanitizeUnicodeJson(str);
  try {
    return JSON.parse(str);
  } catch {}

  // Strip markdown codeblock ```json ... ```
  const mdMatch = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (mdMatch) {
    try {
      return JSON.parse(sanitizeUnicodeJson(mdMatch[1].trim()));
    } catch {}
  }

  // Find outermost { and }
  const first = str.indexOf('{');
  const last = str.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(sanitizeUnicodeJson(str.slice(first, last + 1)));
    } catch {}
  }

  return null;
}

function extractFromGroqError(err: any): any {
  if (!err) return null;
  if (err?.error?.failed_generation) {
    const res = extractJsonFromPayload(err.error.failed_generation);
    if (res) return res;
  }
  if (err?.failed_generation) {
    const res = extractJsonFromPayload(err.failed_generation);
    if (res) return res;
  }
  const rawMsg = err?.message || String(err);
  // Clean potential escaped quote encodings like \x27 in error messages
  const msg = rawMsg.replace(/\\x27/g, "'").replace(/\\x22/g, '"');
  const firstBrace = msg.indexOf('{');
  const lastBrace = msg.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(sanitizeUnicodeJson(msg.slice(firstBrace, lastBrace + 1)));
      if (parsed?.error?.failed_generation) {
        const res = extractJsonFromPayload(parsed.error.failed_generation);
        if (res) return res;
      }
      if (parsed?.failed_generation) {
        const res = extractJsonFromPayload(parsed.failed_generation);
        if (res) return res;
      }
    } catch {}
  }
  return null;
}

// Groq-powered Phone Call Outreach Generator Endpoint
// Keeps Groq API key strictly server-side and never exposed to client
app.post(["/api/outreach/generate", "/api/outreach/generate/"], async (req, res) => {
  try {
    const { domain, companyName, officeManagerName, callerName, callStyle, auditData } = req.body;
    if (!domain || typeof domain !== "string") {
      return res.status(400).json({ error: "A valid domain is required." });
    }

    const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const businessName = (companyName || cleanDomain.split('.')[0].toUpperCase()).trim();
    const managerTarget = (officeManagerName || "Office Manager / Decision Maker").trim();
    const caller = (callerName || "Deliverability Consultant").trim();
    const style = callStyle || "consultative";

    let auditSummary = "";
    if (auditData) {
      auditSummary = `Domain: ${cleanDomain}
Overall Score: ${auditData.score ?? 'N/A'}/100 (Grade: ${auditData.grade ?? 'N/A'})
SPF Record: ${auditData.spf?.status ?? 'Unknown'} (Lookups: ${auditData.spf?.lookups ?? 0}, Warnings: ${(auditData.spf?.warnings || []).join('; ') || 'None'})
DKIM Record: ${auditData.dkim?.status ?? 'Unknown'}
DMARC Record: ${auditData.dmarc?.status ?? 'Unknown'} (Policy: ${auditData.dmarc?.policy ?? 'none'})
BIMI Record: ${auditData.bimi?.status ?? 'Unknown'}
Blacklist Status: ${auditData.blacklists?.clean ? 'Clean' : `${auditData.blacklists?.listedCount} active blacklist listing(s)`}
MX Mail Provider: ${auditData.mx?.records?.[0]?.exchange ?? 'None'}`;
    } else {
      auditSummary = `Domain: ${cleanDomain} (Standard deliverability assessment for ${cleanDomain})`;
    }

    const prompt = `You are a world-class B2B cold calling coach specializing in email deliverability and domain security.
Generate an exhaustive, high-converting, professional, PHONE CALL ONLY battlecard for calling ${businessName} (${cleanDomain}).

CRITICAL REQUIREMENTS:
1. PHONE CALL OUTREACH ONLY: Do NOT generate email copy, templates, or LinkedIn messages. Every section is strictly for live telephone conversations.
2. TWO-TIER PHONE WORKFLOW:
   - Part 1: FRONT DESK / RECEPTIONIST GATEKEEPER SCRIPT
     * Purpose: Ethically navigate past the receptionist/gatekeeper to get transferred directly to ${managerTarget}.
     * Tone: Professional, polite, urgent operational notice (NOT a telemarketer or aggressive salesperson).
     * Must explain why emailing is useless (their emails are already dropping/failing) so the receptionist puts the call through.
     * Include word-for-word opening line, plain-English reason for calling, transfer ask, and exact rebuttals for 4 common gatekeeper pushbacks:
       1. "Can you just email it?"
       2. "We have an IT company / tech person."
       3. "Is this a sales pitch?"
       4. "They are busy / not available right now."
   - Part 2: OWNER / OFFICE MANAGER SCRIPT
     * Purpose: Once connected with ${managerTarget} or the business owner, explain the audit findings in plain, non-technical English that an everyday business owner immediately understands.
     * Use vivid, everyday analogies (e.g., sending tax forms on an unsealed postcard, an invalid passport at airport customs, quotes landing silently in junk folders).
     * Connect every technical finding directly to lost customer inquiries, missed invoices, damaged reputation, or domain spoofing.
     * Include a 30-second pattern interrupt opener, layman breakdown of the audit issues, 2-3 probing diagnostic questions, a low-friction closing ask (e.g. 10-minute remediation review or 1-page health report), and exact rebuttals for:
       1. "Everything seems fine on our end / we aren't having issues."
       2. "Our IT guy or webmaster handles this."
       3. "How much does this cost?"
   - Part 3: VOICEMAIL SCRIPT
     * A high-curiosity 20-second voicemail for ${managerTarget} prompting a callback.
3. FORMATTING: Use standard ASCII quotes and punctuation. Avoid non-breaking spaces or em-dashes.

Audit Details for ${cleanDomain}:
${auditSummary}

Target Information:
- Caller: ${caller}
- Business Name: ${businessName}
- Decision Maker Title: ${managerTarget}

Return ONLY a valid JSON object matching this schema:
{
  "domain": "${cleanDomain}",
  "companyName": "${businessName}",
  "auditSummaryPlainEnglish": "Concise 2-3 sentence layman explanation of why their emails are dropping into spam or failing security checks, and how it hurts their business.",
  "frontDeskScript": {
    "targetRole": "Front Desk / Receptionist",
    "goal": "Navigate past the receptionist to get transferred directly to ${managerTarget}",
    "opener": "Exact word-for-word greeting and opening line",
    "reasonForCalling": "Urgent, non-technical explanation tailored to the receptionist why this matters",
    "transferAsk": "Direct request to be connected to ${managerTarget}",
    "objections": [
      { "pushback": "Can you just email the info?", "rebuttal": "Exact rebuttal" },
      { "pushback": "We have an IT company.", "rebuttal": "Exact rebuttal" },
      { "pushback": "Is this a sales call?", "rebuttal": "Exact rebuttal" },
      { "pushback": "The manager is busy / away.", "rebuttal": "Exact rebuttal" }
    ]
  },
  "ownerScript": {
    "targetRole": "${managerTarget} / Business Owner",
    "goal": "Hook the decision maker, explain the audit in simple terms, and secure a 10-minute review",
    "opener30Sec": "30-second pattern interrupt opening",
    "plainEnglishBreakdown": [
      {
        "technicalIssue": "Name of issue (e.g. SPF Lookups or DMARC)",
        "plainEnglishAnalogy": "Simple analogy any non-technical person grasps instantly",
        "businessImpact": "Specific business risk (e.g. losing customer inquiries to spam)"
      }
    ],
    "diagnosticQuestions": [
      "Diagnostic question 1",
      "Diagnostic question 2"
    ],
    "closingCta": "Exact closing line to schedule a quick fix or send the 1-page report",
    "objections": [
      { "pushback": "We are not having any issues.", "rebuttal": "Exact rebuttal explaining silent spam filtering" },
      { "pushback": "Our IT guy handles this.", "rebuttal": "Exact rebuttal offering the 1-page IT remediation sheet" },
      { "pushback": "How much does this cost?", "rebuttal": "Exact rebuttal on pricing / no-obligation review" }
    ]
  },
  "voicemailScript": {
    "duration": "20 seconds",
    "script": "High-curiosity voicemail script"
  }
}`;

    let script: any = null;

    // Strategy 1: Groq with primary model openai/gpt-oss-120b in raw JSON mode
    try {
      const completion = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: "You are an elite B2B cold calling specialist. You output strict raw JSON only. Do not wrap in markdown or commentary." },
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 4000,
      });
      const rawContent = completion.choices[0]?.message?.content || "";
      script = extractJsonFromPayload(rawContent);
    } catch (primaryErr: any) {
      console.warn("Groq primary model failed or threw:", primaryErr?.message);
      // Attempt recovery from failed_generation if Groq returned partial/raw payload
      script = extractFromGroqError(primaryErr);
    }

    // Strategy 2: If primary didn't succeed, call qwen/qwen3.8-27b in raw JSON mode
    if (!script) {
      try {
        console.log("Attempting Groq fallback model qwen/qwen3.8-27b without response_format constraint...");
        const completion = await groq.chat.completions.create({
          model: "qwen/qwen3.8-27b",
          messages: [
            { role: "system", content: "You are an elite B2B cold calling specialist. Respond with a valid JSON object only. Do not wrap in markdown or commentary." },
            { role: "user", content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 4000,
        });
        const rawContent = completion.choices[0]?.message?.content || "";
        script = extractJsonFromPayload(rawContent);
      } catch (fallbackErr: any) {
        console.warn("Groq fallback model failed:", fallbackErr?.message);
        script = extractFromGroqError(fallbackErr);
      }
    }

    // Strategy 3: If Groq had an outage or rate-limit, fallback to Gemini API
    if (!script) {
      try {
        console.log("Attempting Gemini fallback for outreach generation...");
        const ai = new GoogleGenAI({});
        const geminiRes = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0.3,
          }
        });
        const text = geminiRes.text || "";
        script = extractJsonFromPayload(text);
      } catch (geminiErr: any) {
        console.error("Gemini fallback also failed:", geminiErr);
      }
    }

    if (!script) {
      throw new Error("Unable to parse outreach script from AI models. Please try again.");
    }

    res.json({ success: true, script });
  } catch (err: any) {
    console.error("Outreach generation error:", err?.message || err);
    res.status(500).json({ error: "Failed to generate phone outreach script." });
  }
});

// Cloud SQL (PostgreSQL) Saved Outreach Battlecards Endpoints
app.post(["/api/outreach/save", "/api/outreach/save/"], requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { domain, companyName, grade, score, scriptData } = req.body;
    if (!domain || !scriptData) {
      return res.status(400).json({ error: "Missing required fields: domain, scriptData" });
    }

    await getOrCreateUser(uid, req.user?.email || "");

    const saved = await saveOutreachScript({
      userId: uid,
      domain: String(domain),
      companyName: companyName ? String(companyName) : undefined,
      grade: grade ? String(grade) : undefined,
      score: score !== undefined ? Number(score) : undefined,
      scriptData: typeof scriptData === "string" ? scriptData : JSON.stringify(scriptData),
    });

    res.json({ success: true, savedScript: saved });
  } catch (error: any) {
    console.error("Save outreach script error:", error);
    res.status(500).json({ error: error.message || "Failed to save outreach script." });
  }
});

app.get(["/api/outreach", "/api/outreach/"], requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const scripts = await getOutreachScriptsByUserId(uid);
    res.json({ scripts });
  } catch (error: any) {
    console.error("Get outreach scripts error:", error);
    res.status(500).json({ error: error.message || "Failed to retrieve outreach scripts." });
  }
});

app.delete(["/api/outreach/:id", "/api/outreach/:id/"], requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid script ID" });
    }

    const success = await deleteOutreachScriptById(id, uid);
    if (!success) {
      return res.status(404).json({ error: "Script not found or access denied." });
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error("Delete outreach script error:", error);
    res.status(500).json({ error: error.message || "Failed to delete outreach script." });
  }
});

// ==========================================
// ROLE-BASED CALLER AUTH & LEAD DISTRIBUTION
// Dynamic team caller authentication via assigned passcode
app.post(["/api/caller/login", "/api/caller/login/"], async (req, res) => {
  try {
    const { name, email, code } = req.body;
    if (!code) {
      return res.status(400).json({ error: "Access passcode is required to sign in as a caller." });
    }

    const caller = await verifyCallerLogin(name, email, code);
    if (!caller) {
      return res.status(401).json({ 
        error: "Invalid caller passcode. Please verify your assigned access code." 
      });
    }

    const token = generateCallerToken({
      callerKey: caller.callerKey,
      name: caller.name,
      email: caller.email || email,
    });

    res.json({
      success: true,
      token,
      caller: {
        callerKey: caller.callerKey,
        name: caller.name,
        email: caller.email || email,
      },
    });
  } catch (error: any) {
    console.error("Caller login error:", error);
    res.status(500).json({ error: error.message || "Failed to authenticate caller." });
  }
});

app.get(["/api/caller/callers", "/api/caller/callers/"], async (req, res) => {
  try {
    const list = await getRegisteredCallers();
    res.json({ callers: list });
  } catch (error: any) {
    res.json({ callers: [] });
  }
});

app.get(["/api/caller/me", "/api/caller/me/"], requireAuth, async (req: AuthRequest, res) => {
  res.json({
    caller: {
      callerKey: req.user?.callerKey,
      name: req.user?.callerName,
      email: req.user?.email,
      uid: req.user?.uid,
    },
  });
});

// Distribute leads equally across callers without duplicates (25 leads each)
app.post(["/api/leads/distribute", "/api/leads/distribute/"], async (req, res) => {
  try {
    const { leads, leadsPerCaller, assignerEmail } = req.body;
    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: "Please provide an array of audited domain leads to distribute." });
    }

    const quota = typeof leadsPerCaller === 'number' && leadsPerCaller > 0 ? leadsPerCaller : 25;
    const effectiveAssigner = assignerEmail || (req as any).user?.email || "team-admin@company.com";
    const result = await distributeLeadsEqually(leads, quota, effectiveAssigner);
    res.json(result);
  } catch (error: any) {
    console.error("Distribute leads error:", error);
    res.status(500).json({ error: error.message || "Failed to distribute leads." });
  }
});

app.get(["/api/leads/assigner", "/api/leads/assigner/"], async (req, res) => {
  res.json({
    mainAssignerEmail: (req as any).user?.email || "team-admin@company.com",
    role: "Lead Distribution Manager",
  });
});

// Get assigned leads for the logged-in caller
app.get(["/api/leads/my-queue", "/api/leads/my-queue/"], async (req: any, res) => {
  try {
    let callerKey = req.query.callerKey as string;
    
    // Check Authorization header token if callerKey not in query
    if (!callerKey && req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace(/^Bearer\s+/, '').trim();
        const jwt = (await import("jsonwebtoken")).default;
        const decoded = jwt.decode(token) as any;
        if (decoded?.callerKey) {
          callerKey = decoded.callerKey;
        }
      } catch {}
    }

    if (!callerKey) {
      return res.status(400).json({ error: "Caller identification is required." });
    }

    const leads = await getLeadsForCaller(callerKey);
    res.json({ callerKey, leads, total: leads.length });
  } catch (error: any) {
    console.error("Get caller leads error:", error);
    res.status(500).json({ error: error.message || "Failed to retrieve caller leads." });
  }
});

// Get all lead assignments across all 4 callers for admin overview
app.get(["/api/leads/all-assigned", "/api/leads/all-assigned/"], async (req, res) => {
  try {
    const allLeads = await getAllAssignedLeads();
    
    // Group dynamically by caller
    const grouped: Record<string, any[]> = {};
    const counts: Record<string, number> = {};
    for (const lead of allLeads) {
      if (!grouped[lead.callerKey]) {
        grouped[lead.callerKey] = [];
      }
      grouped[lead.callerKey].push(lead);
    }
    for (const key of Object.keys(grouped)) {
      counts[key] = grouped[key].length;
    }

    res.json({
      total: allLeads.length,
      grouped,
      counts,
    });
  } catch (error: any) {
    console.error("Get all assigned leads error:", error);
    res.status(500).json({ error: error.message || "Failed to retrieve assigned leads." });
  }
});

// Update call outcome status and notes for a lead (POST and PATCH supported)
app.post(["/api/leads/update-status", "/api/leads/update-status/"], async (req, res) => {
  try {
    const { id, status, notes } = req.body;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return res.status(400).json({ error: "Invalid lead ID" });
    }
    if (!status) {
      return res.status(400).json({ error: "Status is required." });
    }

    const updated = await updateLeadStatus(numId, status, notes);
    res.json({ success: true, lead: updated });
  } catch (error: any) {
    console.error("Update lead status error:", error);
    res.status(500).json({ error: error.message || "Failed to update lead status." });
  }
});

app.patch(["/api/leads/:id/status", "/api/leads/:id/status/"], async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid lead ID" });
    }
    const { status, notes } = req.body;
    if (!status) {
      return res.status(400).json({ error: "Status is required." });
    }

    const updated = await updateLeadStatus(id, status, notes);
    res.json({ success: true, lead: updated });
  } catch (error: any) {
    console.error("Update lead status error:", error);
    res.status(500).json({ error: error.message || "Failed to update lead status." });
  }
});

// Clear lead assignments to start a new campaign batch
app.post(["/api/leads/clear", "/api/leads/clear/"], async (req, res) => {
  try {
    const count = await clearAllLeadAssignments();
    res.json({ success: true, clearedCount: count });
  } catch (error: any) {
    console.error("Clear lead assignments error:", error);
    res.status(500).json({ error: error.message || "Failed to clear lead assignments." });
  }
});

// API health check endpoints
app.get(["/api", "/api/", "/api/health", "/api/health/"], (req, res) => {
  res.json({
    status: "ok",
    service: "DNSDeliver Audit API",
    time: new Date().toISOString(),
    isVercel: Boolean(process.env.VERCEL),
  });
});

// Guard: Ensure ANY unmatched /api/* route ALWAYS returns a JSON 404, never falling into Vite/HTML
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

export default app;

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Initialize callers in the background so port binding is never delayed
    ensureCallersInitialized()
      .then(() => console.log("Fixed caller roles initialized successfully."))
      .catch((err) => console.warn("Caller initialization notice:", err));
  });
}

// Only launch standalone HTTP listener when not running in Vercel serverless environment
if (!process.env.VERCEL) {
  startServer();
}
