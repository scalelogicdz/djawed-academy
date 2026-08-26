import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// SERVER-ONLY. Never import this file from a Client Component.
// Uses the service role key, which bypasses Row Level Security —
// that's required to create auth users and manage enrollments on
// the student's behalf from the admin panel.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
