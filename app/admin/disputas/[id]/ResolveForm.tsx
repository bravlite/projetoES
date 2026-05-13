'use client'

import { useState, useTransition } from 'react'
import { resolveDispute } from '@/server/dispute'

const DECISION_OPTIONS = [
  { value: 'release_full', label: 'Liberar pagamento integral ao prestador' },
  { value: 'release_partial', label: 'Liberar pagamento parcial ao prestador' },
  { value: 'refund_full', label: 'Reembolso integral ao cliente' },
  { value: 'refund_partial', label: 'Reembolso parcial ao cliente' },
]

export default function ResolveForm({ disputeId }: { disputeId: string }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await resolveDispute(disputeId, formData)
      if (result?.error) setError(result.error)
      // on success, resolveDispute redirects
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="decision">
          Decisão
        </label>
        <select
          id="decision"
          name="decision"
          required
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Selecione a decisão</option>
          {DECISION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="justification">
          Justificativa
        </label>
        <textarea
          id="justification"
          name="justification"
          required
          minLength={10}
          rows={4}
          placeholder="Explique a decisão com base nas evidências..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
      >
        {isPending ? 'Salvando decisão...' : '✓ Resolver disputa'}
      </button>
    </form>
  )
}
