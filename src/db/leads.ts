import { db } from './index.ts';
import { callers, leadAssignments } from './schema.ts';
import { eq, desc, asc, sql } from 'drizzle-orm';

export interface CallerInfo {
  callerKey: string;
  name: string;
  fixedCode: string;
  email?: string | null;
  lastLoginAt?: Date | null;
}

export const MAIN_ASSIGNER_EMAIL = 'melbourne258@gmail.com';

export const FIXED_CALLERS: Array<{ callerKey: string; name: string; fixedCode: string; defaultEmail: string }> = [
  { callerKey: 'larry', name: 'Larry', fixedCode: '@f1n3ssing_l4rry', defaultEmail: 'larry@auditpro.io' },
  { callerKey: 'kelly', name: 'Kelly', fixedCode: '@4mg_kyl14n', defaultEmail: 'kelly@auditpro.io' },
  { callerKey: 'ramadhan', name: 'Ramadhan', fixedCode: '@r4m4dh4n', defaultEmail: 'ramadhan@auditpro.io' },
  { callerKey: 'melbourne', name: 'Melbourne', fixedCode: '@M3lbourn3', defaultEmail: 'melbourne258@gmail.com' },
];

export async function ensureCallersInitialized() {
  try {
    for (const c of FIXED_CALLERS) {
      await db.insert(callers)
        .values({
          callerKey: c.callerKey,
          name: c.name,
          fixedCode: c.fixedCode,
          email: c.defaultEmail,
        })
        .onConflictDoUpdate({
          target: callers.callerKey,
          set: {
            name: c.name,
            fixedCode: c.fixedCode,
            email: c.defaultEmail,
          },
        });
    }
  } catch (err) {
    console.warn('ensureCallersInitialized notice:', err);
  }
}

export async function verifyCallerLogin(name: string, email: string, code: string): Promise<CallerInfo | null> {
  const cleanCode = (code || '').trim();
  const cleanName = (name || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();

  // Find matching caller by exact fixed code (case-insensitive for safety, supporting optional @)
  const matched = FIXED_CALLERS.find(c => {
    const codeA = c.fixedCode.toLowerCase();
    const codeB = cleanCode.toLowerCase();
    return codeA === codeB ||
      codeA === `@${codeB}` ||
      `@${codeA.replace(/^@/, '')}` === `@${codeB.replace(/^@/, '')}`;
  });

  if (!matched) {
    return null;
  }

  const callerDisplayName = cleanName || matched.name;
  const effectiveEmail = cleanEmail || matched.defaultEmail || `${matched.callerKey}@auditpro.io`;

  // Update caller login info in database to persist their latest login and email
  try {
    const now = new Date();
    await db.insert(callers)
      .values({
        callerKey: matched.callerKey,
        name: callerDisplayName,
        fixedCode: matched.fixedCode,
        email: effectiveEmail,
        lastLoginAt: now,
      })
      .onConflictDoUpdate({
        target: callers.callerKey,
        set: {
          name: callerDisplayName,
          fixedCode: matched.fixedCode,
          email: effectiveEmail,
          lastLoginAt: now,
        },
      });
  } catch (err) {
    console.warn('Failed to update caller in DB:', err);
  }

  return {
    callerKey: matched.callerKey,
    name: callerDisplayName,
    fixedCode: matched.fixedCode,
    email: effectiveEmail,
    lastLoginAt: new Date(),
  };
}

export interface RawLeadInput {
  domain: string;
  phone?: string;
  companyName?: string;
  grade?: string;
  score?: number;
  resultData?: any;
}

export async function distributeLeadsEqually(
  leads: RawLeadInput[],
  leadsPerCaller: number = 25,
  assignerEmail: string = MAIN_ASSIGNER_EMAIL
) {
  try {
    await ensureCallersInitialized();

    // 1. Deduplicate by domain
    const uniqueMap = new Map<string, RawLeadInput>();
    for (const lead of leads) {
      const cleanDomain = lead.domain.trim().toLowerCase();
      if (!uniqueMap.has(cleanDomain)) {
        uniqueMap.set(cleanDomain, lead);
      }
    }
    const allLeads = Array.from(uniqueMap.values());

    // 2. Sort so Strong Targets (Grade D and F) are prioritized first
    const sortedLeads = [...allLeads].sort((a, b) => {
      const isAStrong = (a.grade?.startsWith('D') || a.grade?.startsWith('F')) ? 1 : 0;
      const isBStrong = (b.grade?.startsWith('D') || b.grade?.startsWith('F')) ? 1 : 0;
      if (isAStrong !== isBStrong) return isBStrong - isAStrong;
      // Secondary: lower score first (higher deliverability urgency)
      return (a.score ?? 50) - (b.score ?? 50);
    });

    // 3. Clear existing lead assignments to ensure a fresh, non-duplicate batch
    await db.delete(leadAssignments);

    const batchId = `batch_${Date.now()}`;
    const callerKeys = FIXED_CALLERS.map(c => c.callerKey);
    const callerNames: Record<string, string> = {
      larry: 'Larry',
      kelly: 'Kelly',
      ramadhan: 'Ramadhan',
      melbourne: 'Melbourne',
    };

    // Calculate how many to assign per caller (up to leadsPerCaller, e.g. 25 each = 100 total)
    const totalToAssign = Math.min(sortedLeads.length, leadsPerCaller * callerKeys.length);
    const leadsToDistribute = sortedLeads.slice(0, totalToAssign);

    const callerBuckets: Record<string, RawLeadInput[]> = {
      larry: [],
      kelly: [],
      ramadhan: [],
      melbourne: [],
    };

    // Round-robin distribution to avoid duplicates and ensure equal splitting
    leadsToDistribute.forEach((lead, idx) => {
      const assignedCaller = callerKeys[idx % callerKeys.length];
      if (callerBuckets[assignedCaller].length < leadsPerCaller) {
        callerBuckets[assignedCaller].push(lead);
      }
    });

    const rowsToInsert: any[] = [];
    for (const callerKey of callerKeys) {
      const leadsForThisCaller = callerBuckets[callerKey];
      for (const lead of leadsForThisCaller) {
        const cleanDomain = lead.domain.trim().toLowerCase();
        const compName = lead.companyName || cleanDomain.split('.')[0].toUpperCase();
        rowsToInsert.push({
          callerKey,
          callerName: callerNames[callerKey],
          domain: cleanDomain,
          phone: lead.phone ? lead.phone.trim() : null,
          companyName: compName,
          grade: lead.grade || null,
          score: lead.score ?? null,
          resultData: typeof lead.resultData === 'string' ? lead.resultData : JSON.stringify(lead.resultData || {}),
          status: 'pending',
          batchId,
        });
      }
    }

    if (rowsToInsert.length > 0) {
      await db.insert(leadAssignments).values(rowsToInsert);
    }

    return {
      success: true,
      batchId,
      assignedBy: assignerEmail,
      totalDistributed: rowsToInsert.length,
      distribution: {
        larry: callerBuckets.larry.length,
        kelly: callerBuckets.kelly.length,
        ramadhan: callerBuckets.ramadhan.length,
        melbourne: callerBuckets.melbourne.length,
      },
    };
  } catch (error) {
    console.error('Failed to distribute leads:', error);
    throw new Error('Database operation failed while distributing leads.', { cause: error });
  }
}

export async function getLeadsForCaller(callerKey: string) {
  try {
    const cleanKey = callerKey.toLowerCase().trim();
    return await db.select()
      .from(leadAssignments)
      .where(eq(leadAssignments.callerKey, cleanKey))
      .orderBy(asc(leadAssignments.id));
  } catch (error) {
    console.error('Failed to get leads for caller:', error);
    throw new Error('Database operation failed while fetching caller leads.', { cause: error });
  }
}

export async function getAllAssignedLeads() {
  try {
    return await db.select()
      .from(leadAssignments)
      .orderBy(asc(leadAssignments.callerKey), asc(leadAssignments.id));
  } catch (error) {
    console.error('Failed to get all assigned leads:', error);
    throw new Error('Database operation failed while fetching all assigned leads.', { cause: error });
  }
}

export async function updateLeadStatus(id: number, status: string, notes?: string) {
  try {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    const result = await db.update(leadAssignments)
      .set(updateData)
      .where(eq(leadAssignments.id, id))
      .returning();
    return result[0];
  } catch (error) {
    console.error('Failed to update lead status:', error);
    throw new Error('Database operation failed while updating lead status.', { cause: error });
  }
}

export async function clearAllLeadAssignments() {
  try {
    const result = await db.delete(leadAssignments).returning();
    return result.length;
  } catch (error) {
    console.error('Failed to clear lead assignments:', error);
    throw new Error('Database operation failed while clearing lead assignments.', { cause: error });
  }
}
