import { createClient } from '@supabase/supabase-js';

// Configured via Vite env vars (set these in .env locally and in Netlify):
//   VITE_SUPABASE_URL       -> Project Settings -> API -> Project URL
//   VITE_SUPABASE_ANON_KEY  -> Project Settings -> API -> anon/public key
//
// The anon key is safe to expose in the browser; Row Level Security in the
// database is what actually protects the data.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly during development so the misconfig is obvious.
  console.error(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY in client/.env (see client/.env.example).'
  );
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
