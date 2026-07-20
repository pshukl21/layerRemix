import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// True once the project has real Supabase credentials configured.
// Used around the app to show a friendly setup notice instead of crashing.
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('YOUR-PROJECT-REF') &&
    !supabaseAnonKey.includes('YOUR-ANON-PUBLIC-KEY')
);

// Fall back to harmless placeholder values so createClient doesn't throw
// when the env vars haven't been set yet (e.g. first run before setup).
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

export const PREVIEWS_BUCKET = 'previews';
export const SOURCE_FILES_BUCKET = 'source-files';
