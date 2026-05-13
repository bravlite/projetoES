import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { confirmCompletion } from '@/server/completion'
import { SERVICE_CATEGORIES } from '@/lib/constants'
import type { Profile } from '@/types/database'

export const dynamic = 'force-dynamic'

type Evidence = {
  id: string
  kind: string
  file_path: string
  notes: string | null
  url: string | null
}

export default async function ConcluirPage({ params }: { params: { id: string } }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16">
        <p className="text-sm text-gray-500">Configure Supabase em .env.local.</p>
      </div>
    )
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient() as any

  // Verifica perfil
  const { data: rawProfile } = await admin.from('profiles').select('*').eq('id', user.id).single()
  const profile = rawProfile as Profile | null
  if (!profile || profile.role !== 'customer') redirect('/pedidos')

  // Busca pedido
  const { data: r } = await admin
    .from('service_requests')
    .select('id, status, customer_id, category_slug, description, current_provider_id, final_value_cents')
    .eq('id', params.id)
    .single()
  const req = r as {
    id: string
    status: string
    customer_id: string
    category_slug: string
    description: string
    current_provider_id: string | null
    final_value_cents: number | null
  } | null

  if (!req) notFound()
  if (req.customer_id !== user.id) redirect('/pedidos')
  if (req.status !== 'completed_by_provider') redirect(`/pedidos/${params.id}`)

  const cat = SERVICE_CATEGORIES.find((c) => c.slug === req.category_slug)

  // Busca evidências 'after' do prestador para exibição
  const { data: rawEvidence } = await admin
    .from('service_evidence')
    .select('id, kind, file_path, notes')
    .eq('request_id', params.id)
    .eq('kind', 'after')
    .order('created_at', { ascending: false })

  const evidenceList = (rawEvidence as Omit<Evidence, 'url'>[]) ?? []

  // Gera URLs assinadas para exibir fotos (1h)
  const evidenceWithUrls: Evidence[] = await Promise.all(
    evidenceList.map(async (ev) => {
      try {
        const { data } = await admin.storage
          .from('evidence')
          .createSignedUrl(ev.file_path, 3600)
        return { ...ev, url: (data as { signedUrl: string } | null)?.signedUrl ?? null }
      } catch {
        return { ...ev, url: null }
      }
    })
  )

  const confirmAction = confirmCompletion.bind(null, params.id)

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="mb-6">
        <Link href={`/pedidos/${params.id}`} className="text-sm text-gray-400 hover:text-gray-600">
          ← Voltar ao pedido
        </Link>
      </div>

      <h1 className="mb-2 text-2xl font-bold text-gray-900">Confirmar conclusão</h1>
      <p className="mb-6 text-sm text-gray-500">
        O prestador marcou o serviço como concluído. Revise as fotos e confirme.
      </p>

      {/* Resumo do serviço */}
      <div className="mb-6 rounded-lg border border-gray-200 p-4">
        <p className="font-medium text-gray-900">{cat?.label ?? req.category_slug}</p>
        <p className="mt-1 text-sm text-gray-500 line-clamp-2">{req.description}</p>
        {req.final_value_cents && (
          <p className="mt-2 text-sm font-semibold text-gray-700">
            Valor: R$ {(req.final_value_cents / 100).toFixed(2)}
          </p>
        )}
      </div>

      {/* Fotos do prestador (depois) */}
      {evidenceWithUrls.length > 0 ? (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Fotos enviadas pelo prestador
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {evidenceWithUrls.map((ev) => (
              <div key={ev.id} className="overflow-hidden rounded-lg border border-gray-200">
                {ev.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ev.url} alt="Foto depois" className="h-40 w-full object-cover" />
                ) : (
                  <div className="flex h-40 items-center justify-center bg-gray-100 text-xs text-gray-400">
                    Foto indisponível
                  </div>
                )}
                {ev.notes && (
                  <p className="p-2 text-xs text-gray-500">{ev.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-md bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
          O prestador não enviou fotos do resultado. Você ainda pode confirmar se estiver
          satisfeito.
        </div>
      )}

      {/* Ações */}
      <div className="flex flex-col gap-3">
        <form action={confirmAction}>
          <button
            type="submit"
            className="w-full rounded-md bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700"
          >
            ✓ Confirmar — serviço concluído
          </button>
        </form>

        <Link
          href={`/pedidos/${params.id}/disputar`}
          className="block w-full rounded-md border border-red-300 px-4 py-3 text-center text-sm font-semibold text-red-600 hover:bg-red-50"
        >
          Contestar — tem problema
        </Link>
      </div>

      <p className="mt-4 text-center text-xs text-gray-400">
        Se não confirmar em 24h (valor ≤ R$300) ou 48h (valor superior), o serviço será
        confirmado automaticamente e o prestador receberá o pagamento.
      </p>
    </div>
  )
}
