import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'app_supabase_url';
const STORAGE_KEY_KEY = 'app_supabase_anon_key';

export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};
  let url = env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
  let anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_KEY || '';

  if (typeof window !== 'undefined' && window.localStorage) {
    const storedUrl = localStorage.getItem(STORAGE_KEY_URL);
    const storedKey = localStorage.getItem(STORAGE_KEY_KEY);
    if (storedUrl && storedKey) {
      url = storedUrl;
      anonKey = storedKey;
    }
  }

  return { url: url.trim(), anonKey: anonKey.trim() };
}

export function setSupabaseCredentials(url: string, anonKey: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (url && anonKey) {
      localStorage.setItem(STORAGE_KEY_URL, url.trim());
      localStorage.setItem(STORAGE_KEY_KEY, anonKey.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY_URL);
      localStorage.removeItem(STORAGE_KEY_KEY);
    }
    // Refresh client
    cachedSupabase = null;
  }
}

export async function testSupabaseConnection(url: string, anonKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanUrl = url.trim();
    const cleanKey = anonKey.trim();
    if (!cleanUrl || !cleanKey) {
      return { success: false, error: 'URL and Anon Key are required.' };
    }
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      return { success: false, error: 'Project URL must begin with https://' };
    }
    const testClient = createClient(cleanUrl, cleanKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { error } = await testClient.auth.getSession();
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to connect to Supabase.' };
  }
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseCredentials();
  return Boolean(url && url.startsWith('http') && anonKey);
}

let cachedSupabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (cachedSupabase) return cachedSupabase;
  const { url, anonKey } = getSupabaseCredentials();
  if (url && url.startsWith('http') && anonKey) {
    try {
      cachedSupabase = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
      return cachedSupabase;
    } catch (err) {
      console.warn('Failed to initialize Supabase client:', err);
      return null;
    }
  }
  return null;
}
