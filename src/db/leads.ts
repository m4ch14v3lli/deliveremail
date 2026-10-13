import { db } from './index.ts';
import { callers, leadAssignments } from './schema.ts';
import { eq, asc } from 'drizzle-orm';

export interface CallerInfo {
  callerKey: string;
  name: string;
  fixedCode: string;
  email?: string | null;
  lastLoginAt?: Date | null;
}

export async function ensureCallersInitialized() {
  // Callers are created dynamically upon self-input or administration
}

export async function getRegisteredCallers(): Promise<Array<{ callerKey: string; name: string }>> {
  try {
    const list = await db.select().from(callers);
    return list.map(c => ({
      callerKey: c.callerKey,
      name: c.name,
    }));
  } catch (err) {
    console.warn('getRegisteredCallers query notice:', err);
    return [];
  }
}

export async function verifyCallerLogin(name?: string, email?: string, code?: string): Promise<CallerInfo | null> {
  const cleanCode = (code || '').trim();
  if (!cleanCode) return null;
  const cleanName = (name || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();

  // 1. Check existing caller in database by passcode
  try {
    const allCallers = await db.select().from(callers);
    const dbMatch = allCallers.find(c => {
      const codeA = (c.fixedCode || '').toLowerCase().trim();
      const codeB = cleanCode.toLowerCase().trim();
      return codeA === codeB ||
        codeA === `@${codeB}` ||
        `@${codeA.replace(/^@/, '')}` === `@${codeB.replace(/^@/, '')}`;
    });

    if (dbMatch) {
      const callerDisplayName = cleanName || dbMatch.name;
      const effectiveEmail = cleanEmail || dbMatch.email || null;
      const now = new Date();
      await db.update(callers)
        .set({
          name: callerDisplayName,
          email: effectiveEmail,
          lastLoginAt: now,
        })
        .where(eq(callers.callerKey, dbMatch.callerKey));

      return {
        callerKey: dbMatch.callerKey,
        name: callerDisplayName,
        fixedCode: dbMatch.fixedCode,
        email: effectiveEmail,
        lastLoginAt: now,
      };
    }
  } catch (err) {
    console.warn('Database caller lookup notice:', err);
  }

  // 2. Caller self-registration: If entering a new access passcode
  if (cleanCode.length >= 2) {
    const callerKey = `caller_${cleanCode.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || Date.now()}`;
    const callerDisplayName = cleanName || 'Team Caller';
    const effectiveEmail = cleanEmail || null;
    const now = new Date();

    try {
      await db.insert(callers).values({
        callerKey,
        name: callerDisplayName,
        fixedCode: cleanCode,
        email: effectiveEmail,
        lastLoginAt: now,
      }).onConflictDoNothing();
    } catch (insertErr) {
      console.warn('Caller registration notice:', insertErr);
    }

    return {
      callerKey,
      name: callerDisplayName,
      fixedCode: cleanCode,
      email: effectiveEmail,
      lastLoginAt: now,
    };
  }

  return null;
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
  assignerEmail: string = 'team-admin@company.com'
) {
  try {
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
      return (a.score ?? 50) - (b.score ?? 50);
    });

    // 3. Clear existing lead assignments for a fresh, non-duplicate batch
    await db.delete(leadAssignments);

    const batchId = `batch_${Date.now()}`;
    const registered = await getRegisteredCallers();
    
    // If callers are registered, partition among them; otherwise use dynamic caller partitions
    const targetCallers = registered.length > 0 ? registered.slice(0, 4) : [
      { callerKey: 'caller_1', name: 'Caller 1' },
      { callerKey: 'caller_2', name: 'Caller 2' },
      { callerKey: 'caller_3', name: 'Caller 3' },
      { callerKey: 'caller_4', name: 'Caller 4' },
    ];

    const callerKeys = targetCallers.map(c => c.callerKey);
    const callerNames: Record<string, string> = {};
    const callerBuckets: Record<string, RawLeadInput[]> = {};
    for (const c of targetCallers) {
      callerNames[c.callerKey] = c.name;
      callerBuckets[c.callerKey] = [];
    }

    const totalToAssign = Math.min(sortedLeads.length, leadsPerCaller * callerKeys.length);
    const leadsToDistribute = sortedLeads.slice(0, totalToAssign);

    // Round-robin distribution without duplicate domains
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

    const distSummary: Record<string, number> = {};
    for (const k of callerKeys) {
      distSummary[k] = callerBuckets[k].length;
    }

    return {
      success: true,
      batchId,
      assignedBy: assignerEmail,
      totalDistributed: rowsToInsert.length,
      distribution: distSummary,
    };
  } catch (error) {
    console.error('Failed to distribute leads:', error);
    throw new Error('Unable to complete lead distribution.', { cause: error });
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
    throw new Error('Unable to retrieve assigned leads.', { cause: error });
  }
}

export async function getAllAssignedLeads() {
  try {
    return await db.select()
      .from(leadAssignments)
      .orderBy(asc(leadAssignments.callerKey), asc(leadAssignments.id));
  } catch (error) {
    console.error('Failed to get all assigned leads:', error);
    throw new Error('Unable to retrieve leads queue.', { cause: error });
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
    throw new Error('Unable to update lead outcome.', { cause: error });
  }
}

export async function clearAllLeadAssignments() {
  try {
    const result = await db.delete(leadAssignments).returning();
    return result.length;
  } catch (error) {
    console.error('Failed to clear lead assignments:', error);
    throw new Error('Unable to clear lead assignments.', { cause: error });
  }
}
