'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function upsertCustomerProfile(formData: FormData): Promise<{ error?: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { error } = await supabase.from('customer_profiles').upsert(
    {
      user_id: user.id,
      full_name: (formData.get('full_name') as string) || null,
      phone: (formData.get('phone') as string) || null,
      neighborhood: (formData.get('neighborhood') as string) || null,
      city: (formData.get('city') as string) || 'Vitória',
    },
    { onConflict: 'user_id' }
  )

  if (error) return { error: error.message }
  redirect('/cliente')
}

export async function upsertProviderProfile(formData: FormData): Promise<{ error?: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  // categories e neighborhoods chegam como valores múltiplos do form (checkboxes)
  const categories = formData.getAll('categories') as string[]
  const neighborhoods = formData.getAll('neighborhoods') as string[]

  const { error } = await supabase.from('provider_profiles').upsert(
    {
      user_id: user.id,
      display_name: (formData.get('display_name') as string) || null,
      phone: (formData.get('phone') as string) || null,
      bio: (formData.get('bio') as string) || null,
      categories,
      neighborhoods,
    },
    { onConflict: 'user_id' }
  )

  if (error) return { error: error.message }
  redirect('/prestador')
}
