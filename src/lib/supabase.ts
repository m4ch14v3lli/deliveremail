import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'app_supabase_url';
const STORAGE_KEY_KEY = 'app_supabase_anon_key';

export function getSupabaseCredentials(): { url: string; anonKey: string } {
  let url = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || '';
  let anonKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || '';

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
