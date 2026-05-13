'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { openDispute } from '@/server/dispute'

const REASON_LABELS: Record<string, string> = {
  service_incomplete: 'Serviço incompleto',
  quality_issue: 'Qualidade insatisfatória',
  no_show: 'Prestador não compareceu',
  overcharge: 'Cobrança indevida',
  damage: 'Dano causado pelo prestador',
  other: 'Outro motivo',
}

export default function DisputarPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await openDispute(params.id, formData)
      if (result?.error) setError(result.error)
      // on success, openDispute redirects — no need to handle here
    })
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="mb-6">
        <Link href={`/pedidos/${params.id}`} className="text-sm text-gray-400 hover:text-gray-600">
          ← Voltar ao pedido
        </Link>
      </div>

      <h1 className="mb-2 text-2xl font-bold text-gray-900">Abrir disputa</h1>
      <p className="mb-6 text-sm text-gray-500">
        Descreva o problema. O prestador terá a chance de responder antes da decisão final.
      </p>

      <div className="mb-6 rounded-md bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
        O pagamento ficará bloqueado até a resolução da disputa pelo administrador.
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="reason_code">
            Motivo
          </label>
          <select
            id="reason_code"
            name="reason_code"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Selecione um motivo</option>
            {Object.entries(REASON_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="description">
            Descrição do problema
          </label>
          <textarea
            id="description"
            name="description"
            required
            minLength={20}
            rows={5}
            placeholder="Descreva o que aconteceu em detalhes (mín. 20 caracteres)..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? 'Abrindo disputa...' : 'Confirmar — abrir disputa'}
        </button>
      </form>
    </div>
  )
}
