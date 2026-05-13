import { z } from 'zod'

// All vars are optional at parse time so the build succeeds without .env.local.
// Use requireEnv() at call sites that need a var — it throws clearly if missing.
const schema = z.object({
  // Public — inlined by Next.js for client bundles (NEXT_PUBLIC_ prefix)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  // Server-only — never exposed to client (no NEXT_PUBLIC_ prefix)
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  ASAAS_API_KEY: z.string().optional(),
  ASAAS_WEBHOOK_TOKEN: z.string().optional(),
  ASAAS_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),
})

export const env = schema.parse(process.env)

// Call at runtime to assert a var is present. Throws with a clear message if not.
export function requireEnv<K extends keyof typeof env>(key: K): NonNullable<(typeof env)[K]> {
  const value = env[key]
  if (value === undefined || value === '') {
    throw new Error(
      `Missing required environment variable: ${String(key)}. Add it to your .env.local file.`
    )
  }
  return value as NonNullable<(typeof env)[K]>
}
