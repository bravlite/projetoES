import { createBrowserClient } from '@supabase/ssr'

// Browser (client component) Supabase client.
// Uses anon key — subject to RLS policies.
// NOTE: Database generic omitted — see lib/supabase/server.ts comment for context.
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local.'
    )
  }

  return createBrowserClient(url, key)
}
