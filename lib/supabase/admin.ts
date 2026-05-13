import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { requireEnv } from '@/lib/env'

// Admin (service-role) Supabase client.
// WARNING: bypasses all RLS policies. Use only for trusted server-side operations
// (admin actions, background jobs, migrations). Never expose to users or client code.
// The `server-only` import above causes a build error if imported in a client component.
// NOTE: Database generic omitted — see lib/supabase/server.ts comment for context.
export function createAdminClient() {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
