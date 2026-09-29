import { createClient, type Session, type User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export type AuthSession = Session | null;
export type AuthUser = User | null;

export type StorageMode = 'local' | 'cloud';

export async function signUpWithEmail(email: string, password: string) {
  if (!supabase) return { error: { message: 'Cloud nicht verfügbar' } as { message: string } };
  return supabase.auth.signUp({ email, password });
}

export async function signInWithEmail(email: string, password: string) {
  if (!supabase) return { error: { message: 'Cloud nicht verfügbar' } as { message: string } };
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getCurrentSession(): Promise<AuthSession> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(callback: (session: AuthSession) => void) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    (async () => callback(session))();
  });
  return () => data.subscription.unsubscribe();
}
