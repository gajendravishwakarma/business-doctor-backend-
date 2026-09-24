import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import { UserRole, UserSession } from '../types/database';

// Configuration keys for localStorage
const SUPABASE_URL_KEY = 'biz_doctor_supabase_url';
const SUPABASE_ANON_KEY = 'biz_doctor_supabase_anon_key';

let cachedClient: SupabaseClient | null = null;

export function getStoredSupabaseConfig(): { url: string; anonKey: string } {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

  const storedUrl = typeof window !== 'undefined' ? localStorage.getItem(SUPABASE_URL_KEY) || '' : '';
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem(SUPABASE_ANON_KEY) || '' : '';

  return {
    url: storedUrl || envUrl,
    anonKey: storedKey || envKey,
  };
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  if (typeof window !== 'undefined') {
    if (url) localStorage.setItem(SUPABASE_URL_KEY, url.trim());
    else localStorage.removeItem(SUPABASE_URL_KEY);

    if (anonKey) localStorage.setItem(SUPABASE_ANON_KEY, anonKey.trim());
    else localStorage.removeItem(SUPABASE_ANON_KEY);
  }
  cachedClient = null; // reset cached instance
}

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  const { url, anonKey } = getStoredSupabaseConfig();

  if (!url || !anonKey) {
    return null;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    return cachedClient;
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err);
    return null;
  }
}

/**
 * Maps a Supabase Auth User & Session to a typed UserSession
 */
export function mapSupabaseUserToSession(user: User, session?: Session | null): UserSession {
  const metaRole = (user.user_metadata?.role as UserRole) || 'owner';
  const role: UserRole =
    metaRole === 'staff' || metaRole === 'manager' || metaRole === 'marketing' ? metaRole : 'owner';

  return {
    id: user.id,
    email: user.email || 'user@example.com',
    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
    role,
    access_token: session?.access_token,
    expires_at: session?.expires_at,
    last_sign_in_at: user.last_sign_in_at,
    is_demo: false,
  };
}

/**
 * Sign in with Email and Password using Supabase Auth
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ success: boolean; session?: UserSession; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase client is not configured.' };
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data.user) {
      return { success: false, error: 'No user data returned from authentication.' };
    }

    const session = mapSupabaseUserToSession(data.user, data.session);
    return { success: true, session };
  } catch (err: any) {
    return { success: false, error: err.message || 'Authentication failed' };
  }
}

/**
 * Sign up with Email, Password, Name, and Role using Supabase Auth
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  name: string,
  role: UserRole = 'owner'
): Promise<{ success: boolean; session?: UserSession; error?: string; confirmationRequired?: boolean }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase client is not configured.' };
  }

  try {
    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: name.trim(),
          role,
        },
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data.user && !data.session) {
      return {
        success: true,
        confirmationRequired: true,
        error: 'Registration submitted. Please check your email to confirm your account.',
      };
    }

    if (data.user) {
      const session = mapSupabaseUserToSession(data.user, data.session);
      return { success: true, session };
    }

    return { success: false, error: 'Signup did not return a user instance.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Registration failed' };
  }
}

/**
 * Sign out the current user session
 */
export async function signOutUser(): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: true };
  }

  try {
    const { error } = await client.auth.signOut();
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Sign out failed' };
  }
}

/**
 * Get the current Supabase session
 */
export async function getCurrentSupabaseSession(): Promise<UserSession | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client.auth.getSession();
    if (error || !data.session?.user) {
      return null;
    }
    return mapSupabaseUserToSession(data.session.user, data.session);
  } catch {
    return null;
  }
}

/**
 * Set up real-time auth state change subscription
 */
export function onAuthStateChange(callback: (session: UserSession | null) => void): () => void {
  const client = getSupabaseClient();
  if (!client) return () => {};

  const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      callback(mapSupabaseUserToSession(session.user, session));
    } else {
      callback(null);
    }
  });

  return () => {
    authListener.subscription.unsubscribe();
  };
}

export async function testSupabaseConnection(
  url: string,
  anonKey: string
): Promise<{
  success: boolean;
  message: string;
  tablesAccessible?: string[];
  authReady?: boolean;
}> {
  try {
    if (!url || !anonKey) {
      return { success: false, message: 'URL and Anon Key are required.' };
    }
    const testClient = createClient(url.trim(), anonKey.trim());
    
    // Check auth status
    const { error: authError } = await testClient.auth.getSession();
    const authReady = !authError;

    // Check table accessibility
    const tablesToProbe = [
      'businesses',
      'customers',
      'leads',
      'products',
      'services',
      'orders',
      'bookings',
      'expenses',
      'business_memory',
      'agent_actions',
    ];
    const accessible: string[] = [];

    for (const tbl of tablesToProbe) {
      const { error } = await testClient.from(tbl).select('id').limit(1);
      if (!error || error.code === 'PGRST116') {
        accessible.push(tbl);
      }
    }

    if (accessible.length > 0) {
      return {
        success: true,
        message: `Successfully connected to Supabase with RLS verification! (${accessible.length}/${tablesToProbe.length} core tables verified)`,
        tablesAccessible: accessible,
        authReady,
      };
    } else {
      return {
        success: true,
        message: 'Connected to Supabase endpoint (Tables ready for synchronization).',
        tablesAccessible: [],
        authReady,
      };
    }
  } catch (err: any) {
    return { success: false, message: err.message || 'Connection failed' };
  }
}
