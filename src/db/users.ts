import { db } from './index.ts';
import { users } from './schema.ts';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export async function getOrCreateUser(uid: string, email: string) {
  try {
    const result = await db.insert(users)
      .values({
        uid,
        email,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Failed to get or create user:', error);
    throw new Error('Unable to synchronize user account. Please try again.', { cause: error });
  }
}

export async function getUserByUid(uid: string) {
  try {
    const result = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Failed to fetch user by UID:', error);
    throw new Error('Unable to verify user account. Please try again.', { cause: error });
  }
}

export async function getUserByEmail(email: string) {
  try {
    const result = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Failed to fetch user by email:', error);
    throw new Error('Unable to verify user email. Please try again.', { cause: error });
  }
}

export async function createPasswordUser(email: string, passwordPlain: string) {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await getUserByEmail(normalizedEmail);
    if (existing) {
      throw new Error('An account with this email already exists.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordPlain, salt);
    const uid = 'usr_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);

    const result = await db.insert(users).values({
      uid,
      email: normalizedEmail,
      passwordHash,
    }).returning();

    return result[0];
  } catch (error: any) {
    console.error('Failed to create password user:', error);
    throw error;
  }
}

export async function verifyUserPassword(email: string, passwordPlain: string) {
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
    console.error('Failed to verify user password:', error);
    throw error;
  }
}
