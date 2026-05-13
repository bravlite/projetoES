'use client'

import { useState, useTransition } from 'react'
import { SERVICE_CATEGORIES, NEIGHBORHOODS } from '@/lib/constants'
import { upsertProviderProfile } from '@/server/profile'

export default function OnboardingPrestadorPage() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await upsertProviderProfile(formData)
      if (result?.error) setError(result.error)
      // On success server action calls redirect('/prestador').
    })
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Configure seu perfil profissional</h1>
      <p className="mb-8 text-sm text-gray-500">
        Seu perfil será revisado antes de aparecer para clientes.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div>
          <label htmlFor="display_name" className="mb-1 block text-sm font-medium text-gray-700">
            Nome profissional
          </label>
          <input
            id="display_name"
            name="display_name"
            type="text"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium text-gray-700">
            Telefone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="(27) 99999-9999"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label htmlFor="bio" className="mb-1 block text-sm font-medium text-gray-700">
            Sobre você
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={3}
            placeholder="Experiência, diferenciais, certificações…"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-gray-700">
            Categorias de serviço <span className="text-red-500">*</span>
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {SERVICE_CATEGORIES.map((cat) => (
              <label key={cat.slug} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="categories"
                  value={cat.slug}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                {cat.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-gray-700">
            Bairros atendidos <span className="text-red-500">*</span>
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {NEIGHBORHOODS.map((n) => (
              <label key={n} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="neighborhoods"
                  value={n}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                {n}
              </label>
            ))}
          </div>
        </fieldset>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {isPending ? 'Salvando…' : 'Enviar para aprovação'}
        </button>
      </form>
    </div>
  )
}
