import { db } from './index.ts';
import { outreachScripts } from './schema.ts';
import { eq, and, desc } from 'drizzle-orm';

export interface CreateOutreachInput {
  userId: string;
  domain: string;
  companyName?: string;
  grade?: string;
  score?: number;
  scriptData: string; // JSON string
}

export async function saveOutreachScript(input: CreateOutreachInput) {
  try {
    const result = await db.insert(outreachScripts)
      .values({
        userId: input.userId,
        domain: input.domain,
        companyName: input.companyName || null,
        grade: input.grade || null,
        score: input.score !== undefined ? input.score : null,
        scriptData: input.scriptData,
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Failed to save outreach script:', error);
    throw new Error('Unable to save outreach script.', { cause: error });
  }
}

export async function getOutreachScriptsByUserId(userId: string) {
  try {
    return await db.select()
      .from(outreachScripts)
      .where(eq(outreachScripts.userId, userId))
      .orderBy(desc(outreachScripts.createdAt));
  } catch (error) {
    console.error('Failed to get outreach scripts for user:', error);
    throw new Error('Unable to retrieve outreach scripts.', { cause: error });
  }
}

export async function deleteOutreachScriptById(id: number, userId: string) {
  try {
    const result = await db.delete(outreachScripts)
      .where(and(eq(outreachScripts.id, id), eq(outreachScripts.userId, userId)))
      .returning();

    return result.length > 0;
  } catch (error) {
    console.error('Failed to delete outreach script:', error);
    throw new Error('Unable to delete outreach script.', { cause: error });
  }
}
