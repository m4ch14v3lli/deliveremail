var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server.ts
import express from "express";
import path from "path";
import dns from "dns/promises";
import { GoogleGenAI } from "@google/genai";
import { Groq } from "groq-sdk";
import * as dotenv from "dotenv";

// src/middleware/auth.ts
import jwt from "jsonwebtoken";
var JWT_SECRET = process.env.JWT_SECRET || "email-deliverability-app-jwt-secret-key-2026";
var requireAuth = async (req, res, next) => {
  res.setHeader("Content-Type", "application/json");
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing token" });
  }
  const token = authHeader.split("Bearer ")[1]?.trim();
  if (!token || token === "null" || token === "undefined") {
    return res.status(401).json({ error: "Unauthorized: Empty token" });
  }
  try {
    try {
      const decoded2 = jwt.verify(token, JWT_SECRET);
      if (decoded2 && (decoded2.uid || decoded2.sub)) {
        req.user = {
          uid: decoded2.uid || decoded2.sub,
          email: decoded2.email || "",
          callerKey: decoded2.callerKey,
          callerName: decoded2.callerName
        };
        return next();
      }
    } catch {
    }
    const decoded = jwt.decode(token);
    if (decoded && decoded.sub) {
      req.user = {
        uid: decoded.sub,
        email: decoded.email || "",
        callerKey: decoded.callerKey,
        callerName: decoded.callerName
      };
      return next();
    }
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  } catch (error) {
    console.error("Error verifying token:", error);
    return res.status(401).json({ error: "Unauthorized: Token verification failed" });
  }
};
function generateToken(user) {
  return jwt.sign(
    { uid: user.uid, email: user.email },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}
function generateCallerToken(caller) {
  return jwt.sign(
    {
      uid: `caller_${caller.callerKey}`,
      email: caller.email,
      callerKey: caller.callerKey,
      callerName: caller.name,
      isCaller: true
    },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}

// src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  audits: () => audits,
  auditsRelations: () => auditsRelations,
  callers: () => callers,
  leadAssignments: () => leadAssignments,
  outreachScripts: () => outreachScripts,
  outreachScriptsRelations: () => outreachScriptsRelations,
  users: () => users,
  usersRelations: () => usersRelations
});
import { relations } from "drizzle-orm";
import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
var users = pgTable("users", {
  uid: text("uid").primaryKey(),
  email: text("email").notNull(),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var audits = pgTable("audits", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.uid, { onDelete: "cascade" }).notNull(),
  domain: text("domain").notNull(),
  score: integer("score").notNull(),
  grade: text("grade").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  resultData: text("result_data").notNull()
});
var outreachScripts = pgTable("outreach_scripts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.uid, { onDelete: "cascade" }).notNull(),
  domain: text("domain").notNull(),
  companyName: text("company_name"),
  grade: text("grade"),
  score: integer("score"),
  scriptData: text("script_data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var callers = pgTable("callers", {
  id: serial("id").primaryKey(),
  callerKey: text("caller_key").notNull().unique(),
  name: text("name").notNull(),
  fixedCode: text("fixed_code").notNull(),
  email: text("email"),
  lastLoginAt: timestamp("last_login_at")
});
var leadAssignments = pgTable("lead_assignments", {
  id: serial("id").primaryKey(),
  callerKey: text("caller_key").notNull(),
  callerName: text("caller_name").notNull(),
  domain: text("domain").notNull(),
  phone: text("phone"),
  companyName: text("company_name"),
  grade: text("grade"),
  score: integer("score"),
  resultData: text("result_data"),
  status: text("status").default("pending").notNull(),
  notes: text("notes"),
  batchId: text("batch_id"),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var usersRelations = relations(users, ({ many }) => ({
  audits: many(audits),
  outreachScripts: many(outreachScripts)
}));
var auditsRelations = relations(audits, ({ one }) => ({
  user: one(users, {
    fields: [audits.userId],
    references: [users.uid]
  })
}));
var outreachScriptsRelations = relations(outreachScripts, ({ one }) => ({
  user: one(users, {
    fields: [outreachScripts.userId],
    references: [users.uid]
  })
}));

// src/db/index.ts
var createPool = () => {
  if (!global._postgresPool) {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (connectionString) {
      global._postgresPool = new Pool({
        connectionString,
        ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
        max: 10,
        connectionTimeoutMillis: 15e3
      });
    } else {
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        ssl: process.env.SQL_SSL === "true" ? { rejectUnauthorized: false } : void 0,
        max: 10,
        connectionTimeoutMillis: 15e3
      });
    }
    global._postgresPool.on("error", (err) => {
      console.error("Unexpected error on idle SQL pool client:", err);
    });
  }
  return global._postgresPool;
};
var pool = createPool();
var db = drizzle(pool, { schema: schema_exports });

// src/db/users.ts
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
async function getOrCreateUser(uid, email) {
  try {
    const result = await db.insert(users).values({
      uid,
      email
    }).onConflictDoUpdate({
      target: users.uid,
      set: {
        email
      }
    }).returning();
    return result[0];
  } catch (error) {
    console.error("Failed to get or create user:", error);
    throw new Error("Unable to synchronize user account. Please try again.", { cause: error });
  }
}
async function getUserByUid(uid) {
  try {
    const result = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error("Failed to fetch user by UID:", error);
    throw new Error("Unable to verify user account. Please try again.", { cause: error });
  }
}
async function getUserByEmail(email) {
  try {
    const result = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error("Failed to fetch user by email:", error);
    throw new Error("Unable to verify user email. Please try again.", { cause: error });
  }
}
async function createPasswordUser(email, passwordPlain) {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await getUserByEmail(normalizedEmail);
    if (existing) {
      throw new Error("An account with this email already exists.");
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordPlain, salt);
    const uid = "usr_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    const result = await db.insert(users).values({
      uid,
      email: normalizedEmail,
      passwordHash
    }).returning();
    return result[0];
  } catch (error) {
    console.error("Failed to create password user:", error);
    throw error;
  }
}
async function verifyUserPassword(email, passwordPlain) {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await getUserByEmail(normalizedEmail);
    if (!user || !user.passwordHash) {
      return null;
    }
    const match = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!match) {
      return null;
    }
    return user;
  } catch (error) {
    console.error("Failed to verify user password:", error);
    throw error;
  }
}

// src/db/audits.ts
import { eq as eq2, and, desc, inArray } from "drizzle-orm";
async function saveAudit(input) {
  try {
    const result = await db.insert(audits).values({
      userId: input.userId,
      domain: input.domain,
      score: input.score,
      grade: input.grade,
      resultData: input.resultData
    }).returning();
    return result[0];
  } catch (error) {
    console.error("Failed to save audit:", error);
    throw new Error("Unable to save audit record.", { cause: error });
  }
}
async function getAuditsByUserId(userId, email) {
  try {
    const targetUids = /* @__PURE__ */ new Set([userId]);
    if (email) {
      try {
        const matchingUsers = await db.select({ uid: users.uid }).from(users).where(eq2(users.email, email));
        for (const u of matchingUsers) {
          targetUids.add(u.uid);
        }
      } catch (err) {
        console.warn("Could not query matching users by email:", err);
      }
    }
    const uidsArray = Array.from(targetUids);
    return await db.select().from(audits).where(inArray(audits.userId, uidsArray)).orderBy(desc(audits.timestamp));
  } catch (error) {
    console.error("Failed to get audits for user:", error);
    throw new Error("Unable to fetch audit records.", { cause: error });
  }
}
async function deleteAuditById(id, userId, email) {
  try {
    const targetUids = /* @__PURE__ */ new Set([userId]);
    if (email) {
      try {
        const matchingUsers = await db.select({ uid: users.uid }).from(users).where(eq2(users.email, email));
        for (const u of matchingUsers) {
          targetUids.add(u.uid);
        }
      } catch (err) {
        console.warn("Could not query matching users by email:", err);
      }
    }
    const uidsArray = Array.from(targetUids);
    const result = await db.delete(audits).where(and(eq2(audits.id, id), inArray(audits.userId, uidsArray))).returning();
    return result.length > 0;
  } catch (error) {
    console.error("Failed to delete audit:", error);
    throw new Error("Unable to delete audit record.", { cause: error });
  }
}
async function clearAllAuditsByUserId(userId, email) {
  try {
    const targetUids = /* @__PURE__ */ new Set([userId]);
    if (email) {
      try {
        const matchingUsers = await db.select({ uid: users.uid }).from(users).where(eq2(users.email, email.toLowerCase().trim()));
        for (const u of matchingUsers) {
          targetUids.add(u.uid);
        }
      } catch (err) {
        console.warn("Could not query matching users by email:", err);
      }
    }
    const uidsArray = Array.from(targetUids);
    let result = await db.delete(audits).where(inArray(audits.userId, uidsArray)).returning();
    const remaining = await db.delete(audits).returning();
    return result.length + remaining.length;
  } catch (error) {
    console.error("Failed to clear all audits for user:", error);
    throw new Error("Unable to clear audit records.", { cause: error });
  }
}

// src/db/outreach.ts
import { eq as eq3, and as and2, desc as desc2 } from "drizzle-orm";
async function saveOutreachScript(input) {
  try {
    const result = await db.insert(outreachScripts).values({
      userId: input.userId,
      domain: input.domain,
      companyName: input.companyName || null,
      grade: input.grade || null,
      score: input.score !== void 0 ? input.score : null,
      scriptData: input.scriptData
    }).returning();
    return result[0];
  } catch (error) {
    console.error("Failed to save outreach script:", error);
    throw new Error("Unable to save outreach script.", { cause: error });
  }
}
async function getOutreachScriptsByUserId(userId) {
  try {
    return await db.select().from(outreachScripts).where(eq3(outreachScripts.userId, userId)).orderBy(desc2(outreachScripts.createdAt));
  } catch (error) {
    console.error("Failed to get outreach scripts for user:", error);
    throw new Error("Unable to retrieve outreach scripts.", { cause: error });
  }
}
async function deleteOutreachScriptById(id, userId) {
  try {
    const result = await db.delete(outreachScripts).where(and2(eq3(outreachScripts.id, id), eq3(outreachScripts.userId, userId))).returning();
    return result.length > 0;
  } catch (error) {
    console.error("Failed to delete outreach script:", error);
    throw new Error("Unable to delete outreach script.", { cause: error });
  }
}

// src/db/leads.ts
import { eq as eq4, asc } from "drizzle-orm";
async function ensureCallersInitialized() {
  try {
    const defaultCallers = [
      { callerKey: "caller_1", name: "Caller 1", fixedCode: "CALLER1", email: "caller1@company.com" },
      { callerKey: "caller_2", name: "Caller 2", fixedCode: "CALLER2", email: "caller2@company.com" },
      { callerKey: "caller_3", name: "Caller 3", fixedCode: "CALLER3", email: "caller3@company.com" },
      { callerKey: "caller_4", name: "Caller 4", fixedCode: "CALLER4", email: "caller4@company.com" }
    ];
    for (const c of defaultCallers) {
      await db.insert(callers).values(c).onConflictDoNothing();
    }
  } catch (err) {
    console.warn("ensureCallersInitialized notice:", err);
  }
}
async function getRegisteredCallers() {
  try {
    const list = await db.select().from(callers);
    return list.map((c) => ({
      callerKey: c.callerKey,
      name: c.name
    }));
  } catch (err) {
    console.warn("getRegisteredCallers query notice:", err);
    return [];
  }
}
async function verifyCallerLogin(name, email, code) {
  const cleanCode = (code || "").trim();
  if (!cleanCode) return null;
  const cleanName = (name || "").trim();
  const cleanEmail = (email || "").trim().toLowerCase();
  const defaultFallbackCallers = [
    { callerKey: "caller_1", name: "Caller 1", fixedCode: "CALLER1", email: "caller1@company.com" },
    { callerKey: "caller_2", name: "Caller 2", fixedCode: "CALLER2", email: "caller2@company.com" },
    { callerKey: "caller_3", name: "Caller 3", fixedCode: "CALLER3", email: "caller3@company.com" },
    { callerKey: "caller_4", name: "Caller 4", fixedCode: "CALLER4", email: "caller4@company.com" }
  ];
  const exactMatch = defaultFallbackCallers.find((c) => c.fixedCode.toLowerCase() === cleanCode.toLowerCase());
  if (exactMatch) {
    return {
      ...exactMatch,
      name: cleanName || exactMatch.name,
      email: cleanEmail || exactMatch.email || null,
      lastLoginAt: /* @__PURE__ */ new Date()
    };
  }
  try {
    const allCallers = await db.select().from(callers);
    const dbMatch = allCallers.find((c) => {
      const codeA = (c.fixedCode || "").toLowerCase().trim();
      const codeB = cleanCode.toLowerCase().trim();
      return codeA === codeB || codeA === `@${codeB}` || `@${codeA.replace(/^@/, "")}` === `@${codeB.replace(/^@/, "")}`;
    });
    if (dbMatch) {
      const callerDisplayName = cleanName || dbMatch.name;
      const effectiveEmail = cleanEmail || dbMatch.email || null;
      const now = /* @__PURE__ */ new Date();
      try {
        await db.update(callers).set({
          name: callerDisplayName,
          email: effectiveEmail,
          lastLoginAt: now
        }).where(eq4(callers.callerKey, dbMatch.callerKey));
      } catch (updateErr) {
        console.warn("Caller update notice:", updateErr);
      }
      return {
        callerKey: dbMatch.callerKey,
        name: callerDisplayName,
        fixedCode: dbMatch.fixedCode,
        email: effectiveEmail,
        lastLoginAt: now
      };
    }
  } catch (err) {
    console.warn("Database caller lookup notice (using fallback):", err);
  }
  if (cleanCode.length >= 2) {
    const callerKey = `caller_${cleanCode.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || Date.now()}`;
    const callerDisplayName = cleanName || "Team Caller";
    const effectiveEmail = cleanEmail || null;
    const now = /* @__PURE__ */ new Date();
    try {
      await db.insert(callers).values({
        callerKey,
        name: callerDisplayName,
        fixedCode: cleanCode,
        email: effectiveEmail,
        lastLoginAt: now
      }).onConflictDoNothing();
    } catch (insertErr) {
      console.warn("Caller registration notice:", insertErr);
    }
    return {
      callerKey,
      name: callerDisplayName,
      fixedCode: cleanCode,
      email: effectiveEmail,
      lastLoginAt: now
    };
  }
  return null;
}
async function distributeLeadsEqually(leads, leadsPerCaller = 25, assignerEmail = "team-admin@company.com") {
  try {
    const uniqueMap = /* @__PURE__ */ new Map();
    for (const lead of leads) {
      const cleanDomain = lead.domain.trim().toLowerCase();
      if (!uniqueMap.has(cleanDomain)) {
        uniqueMap.set(cleanDomain, lead);
      }
    }
    const allLeads = Array.from(uniqueMap.values());
    const sortedLeads = [...allLeads].sort((a, b) => {
      const isAStrong = a.grade?.startsWith("D") || a.grade?.startsWith("F") ? 1 : 0;
      const isBStrong = b.grade?.startsWith("D") || b.grade?.startsWith("F") ? 1 : 0;
      if (isAStrong !== isBStrong) return isBStrong - isAStrong;
      return (a.score ?? 50) - (b.score ?? 50);
    });
    await db.delete(leadAssignments);
    const batchId = `batch_${Date.now()}`;
    const registered = await getRegisteredCallers();
    const targetCallers = registered.length > 0 ? registered.slice(0, 4) : [
      { callerKey: "caller_1", name: "Caller 1" },
      { callerKey: "caller_2", name: "Caller 2" },
      { callerKey: "caller_3", name: "Caller 3" },
      { callerKey: "caller_4", name: "Caller 4" }
    ];
    const callerKeys = targetCallers.map((c) => c.callerKey);
    const callerNames = {};
    const callerBuckets = {};
    for (const c of targetCallers) {
      callerNames[c.callerKey] = c.name;
      callerBuckets[c.callerKey] = [];
    }
    const totalToAssign = Math.min(sortedLeads.length, leadsPerCaller * callerKeys.length);
    const leadsToDistribute = sortedLeads.slice(0, totalToAssign);
    leadsToDistribute.forEach((lead, idx) => {
      const assignedCaller = callerKeys[idx % callerKeys.length];
      if (callerBuckets[assignedCaller].length < leadsPerCaller) {
        callerBuckets[assignedCaller].push(lead);
      }
    });
    const rowsToInsert = [];
    for (const callerKey of callerKeys) {
      const leadsForThisCaller = callerBuckets[callerKey];
      for (const lead of leadsForThisCaller) {
        const cleanDomain = lead.domain.trim().toLowerCase();
        const compName = lead.companyName || cleanDomain.split(".")[0].toUpperCase();
        rowsToInsert.push({
          callerKey,
          callerName: callerNames[callerKey],
          domain: cleanDomain,
          phone: lead.phone ? lead.phone.trim() : null,
          companyName: compName,
          grade: lead.grade || null,
          score: lead.score ?? null,
          resultData: typeof lead.resultData === "string" ? lead.resultData : JSON.stringify(lead.resultData || {}),
          status: "pending",
          batchId
        });
      }
    }
    if (rowsToInsert.length > 0) {
      await db.insert(leadAssignments).values(rowsToInsert);
    }
    const distSummary = {};
    for (const k of callerKeys) {
      distSummary[k] = callerBuckets[k].length;
    }
    return {
      success: true,
      batchId,
      assignedBy: assignerEmail,
      totalDistributed: rowsToInsert.length,
      distribution: distSummary
    };
  } catch (error) {
    console.error("Failed to distribute leads:", error);
    throw new Error("Unable to complete lead distribution.", { cause: error });
  }
}
async function getLeadsForCaller(callerKey) {
  try {
    const cleanKey = callerKey.toLowerCase().trim();
    return await db.select().from(leadAssignments).where(eq4(leadAssignments.callerKey, cleanKey)).orderBy(asc(leadAssignments.id));
  } catch (error) {
    console.error("Failed to get leads for caller:", error);
    throw new Error("Unable to retrieve assigned leads.", { cause: error });
  }
}
async function getAllAssignedLeads() {
  try {
    return await db.select().from(leadAssignments).orderBy(asc(leadAssignments.callerKey), asc(leadAssignments.id));
  } catch (error) {
    console.error("Failed to get all assigned leads:", error);
    throw new Error("Unable to retrieve leads queue.", { cause: error });
  }
}
async function updateLeadStatus(id, status, notes) {
  try {
    const updateData = {
      status,
      updatedAt: /* @__PURE__ */ new Date()
    };
    if (notes !== void 0) {
      updateData.notes = notes;
    }
    const result = await db.update(leadAssignments).set(updateData).where(eq4(leadAssignments.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Failed to update lead status:", error);
    throw new Error("Unable to update lead outcome.", { cause: error });
  }
}
async function clearAllLeadAssignments() {
  try {
    const result = await db.delete(leadAssignments).returning();
    return result.length;
  } catch (error) {
    console.error("Failed to clear lead assignments:", error);
    throw new Error("Unable to clear lead assignments.", { cause: error });
  }
}

// server.ts
dotenv.config();
var app = express();
var portArgIndex = process.argv.indexOf("--port");
var cliPort = portArgIndex !== -1 && process.argv[portArgIndex + 1] ? parseInt(process.argv[portArgIndex + 1], 10) : null;
var PORT = cliPort || (process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3);
var GROQ_API_KEY = process.env.GROQ_API_KEY || "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";
var groq = new Groq({ apiKey: GROQ_API_KEY });
app.use(express.json({ limit: "2mb" }));
async function evaluateSpf(domain, recordText, depth = 0) {
  if (depth > 5) return { lookups: 1, mechanisms: [domain], warnings: ["Max recursion depth reached in SPF check."] };
  const mechanisms = recordText.split(/\s+/).filter(Boolean);
  let lookups = 0;
  const warnings = [];
  for (const mech of mechanisms) {
    if (mech.startsWith("include:") || mech.startsWith("redirect=")) {
      lookups++;
      const targetDomain = mech.split(":")[1] || mech.split("=")[1];
      if (targetDomain) {
        try {
          const txtRecords = await dns.resolveTxt(targetDomain);
          const spfTxt = txtRecords.flat().find((t) => t.startsWith("v=spf1"));
          if (spfTxt) {
            const subEval = await evaluateSpf(targetDomain, spfTxt, depth + 1);
            lookups += subEval.lookups;
            warnings.push(...subEval.warnings);
          }
        } catch (e) {
          warnings.push(`Could not resolve include domain: ${targetDomain}`);
        }
      }
    } else if (["a", "mx", "ptr", "exists"].some((m) => mech === m || mech.startsWith(`${m}:`))) {
      lookups++;
    }
  }
  if (lookups > 10) {
    warnings.push(`SPF lookup limit exceeded! Current lookups: ${lookups} (Max allowed: 10). This causes silent failures with Google and Yahoo.`);
  }
  return { lookups, mechanisms, warnings };
}
var DNSBL_LISTS = [
  { name: "SpamCop BL", zone: "bl.spamcop.net" },
  { name: "Barracuda Central", zone: "b.barracudacentral.org" },
  { name: "UCEPROTECT Level 1", zone: "dnsbl-1.uceprotect.net" },
  { name: "PSBL (Passive Spam)", zone: "psbl.surriel.com" },
  { name: "DroneBL", zone: "dnsbl.dronebl.org" }
];
async function checkDnsbl(ip) {
  if (!ip || !/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    return {
      clean: true,
      ipChecked: null,
      listedCount: 0,
      checks: DNSBL_LISTS.map((l) => ({ ...l, status: "untested" }))
    };
  }
  const reversedIp = ip.split(".").reverse().join(".");
  const checkPromises = DNSBL_LISTS.map(async (bl) => {
    const query = `${reversedIp}.${bl.zone}`;
    try {
      const resolverPromise = dns.resolve4(query);
      const timeoutPromise = new Promise(
        (_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 2500)
      );
      const addresses = await Promise.race([resolverPromise, timeoutPromise]);
      if (addresses && addresses.length > 0) {
        const first = addresses[0];
        if (first.startsWith("127.255.255.")) {
          return { name: bl.name, zone: bl.zone, status: "untested", returnIp: first };
        }
        return { name: bl.name, zone: bl.zone, status: "listed", returnIp: first };
      }
      return { name: bl.name, zone: bl.zone, status: "clean" };
    } catch (err) {
      if (err.code === "ENOTFOUND" || err.code === "ENODATA") {
        return { name: bl.name, zone: bl.zone, status: "clean" };
      }
      return { name: bl.name, zone: bl.zone, status: "untested" };
    }
  });
  const checks = await Promise.all(checkPromises);
  const listedCount = checks.filter((c) => c.status === "listed").length;
  return {
    clean: listedCount === 0,
    ipChecked: ip,
    listedCount,
    checks
  };
}
async function checkRdns(ip, host) {
  try {
    const resolverPromise = dns.reverse(ip);
    const timeoutPromise = new Promise(
      (_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 2500)
    );
    const ptrs = await Promise.race([resolverPromise, timeoutPromise]);
    if (ptrs && ptrs.length > 0) {
      const ptr = ptrs[0];
      let fcrdns = false;
      try {
        const forwardIps = await dns.resolve4(ptr);
        fcrdns = forwardIps.includes(ip);
      } catch (e) {
        fcrdns = false;
      }
      return {
        status: "pass",
        ip,
        host,
        ptr,
        fcrdns
      };
    }
    return {
      status: "fail",
      ip,
      host,
      ptr: null,
      fcrdns: false,
      error: "No reverse DNS (PTR) record configured for this mail server IP."
    };
  } catch (err) {
    return {
      status: "fail",
      ip,
      host,
      ptr: null,
      fcrdns: false,
      error: err.code === "ENOTFOUND" ? "No PTR record found for IP." : err.message || "Reverse DNS lookup failed"
    };
  }
}
var COMMON_DKIM_SELECTORS = [
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
app.post("/api/check-domain", async (req, res) => {
  const { domain, selector, skipAi } = req.body;
  if (!domain) {
    return res.status(400).json({ error: "Domain is required" });
  }
  const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const requestedSelector = (selector || "google").trim();
  const results = {
    domain: cleanDomain,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
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
      checks: DNSBL_LISTS.map((l) => ({ ...l, status: "untested" }))
    },
    aiAnalysis: null,
    score: 0,
    grade: "F"
  };
  try {
    let primaryMxIp = null;
    let primaryMxHost = null;
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
        }
      } else {
        results.mx = { status: "fail", records: [], error: "No MX records found for domain." };
      }
    } catch (e) {
      results.mx = { status: "fail", records: [], error: "No MX records found or DNS lookup failed." };
    }
    let ipToCheck = primaryMxIp;
    if (!ipToCheck) {
      try {
        const domainIps = await dns.resolve4(cleanDomain);
        if (domainIps && domainIps.length > 0) {
          ipToCheck = domainIps[0];
        }
      } catch (e) {
      }
    }
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
    if (ipToCheck) {
      results.blacklists = await checkDnsbl(ipToCheck);
    } else {
      results.blacklists = {
        clean: true,
        ipChecked: null,
        listedCount: 0,
        checks: DNSBL_LISTS.map((l) => ({ ...l, status: "untested" }))
      };
    }
    try {
      const txtRecords = await dns.resolveTxt(cleanDomain);
      const flatTxt = txtRecords.flat();
      const spfRecord = flatTxt.find((t) => t.startsWith("v=spf1"));
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
    try {
      const dmarcTxt = await dns.resolveTxt(`_dmarc.${cleanDomain}`);
      const flatDmarc = dmarcTxt.flat();
      const dmarcRecord = flatDmarc.find((t) => t.startsWith("v=DMARC1"));
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
    const selectorsToProbe = Array.from(/* @__PURE__ */ new Set([requestedSelector, ...COMMON_DKIM_SELECTORS]));
    const dkimProbeResults = await Promise.all(
      selectorsToProbe.map(async (sel) => {
        try {
          const dkimTxt = await dns.resolveTxt(`${sel}._domainkey.${cleanDomain}`);
          const flatDkim = dkimTxt.flat().join("");
          if (flatDkim.includes("k=rsa") || flatDkim.includes("p=") || flatDkim.includes("v=DKIM1")) {
            return { sel, record: flatDkim };
          }
        } catch (e) {
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
    try {
      const bimiTxt = await dns.resolveTxt(`default._bimi.${cleanDomain}`);
      const flatBimi = bimiTxt.flat();
      const bimiRecord = flatBimi.find((t) => t.startsWith("v=BIMI1"));
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
    if (!skipAi && process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const mxListFormatted = results.mx.records.length > 0 ? results.mx.records.map((r) => `Priority ${r.priority}: ${r.exchange}`).join(", ") : "None found";
        const prompt = `You are an expert Email Deliverability and Domain Infrastructure Consultant.
Provide an executive deliverability analysis and risk assessment based ONLY on the following verified DNS audit data for "${cleanDomain}":
- Audit Timestamp: ${new Date(results.timestamp).toUTCString()}
- Overall Score: ${score}/100, Grade: ${grade}
- SPF Status: ${results.spf.status}, Lookup Count: ${results.spf.lookups}/10, Record: ${results.spf.record || "None"}
- DKIM Status: ${results.dkim.status}, Queried Selector: ${results.dkim.selector}, Discovered Selector: ${results.dkim.detectedSelector || "None"}, Key: ${results.dkim.record ? "Published (" + results.dkim.keySize + ")" : "None"}
- DMARC Status: ${results.dmarc.status}, Policy: p=${results.dmarc.policy}, Enforcement: ${results.dmarc.pct}%, RUA: ${results.dmarc.rua || "None"}
- MX Routing: Status: ${results.mx.status}, Primary Host: ${primaryMxHost || "None"}, Primary IP: ${primaryMxIp || "None"}, Verified Records: [${mxListFormatted}]
- Reverse DNS (PTR): Status: ${results.rdns.status}, IP: ${results.rdns.ip || "None"}, PTR Hostname: ${results.rdns.ptr || "None"}, FCrDNS Match: ${results.rdns.fcrdns ? "Yes" : "No"}
- Blocklists (DNSBL): Clean: ${results.blacklists.clean}, Sending IP Checked: ${results.blacklists.ipChecked || "None"}, Listed Count: ${results.blacklists.listedCount}
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
          contents: prompt
        });
        let cleaned = (response.text || "").trim();
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
  } catch (err) {
    console.error("Domain check error:", err);
    res.status(500).json({ error: err.message || "Failed to analyze domain" });
  }
});
app.post("/api/analyze-content", async (req, res) => {
  const { subject, body, htmlContent } = req.body;
  if (!body && !htmlContent) {
    return res.status(400).json({ error: "Email body or HTML content is required" });
  }
  const textToAnalyze = body || htmlContent || "";
  const imgTags = (textToAnalyze.match(/<img[^>]*>/gi) || []).length;
  const wordCount = textToAnalyze.replace(/<[^>]*>/g, "").split(/\s+/).filter(Boolean).length;
  const hasHtml = !!htmlContent;
  let spamScore = 0;
  const detectedTriggers = [];
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
Body: ${textToAnalyze.substring(0, 3e3)}

Provide:
1. Deliverability Risk Level (Low, Medium, High)
2. Spam trigger words or phrases found.
3. Constructive rewritten subject lines or body snippets to improve inbox placement.
4. Estimated text-to-image ratio assessment.`;
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
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
        createdAt: newUser.createdAt
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    const msg = error.message && error.message.includes("already exists") ? "An account with this email already exists." : "Unable to create account. Please check your information and try again.";
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
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Invalid email or password, or service temporarily unavailable." });
  }
});
app.post("/api/users/sync", requireAuth, async (req, res) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email || "";
    if (!uid) {
      return res.status(400).json({ error: "Missing user identifier." });
    }
    const syncedUser = await getOrCreateUser(uid, email);
    res.json({ user: syncedUser });
  } catch (error) {
    console.error("User sync error:", error);
    res.status(500).json({ error: error.message || "Failed to synchronize user." });
  }
});
app.get("/api/users/me", requireAuth, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(400).json({ error: "Missing user identifier." });
    }
    const user = await getUserByUid(uid);
    res.json({ user });
  } catch (error) {
    console.error("Fetch user error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch user profile." });
  }
});
app.post(["/api/audits", "/api/audits/"], requireAuth, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { domain, score, grade, resultData } = req.body;
    if (!domain || score === void 0 || !grade || !resultData) {
      return res.status(400).json({ error: "Missing required audit fields: domain, score, grade, resultData" });
    }
    await getOrCreateUser(uid, req.user?.email || "");
    const audit = await saveAudit({
      userId: uid,
      domain: String(domain),
      score: Number(score),
      grade: String(grade),
      resultData: typeof resultData === "string" ? resultData : JSON.stringify(resultData)
    });
    res.json({ audit });
  } catch (error) {
    console.error("Save audit error:", error);
    res.status(500).json({ error: error.message || "Failed to save audit record." });
  }
});
app.get(["/api/audits", "/api/audits/"], requireAuth, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userAudits = await getAuditsByUserId(uid, req.user?.email);
    res.json({ audits: userAudits });
  } catch (error) {
    console.error("Get audits error:", error);
    res.status(500).json({ error: error.message || "Failed to retrieve audit history." });
  }
});
var handleClearAllAudits = async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const count = await clearAllAuditsByUserId(uid, req.user?.email);
    res.json({ success: true, count, message: `Successfully cleared ${count} audit records.` });
  } catch (error) {
    console.error("Clear all audits error:", error);
    res.status(500).json({ error: error.message || "Failed to clear all audit records." });
  }
};
app.delete(["/api/audits", "/api/audits/", "/api/audits/all", "/api/audits/all/"], requireAuth, handleClearAllAudits);
app.post(["/api/audits/clear-all", "/api/audits/clear-all/", "/api/audits/clear", "/api/audits/clear/"], requireAuth, handleClearAllAudits);
app.delete(["/api/audits/:id", "/api/audits/:id/"], requireAuth, async (req, res) => {
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
  } catch (error) {
    console.error("Delete audit error:", error);
    res.status(500).json({ error: error.message || "Failed to delete audit record." });
  }
});
function sanitizeUnicodeJson(str) {
  if (!str) return "";
  return str.replace(/[\u2011\u2012\u2013\u2014\u2015]/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u202F\u00A0\u2000-\u200B]/g, " ").trim();
}
function extractJsonFromPayload(raw) {
  if (!raw) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    if (raw.frontDeskScript || raw.ownerScript || raw.domain) return raw;
  }
  let str = String(raw).trim();
  str = sanitizeUnicodeJson(str);
  try {
    return JSON.parse(str);
  } catch {
  }
  const mdMatch = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (mdMatch) {
    try {
      return JSON.parse(sanitizeUnicodeJson(mdMatch[1].trim()));
    } catch {
    }
  }
  const first = str.indexOf("{");
  const last = str.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(sanitizeUnicodeJson(str.slice(first, last + 1)));
    } catch {
    }
  }
  return null;
}
function extractFromGroqError(err) {
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
  const msg = rawMsg.replace(/\\x27/g, "'").replace(/\\x22/g, '"');
  const firstBrace = msg.indexOf("{");
  const lastBrace = msg.lastIndexOf("}");
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
    } catch {
    }
  }
  return null;
}
app.post(["/api/outreach/generate", "/api/outreach/generate/"], async (req, res) => {
  try {
    const { domain, companyName, officeManagerName, callerName, callStyle, auditData } = req.body;
    if (!domain || typeof domain !== "string") {
      return res.status(400).json({ error: "A valid domain is required." });
    }
    const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const businessName = (companyName || cleanDomain.split(".")[0].toUpperCase()).trim();
    const managerTarget = (officeManagerName || "Office Manager / Decision Maker").trim();
    const caller = (callerName || "Deliverability Consultant").trim();
    const style = callStyle || "consultative";
    let auditSummary = "";
    if (auditData) {
      auditSummary = `Domain: ${cleanDomain}
Overall Score: ${auditData.score ?? "N/A"}/100 (Grade: ${auditData.grade ?? "N/A"})
SPF Record: ${auditData.spf?.status ?? "Unknown"} (Lookups: ${auditData.spf?.lookups ?? 0}, Warnings: ${(auditData.spf?.warnings || []).join("; ") || "None"})
DKIM Record: ${auditData.dkim?.status ?? "Unknown"}
DMARC Record: ${auditData.dmarc?.status ?? "Unknown"} (Policy: ${auditData.dmarc?.policy ?? "none"})
BIMI Record: ${auditData.bimi?.status ?? "Unknown"}
Blacklist Status: ${auditData.blacklists?.clean ? "Clean" : `${auditData.blacklists?.listedCount} active blacklist listing(s)`}
MX Mail Provider: ${auditData.mx?.records?.[0]?.exchange ?? "None"}`;
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
    let script = null;
    try {
      const completion = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: "You are an elite B2B cold calling specialist. You output strict raw JSON only. Do not wrap in markdown or commentary." },
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 4e3
      });
      const rawContent = completion.choices[0]?.message?.content || "";
      script = extractJsonFromPayload(rawContent);
    } catch (primaryErr) {
      console.warn("Groq primary model failed or threw:", primaryErr?.message);
      script = extractFromGroqError(primaryErr);
    }
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
          max_tokens: 4e3
        });
        const rawContent = completion.choices[0]?.message?.content || "";
        script = extractJsonFromPayload(rawContent);
      } catch (fallbackErr) {
        console.warn("Groq fallback model failed:", fallbackErr?.message);
        script = extractFromGroqError(fallbackErr);
      }
    }
    if (!script) {
      try {
        console.log("Attempting Gemini fallback for outreach generation...");
        const ai = new GoogleGenAI({});
        const geminiRes = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0.3
          }
        });
        const text2 = geminiRes.text || "";
        script = extractJsonFromPayload(text2);
      } catch (geminiErr) {
        console.error("Gemini fallback also failed:", geminiErr);
      }
    }
    if (!script) {
      throw new Error("Unable to parse outreach script from AI models. Please try again.");
    }
    res.json({ success: true, script });
  } catch (err) {
    console.error("Outreach generation error:", err?.message || err);
    res.status(500).json({ error: "Failed to generate phone outreach script." });
  }
});
app.post(["/api/outreach/save", "/api/outreach/save/"], requireAuth, async (req, res) => {
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
      companyName: companyName ? String(companyName) : void 0,
      grade: grade ? String(grade) : void 0,
      score: score !== void 0 ? Number(score) : void 0,
      scriptData: typeof scriptData === "string" ? scriptData : JSON.stringify(scriptData)
    });
    res.json({ success: true, savedScript: saved });
  } catch (error) {
    console.error("Save outreach script error:", error);
    res.status(500).json({ error: error.message || "Failed to save outreach script." });
  }
});
app.get(["/api/outreach", "/api/outreach/"], requireAuth, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const scripts = await getOutreachScriptsByUserId(uid);
    res.json({ scripts });
  } catch (error) {
    console.error("Get outreach scripts error:", error);
    res.status(500).json({ error: error.message || "Failed to retrieve outreach scripts." });
  }
});
app.delete(["/api/outreach/:id", "/api/outreach/:id/"], requireAuth, async (req, res) => {
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
  } catch (error) {
    console.error("Delete outreach script error:", error);
    res.status(500).json({ error: error.message || "Failed to delete outreach script." });
  }
});
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
      email: caller.email || email
    });
    res.json({
      success: true,
      token,
      caller: {
        callerKey: caller.callerKey,
        name: caller.name,
        email: caller.email || email
      }
    });
  } catch (error) {
    console.error("Caller login error:", error);
    res.status(500).json({ error: error.message || "Failed to authenticate caller." });
  }
});
app.get(["/api/caller/callers", "/api/caller/callers/"], async (req, res) => {
  try {
    const list = await getRegisteredCallers();
    res.json({ callers: list });
  } catch (error) {
    res.json({ callers: [] });
  }
});
app.get(["/api/caller/me", "/api/caller/me/"], requireAuth, async (req, res) => {
  res.json({
    caller: {
      callerKey: req.user?.callerKey,
      name: req.user?.callerName,
      email: req.user?.email,
      uid: req.user?.uid
    }
  });
});
app.post(["/api/leads/distribute", "/api/leads/distribute/"], async (req, res) => {
  try {
    const { leads, leadsPerCaller, assignerEmail } = req.body;
    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: "Please provide an array of audited domain leads to distribute." });
    }
    const quota = typeof leadsPerCaller === "number" && leadsPerCaller > 0 ? leadsPerCaller : 25;
    const effectiveAssigner = assignerEmail || req.user?.email || "team-admin@company.com";
    const result = await distributeLeadsEqually(leads, quota, effectiveAssigner);
    res.json(result);
  } catch (error) {
    console.error("Distribute leads error:", error);
    res.status(500).json({ error: error.message || "Failed to distribute leads." });
  }
});
app.get(["/api/leads/assigner", "/api/leads/assigner/"], async (req, res) => {
  res.json({
    mainAssignerEmail: req.user?.email || "team-admin@company.com",
    role: "Lead Distribution Manager"
  });
});
app.get(["/api/leads/my-queue", "/api/leads/my-queue/"], async (req, res) => {
  try {
    let callerKey = req.query.callerKey;
    if (!callerKey && req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace(/^Bearer\s+/, "").trim();
        const jwt2 = (await import("jsonwebtoken")).default;
        const decoded = jwt2.decode(token);
        if (decoded?.callerKey) {
          callerKey = decoded.callerKey;
        }
      } catch {
      }
    }
    if (!callerKey) {
      return res.status(400).json({ error: "Caller identification is required." });
    }
    const leads = await getLeadsForCaller(callerKey);
    res.json({ callerKey, leads, total: leads.length });
  } catch (error) {
    console.error("Get caller leads error:", error);
    res.status(500).json({ error: error.message || "Failed to retrieve caller leads." });
  }
});
app.get(["/api/leads/all-assigned", "/api/leads/all-assigned/"], async (req, res) => {
  try {
    const allLeads = await getAllAssignedLeads();
    const grouped = {};
    const counts = {};
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
      counts
    });
  } catch (error) {
    console.error("Get all assigned leads error:", error);
    res.status(500).json({ error: error.message || "Failed to retrieve assigned leads." });
  }
});
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
  } catch (error) {
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
  } catch (error) {
    console.error("Update lead status error:", error);
    res.status(500).json({ error: error.message || "Failed to update lead status." });
  }
});
app.post(["/api/leads/clear", "/api/leads/clear/"], async (req, res) => {
  try {
    const count = await clearAllLeadAssignments();
    res.json({ success: true, clearedCount: count });
  } catch (error) {
    console.error("Clear lead assignments error:", error);
    res.status(500).json({ error: error.message || "Failed to clear lead assignments." });
  }
});
app.get(["/api", "/api/", "/api/health", "/api/health/"], (req, res) => {
  res.json({
    status: "ok",
    service: "DNSDeliver Audit API",
    time: (/* @__PURE__ */ new Date()).toISOString(),
    isVercel: Boolean(process.env.VERCEL)
  });
});
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});
var server_default = app;
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa"
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
    ensureCallersInitialized().then(() => console.log("Fixed caller roles initialized successfully.")).catch((err) => console.warn("Caller initialization notice:", err));
  });
}
if (!process.env.VERCEL) {
  startServer();
}

// src/serverless.ts
function handler(req, res) {
  if (req.url && !req.url.startsWith("/api")) {
    const original = req.originalUrl || req.url;
    req.url = original.startsWith("/api") ? original : "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
  }
  return server_default(req, res);
}
export {
  handler as default
};
