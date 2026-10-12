import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSupabase, isSupabaseConfigured, getSupabaseCredentials, setSupabaseCredentials } from '../lib/supabase';

export interface AppUser {
  uid: string;
  email: string;
  createdAt?: string;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  token: string | null;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
  loginWithEmail: (email: string, passwordPlain: string) => Promise<void>;
  registerWithEmail: (email: string, passwordPlain: string) => Promise<void>;
  loginWithSupabaseOAuth: (provider: 'google' | 'github') => Promise<void>;
  isSupabase: boolean;
  saveSupabaseConfig: (url: string, anonKey: string) => void;
  supabaseUrl: string;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  token: null,
  logout: async () => {},
  getToken: async () => null,
  loginWithEmail: async () => {},
  registerWithEmail: async () => {},
  loginWithSupabaseOAuth: async () => {},
  isSupabase: false,
  saveSupabaseConfig: () => {},
  supabaseUrl: '',
});

const TOKEN_KEY = 'app_auth_jwt_token';
const USER_KEY = 'app_auth_user_data';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSupabase, setIsSupabase] = useState(isSupabaseConfigured());
  const [supabaseUrl, setSupabaseUrl] = useState(getSupabaseCredentials().url);

  const getToken = async (): Promise<string | null> => {
    const supabase = getSupabase();
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        return data.session.access_token;
      }
    }
    return token || (typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null);
  };

  // Initialize auth state
  useEffect(() => {
    let mounted = true;
    const initAuth = async () => {
      const supabase = getSupabase();
      if (supabase) {
        setIsSupabase(true);
        const { data } = await supabase.auth.getSession();
        if (data.session?.user && mounted) {
          setUser({
            uid: data.session.user.id,
            email: data.session.user.email || '',
            createdAt: data.session.user.created_at,
          });
          setToken(data.session.access_token);
        }

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!mounted) return;
          if (session?.user) {
            setUser({
              uid: session.user.id,
              email: session.user.email || '',
              createdAt: session.user.created_at,
            });
            setToken(session.access_token);
          } else {
            setUser(null);
            setToken(null);
          }
        });

        if (mounted) setLoading(false);
        return () => {
          authListener.subscription.unsubscribe();
        };
      } else {
        // Fallback: Check local JWT token from PostgreSQL auth
        if (typeof window !== 'undefined') {
          const storedToken = localStorage.getItem(TOKEN_KEY);
          const storedUser = localStorage.getItem(USER_KEY);
          if (storedToken && storedUser) {
            try {
              setUser(JSON.parse(storedUser));
              setToken(storedToken);
            } catch (e) {
              localStorage.removeItem(TOKEN_KEY);
              localStorage.removeItem(USER_KEY);
            }
          }
        }
        if (mounted) setLoading(false);
      }
    };

    initAuth();
    return () => {
      mounted = false;
    };
  }, []);

  const loginWithEmail = async (email: string, passwordPlain: string) => {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: passwordPlain,
      });
      if (error) throw error;
      if (data.user && data.session) {
        setUser({
          uid: data.user.id,
          email: data.user.email || email,
          createdAt: data.user.created_at,
        });
        setToken(data.session.access_token);
      }
    } else {
      // Native PostgreSQL API authentication
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: passwordPlain }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign in');
      }
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    }
  };

  const registerWithEmail = async (email: string, passwordPlain: string) => {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: passwordPlain,
      });
      if (error) throw error;
      if (data.user) {
        setUser({
          uid: data.user.id,
          email: data.user.email || email,
          createdAt: data.user.created_at,
        });
        if (data.session) {
          setToken(data.session.access_token);
        }
      }
    } else {
      // Native PostgreSQL API authentication
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: passwordPlain }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create account');
      }
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    }
  };

  const loginWithSupabaseOAuth = async (provider: 'google' | 'github') => {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Supabase client is not configured yet. Please configure your Supabase URL and Key.');
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const logout = async () => {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Supabase signOut error:', e);
      }
    }
    setUser(null);
    setToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  };

  const saveSupabaseConfig = (url: string, anonKey: string) => {
    setSupabaseCredentials(url, anonKey);
    setIsSupabase(isSupabaseConfigured());
    setSupabaseUrl(url);
    window.location.reload();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        token,
        logout,
        getToken,
        loginWithEmail,
        registerWithEmail,
        loginWithSupabaseOAuth,
        isSupabase,
        saveSupabaseConfig,
        supabaseUrl,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
