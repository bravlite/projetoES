'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function signIn(
  email: string,
  password: string
): Promise<{ error: string } | never> {
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }
  redirect('/me')
}

export async function signUp(
  email: string,
  password: string,
  role: 'customer' | 'provider' = 'customer',
  termsAccepted = false
): Promise<{ error?: string; success?: string }> {
  if (!termsAccepted) {
    return { error: 'Você precisa aceitar os Termos de Uso e a Política de Privacidade para criar uma conta.' }
  }

  const supabase = createClient()
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return { error: error.message }

  // Trigger handle_new_user() creates the profiles row with role='customer'.
  // Update role (if provider) + registra consentimento (LGPD).
  if (data.user) {
    const admin = createAdminClient() as any
    const updates: Record<string, unknown> = { terms_accepted_at: new Date().toISOString() }
    if (role === 'provider') updates.role = 'provider'
    await admin.from('profiles').update(updates).eq('id', data.user.id)
  }

  return { success: 'Conta criada. Verifique seu email para confirmar o cadastro.' }
}

export async function signOut(): Promise<never> {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
