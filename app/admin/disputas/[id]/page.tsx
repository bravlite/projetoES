import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SERVICE_CATEGORIES } from '@/lib/constants'
import ResolveForm from './ResolveForm'
import type { Profile, Dispute, DisputeMessage } from '@/types/database'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberta',
  awaiting_provider: 'Aguardando prestador',
  awaiting_admin: 'Aguardando admin',
  resolved: 'Resolvida',
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  awaiting_provider: 'bg-yellow-100 text-yellow-700',
  awaiting_admin: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
}

const REASON_LABELS: Record<string, string> = {
  service_incomplete: 'Serviço incompleto',
  quality_issue: 'Qualidade insatisfatória',
  no_show: 'Prestador não compareceu',
  overcharge: 'Cobrança indevida',
  damage: 'Dano causado pelo prestador',
  other: 'Outro motivo',
}

const DECISION_LABELS: Record<string, string> = {
  release_full: 'Pagamento liberado ao prestador (integral)',
  release_partial: 'Pagamento liberado ao prestador (parcial)',
  refund_full: 'Reembolso ao cliente (integral)',
  refund_partial: 'Reembolso ao cliente (parcial)',
}

const ROLE_LABELS: Record<string, string> = {
  customer: 'Cliente',
  provider: 'Prestador',
  admin: 'Admin',
}

export default async function AdminDisputaDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { resolved?: string }
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

  const { data: rawProfile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as Pick<Profile, 'role'> | null
  if (!profile || profile.role !== 'admin') redirect('/')

  // Busca disputa
  const { data: rawDispute } = await admin
    .from('disputes')
    .select('id, order_id, opened_by, provider_id, reason_code, description, status, decision, resolved_by, resolved_at, created_at')
    .eq('id', params.id)
    .single()
  const dispute = rawDispute as Dispute | null
  if (!dispute) notFound()

  // Busca pedido relacionado
  const { data: r } = await admin
    .from('service_requests')
    .select('id, category_slug, description, final_value_cents, status')
    .eq('id', dispute.order_id)
    .single()
  const req = r as {
    id: string
    category_slug: string
    description: string
    final_value_cents: number | null
    status: string
  } | null

  // Busca evidências do pedido (after)
  const { data: rawEvidence } = await admin
    .from('service_evidence')
    .select('id, kind, file_path, notes')
    .eq('request_id', dispute.order_id)
    .order('created_at', { ascending: false })

  type EvidenceRow = { id: string; kind: string; file_path: string; notes: string | null; url?: string }
  const evidenceList = (rawEvidence as EvidenceRow[]) ?? []

  // Signed URLs para evidências
  const evidenceWithUrls = await Promise.all(
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

  // Busca mensagens da disputa
  const { data: rawMessages } = await admin
    .from('dispute_messages')
    .select('id, author_id, author_role, body, created_at')
    .eq('dispute_id', params.id)
    .order('created_at', { ascending: true })
  const messages = (rawMessages as Omit<DisputeMessage, 'dispute_id'>[]) ?? []

  const cat = SERVICE_CATEGORIES.find((c) => c.slug === req?.category_slug)
  const isResolved = dispute.status === 'resolved'

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-6">
        <Link href="/admin/disputas" className="text-sm text-gray-400 hover:text-gray-600">
          ← Fila de disputas
        </Link>
      </div>

      {searchParams.resolved === '1' && (
        <div className="mb-6 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
          ✓ Disputa resolvida com sucesso.
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Disputa #{params.id.slice(0, 8)}</h1>
          <p className="mt-1 text-sm text-gray-500">
            Motivo: {REASON_LABELS[dispute.reason_code] ?? dispute.reason_code}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            STATUS_COLORS[dispute.status] ?? 'bg-gray-100 text-gray-600'
          }`}
        >
          {STATUS_LABELS[dispute.status] ?? dispute.status}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Coluna esquerda: pedido + evidências */}
        <div className="space-y-6">
          {/* Resumo do pedido */}
          {req && (
            <div className="rounded-lg border border-gray-200 p-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Pedido
              </h2>
              <p className="font-medium text-gray-900">{cat?.label ?? req.category_slug}</p>
              <p className="mt-1 text-sm text-gray-500 line-clamp-3">{req.description}</p>
              {req.final_value_cents != null && (
                <p className="mt-2 text-sm font-semibold text-gray-700">
                  Valor: R$ {(req.final_value_cents / 100).toFixed(2)}
                </p>
              )}
              <Link
                href={`/pedidos/${dispute.order_id}`}
                className="mt-2 inline-block text-xs text-brand-600 hover:underline"
              >
                Ver pedido completo →
              </Link>
            </div>
          )}

          {/* Evidências */}
          {evidenceWithUrls.length > 0 && (
            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Evidências ({evidenceWithUrls.length})
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {evidenceWithUrls.map((ev) => (
                  <div key={ev.id} className="overflow-hidden rounded-lg border border-gray-200">
                    {ev.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ev.url}
                        alt={ev.kind}
                        className="h-28 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-28 items-center justify-center bg-gray-100 text-xs text-gray-400">
                        Indisponível
                      </div>
                    )}
                    <p className="p-1.5 text-xs text-gray-500 capitalize">{ev.kind}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Decisão final (se resolvida) */}
          {isResolved && dispute.decision && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-green-600">
                Decisão
              </h2>
              <p className="text-sm font-medium text-green-800">
                {DECISION_LABELS[dispute.decision] ?? dispute.decision}
              </p>
              {dispute.resolved_at && (
                <p className="mt-1 text-xs text-green-500">
                  {new Date(dispute.resolved_at).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Coluna direita: thread + resolver */}
        <div className="space-y-6">
          {/* Thread de mensagens */}
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Mensagens ({messages.length})
            </h2>
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {messages.length === 0 && (
                <p className="text-sm text-gray-400">Sem mensagens.</p>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg p-3 text-sm ${
                    msg.author_role === 'admin'
                      ? 'border border-blue-200 bg-blue-50'
                      : msg.author_role === 'customer'
                        ? 'border border-gray-200 bg-gray-50'
                        : 'border border-orange-200 bg-orange-50'
                  }`}
                >
                  <p className="mb-0.5 text-xs font-semibold text-gray-500">
                    {ROLE_LABELS[msg.author_role] ?? msg.author_role}
                    {' · '}
                    {new Date(msg.created_at).toLocaleString('pt-BR')}
                  </p>
                  <p className="whitespace-pre-wrap text-gray-800">{msg.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Formulário de resolução */}
          {!isResolved && (
            <div className="rounded-lg border border-gray-200 p-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-700">Resolver disputa</h2>
              <ResolveForm disputeId={params.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
