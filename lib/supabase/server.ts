import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Server (Server Components / Server Actions) Supabase client.
// Uses anon key + session cookie — subject to RLS policies.
// Must only be called inside async server context (not at module load).
// NOTE: Database generic omitted — manual utility types don't resolve with Supabase's
// PostgREST TS builder. Cast query results explicitly (e.g. `as Profile | null`).
// Replace with supabase-cli generated types before beta: `supabase gen types typescript`.
export function createClient() {
  const cookieStore = cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local.'
    )
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Called from a Server Component — cookie writes are a no-op.
          // Session refresh requires a middleware or Route Handler to persist.
        }
      },
    },
  })
}
