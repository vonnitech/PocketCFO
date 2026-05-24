import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl     = (import.meta.env.VITE_SUPABASE_URL     as string | undefined) ?? '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

// True when both vars are present — checked by App.tsx to show the setup screen
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn('[PocketCFO] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set. Add them to .env.local');
}

// Even when unconfigured we create a client so imports don't crash.
// All network calls will fail gracefully with auth errors.
export const supabase = createClient<Database>(
  supabaseUrl  || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession:    true,
      autoRefreshToken:  true,
      detectSessionInUrl: true,
    },
  },
);
