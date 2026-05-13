import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { startService, markCompleted } from '@/server/completion'
import EvidenceUpload from './EvidenceUpload'
import type { ProviderProfile } from '@/types/database'

export const dynamic = 'force-dynamic'

const KIND_LABELS: Record<string, string> = {
  before: 'Antes',
  during: 'Durante',
  after: 'Depois',
}

const KIND_COLORS: Record<string, string> = {
  before: 'bg-blue-50 text-blue-700',
  during: 'bg-yellow-50 text-yellow-700',
  after: 'bg-green-50 text-green-700',
}

type Evidence = {
  id: string
  kind: string
  file_path: string
  notes: string | null
  created_at: string
  url: string | null
}

export default async function EvidenciasPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { missing?: string }
}) {
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

  // Busca pedido
  const { data: r } = await admin
    .from('service_requests')
    .select('id, status, current_provider_id, category_slug')
    .eq('id', params.id)
    .single()
  const req = r as {
    id: string
    status: string
    current_provider_id: string | null
    category_slug: string
  } | null
  if (!req) notFound()

  // Só prestadores atribuídos podem acessar esta página
  const { data: pp } = await admin
    .from('provider_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()
  const providerProfile = pp as ProviderProfile | null

  if (!providerProfile || req.current_provider_id !== providerProfile.id) {
    redirect(`/pedidos/${params.id}`)
  }

  const canAct = ['checked_in', 'in_progress'].includes(req.status)
  if (!canAct) {
    redirect(`/pedidos/${params.id}`)
  }

  // Busca evidências existentes
  const { data: rawEvidence } = await admin
    .from('service_evidence')
    .select('id, kind, file_path, notes, created_at')
    .eq('request_id', params.id)
    .eq('provider_id', providerProfile.id)
    .order('created_at', { ascending: false })

  const evidenceList = (rawEvidence as Omit<Evidence, 'url'>[]) ?? []

  // Gera URLs assinadas para exibir as fotos (1h de validade)
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

  const hasAfterEvidence = evidenceWithUrls.some((ev) => ev.kind === 'after')

  const startAction = startService.bind(null, params.id)
  const completeAction = markCompleted.bind(null, params.id)

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-6">
        <Link href={`/pedidos/${params.id}`} className="text-sm text-gray-400 hover:text-gray-600">
          ← Voltar ao pedido
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Evidências do serviço</h1>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            req.status === 'checked_in'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-yellow-100 text-yellow-700'
          }`}
        >
          {req.status === 'checked_in' ? 'Check-in realizado' : 'Em execução'}
        </span>
      </div>

      {/* Aviso: foto after obrigatória */}
      {searchParams.missing === 'after' && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
          Envie pelo menos 1 foto &ldquo;Depois do serviço&rdquo; antes de marcar como concluído.
        </div>
      )}

      {/* Botão iniciar serviço (checked_in → in_progress) */}
      {req.status === 'checked_in' && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="mb-3 text-sm text-blue-700">
            Check-in confirmado. Envie fotos do estado inicial e inicie o serviço quando pronto.
          </p>
          <form action={startAction}>
            <button
              type="submit"
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Iniciar serviço →
            </button>
          </form>
        </div>
      )}

      {/* Upload de evidências */}
      <div className="mb-6">
        <EvidenceUpload requestId={params.id} hasAfterEvidence={hasAfterEvidence} />
      </div>

      {/* Lista de evidências enviadas */}
      {evidenceWithUrls.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Fotos enviadas ({evidenceWithUrls.length})
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {evidenceWithUrls.map((ev) => (
              <div key={ev.id} className="overflow-hidden rounded-lg border border-gray-200">
                {ev.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ev.url}
                    alt={`${KIND_LABELS[ev.kind] ?? ev.kind}`}
                    className="h-32 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-32 items-center justify-center bg-gray-100 text-xs text-gray-400">
                    Pré-visualização indisponível
                  </div>
                )}
                <div className="p-2">
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${KIND_COLORS[ev.kind] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {KIND_LABELS[ev.kind] ?? ev.kind}
                  </span>
                  {ev.notes && (
                    <p className="mt-1 truncate text-xs text-gray-500">{ev.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botão marcar concluído (in_progress com foto after) */}
      {req.status === 'in_progress' && (
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="mb-3 text-sm text-gray-600">
            {hasAfterEvidence
              ? 'Foto final enviada. Confirme que o serviço foi concluído.'
              : 'Envie pelo menos 1 foto "Depois do serviço" para continuar.'}
          </p>
          <form action={completeAction}>
            <button
              type="submit"
              disabled={!hasAfterEvidence}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ✓ Marcar como concluído
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
