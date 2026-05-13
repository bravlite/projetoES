'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { SERVICE_CATEGORIES, NEIGHBORHOODS } from '@/lib/constants'
import { createServiceRequest } from '@/server/requests'

const URGENCY_OPTIONS = [
  { value: 'today', label: 'Hoje' },
  { value: 'tomorrow', label: 'Amanhã' },
  { value: 'this_week', label: 'Esta semana' },
  { value: 'flexible', label: 'Sem pressa' },
]

const PERIOD_OPTIONS = [
  { value: 'anytime', label: 'Qualquer hora' },
  { value: 'morning', label: 'Manhã (7h–12h)' },
  { value: 'afternoon', label: 'Tarde (12h–18h)' },
  { value: 'evening', label: 'Noite (18h–21h)' },
]

export default function NovoPedidoPage() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await createServiceRequest(formData)
      if (result?.error) setError(result.error)
      // On success server action calls redirect('/pedidos/:id')
    })
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="mb-8">
        <Link href="/pedidos" className="text-sm text-gray-400 hover:text-gray-600">
          ← Meus pedidos
        </Link>
      </div>

      <h1 className="mb-2 text-2xl font-bold text-gray-900">Criar pedido</h1>
      <p className="mb-8 text-sm text-gray-500">
        Descreva o que precisa. Os prestadores da área enviarão orçamentos.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label htmlFor="category_slug" className="mb-1 block text-sm font-medium text-gray-700">
            Categoria <span className="text-red-500">*</span>
          </label>
          <select
            id="category_slug"
            name="category_slug"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">Selecione…</option>
            {SERVICE_CATEGORIES.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
            Descrição do problema <span className="text-red-500">*</span>
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            required
            minLength={20}
            placeholder="Descreva o que precisa ser feito, localização na casa, detalhes relevantes…"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <p className="mt-1 text-xs text-gray-400">Mínimo 20 caracteres.</p>
        </div>

        <div>
          <label htmlFor="neighborhood" className="mb-1 block text-sm font-medium text-gray-700">
            Bairro <span className="text-red-500">*</span>
          </label>
          <select
            id="neighborhood"
            name="neighborhood"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">Selecione…</option>
            {NEIGHBORHOODS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label htmlFor="street" className="mb-1 block text-sm font-medium text-gray-700">
              Rua
            </label>
            <input
              id="street"
              name="street"
              type="text"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label htmlFor="number" className="mb-1 block text-sm font-medium text-gray-700">
              Número
            </label>
            <input
              id="number"
              name="number"
              type="text"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="complement" className="mb-1 block text-sm font-medium text-gray-700">
            Complemento
          </label>
          <input
            id="complement"
            name="complement"
            type="text"
            placeholder="Apto, Bloco, Casa…"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="urgency" className="mb-1 block text-sm font-medium text-gray-700">
              Quando precisa?
            </label>
            <select
              id="urgency"
              name="urgency"
              defaultValue="flexible"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {URGENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="desired_period" className="mb-1 block text-sm font-medium text-gray-700">
              Período
            </label>
            <select
              id="desired_period"
              name="desired_period"
              defaultValue="anytime"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {isPending ? 'Publicando…' : 'Publicar pedido'}
        </button>
      </form>
    </div>
  )
}
