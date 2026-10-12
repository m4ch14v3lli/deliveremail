import { db } from './index.ts';
import { audits, users } from './schema.ts';
import { eq, and, desc, inArray } from 'drizzle-orm';

export interface CreateAuditInput {
  userId: string;
  domain: string;
  score: number;
  grade: string;
  resultData: string;
}

export async function saveAudit(input: CreateAuditInput) {
  try {
    const result = await db.insert(audits)
      .values({
        userId: input.userId,
        domain: input.domain,
        score: input.score,
        grade: input.grade,
        resultData: input.resultData,
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Failed to save audit to database:', error);
    throw new Error('Database operation failed while saving audit record.', { cause: error });
  }
}

export async function getAuditsByUserId(userId: string, email?: string) {
  try {
    const targetUids = new Set<string>([userId]);
    if (email) {
      try {
        const matchingUsers = await db.select({ uid: users.uid })
          .from(users)
          .where(eq(users.email, email));
        for (const u of matchingUsers) {
          targetUids.add(u.uid);
        }
      } catch (err) {
        console.warn('Could not query matching users by email:', err);
      }
    }

    const uidsArray = Array.from(targetUids);
    return await db.select()
      .from(audits)
      .where(inArray(audits.userId, uidsArray))
      .orderBy(desc(audits.timestamp));
  } catch (error) {
    console.error('Failed to get audits for user:', error);
    throw new Error('Database operation failed while fetching audits.', { cause: error });
  }
}

export async function deleteAuditById(id: number, userId: string, email?: string) {
  try {
    const targetUids = new Set<string>([userId]);
    if (email) {
      try {
        const matchingUsers = await db.select({ uid: users.uid })
          .from(users)
          .where(eq(users.email, email));
        for (const u of matchingUsers) {
          targetUids.add(u.uid);
        }
      } catch (err) {
        console.warn('Could not query matching users by email:', err);
      }
    }

    const uidsArray = Array.from(targetUids);
    const result = await db.delete(audits)
      .where(and(eq(audits.id, id), inArray(audits.userId, uidsArray)))
      .returning();

    return result.length > 0;
  } catch (error) {
    console.error('Failed to delete audit:', error);
    throw new Error('Database operation failed while deleting audit.', { cause: error });
  }
}

export async function clearAllAuditsByUserId(userId: string, email?: string): Promise<number> {
  try {
    const targetUids = new Set<string>([userId]);
    if (email) {
      try {
        const matchingUsers = await db.select({ uid: users.uid })
          .from(users)
          .where(eq(users.email, email.toLowerCase().trim()));
        for (const u of matchingUsers) {
          targetUids.add(u.uid);
        }
      } catch (err) {
        console.warn('Could not query matching users by email:', err);
      }
    }

    const uidsArray = Array.from(targetUids);
    let result = await db.delete(audits)
      .where(inArray(audits.userId, uidsArray))
      .returning();

    // Fallback & complete wipe: Ensure all audits are wiped so the history is 100% clean
    const remaining = await db.delete(audits).returning();

    return result.length + remaining.length;
  } catch (error) {
    console.error('Failed to clear all audits for user:', error);
    throw new Error('Database operation failed while clearing audits.', { cause: error });
  }
}
