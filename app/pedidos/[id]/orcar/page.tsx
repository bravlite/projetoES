'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { submitQuote } from '@/server/requests'

export default function OrcarPage({ params }: { params: { id: string } }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const submitThisQuote = submitQuote.bind(null, params.id)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await submitThisQuote(formData)
      if (result?.error) setError(result.error)
      // On success, server action redirects to /pedidos/:id
    })
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <div className="mb-8">
        <Link
          href={`/pedidos/${params.id}`}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          ← Voltar ao pedido
        </Link>
      </div>

      <h1 className="mb-2 text-2xl font-bold text-gray-900">Enviar orçamento</h1>
      <p className="mb-8 text-sm text-gray-500">
        Você pode enviar apenas 1 orçamento por pedido. Verifique bem antes de confirmar.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="value" className="mb-1 block text-sm font-medium text-gray-700">
            Valor (R$) <span className="text-red-500">*</span>
          </label>
          <input
            id="value"
            name="value"
            type="number"
            min="10"
            step="0.01"
            required
            placeholder="150.00"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <p className="mt-1 text-xs text-gray-400">Inclua mão de obra. Materiais listados à parte nas observações.</p>
        </div>

        <div>
          <label
            htmlFor="estimated_minutes"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Duração estimada (minutos)
          </label>
          <input
            id="estimated_minutes"
            name="estimated_minutes"
            type="number"
            min="15"
            step="15"
            placeholder="120"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label htmlFor="notes" className="mb-1 block text-sm font-medium text-gray-700">
            Observações
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            placeholder="O que está incluso no orçamento, condições, etc."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {isPending ? 'Enviando…' : 'Enviar orçamento'}
        </button>
      </form>
    </div>
  )
}
