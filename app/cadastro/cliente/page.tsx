'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { signUp } from '@/server/auth'

export default function CadastroClientePage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const data = new FormData(e.currentTarget)
    const email = data.get('email') as string
    const password = data.get('password') as string

    const termsAccepted = data.get('terms') === 'on'
    startTransition(async () => {
      const result = await signUp(email, password, 'customer', termsAccepted)
      if (result.error) setError(result.error)
      if (result.success) setSuccess(result.success)
    })
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Criar conta</h1>
      <p className="mb-8 text-sm text-gray-500">
        Perfil completo (nome, endereço, tipo de conta) — próximo passo após o login.
      </p>

      {success ? (
        <div className="rounded-md bg-brand-50 p-4 text-sm text-brand-700">{success}</div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <p className="mt-1 text-xs text-gray-400">Mínimo 8 caracteres.</p>
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-600">
            <input type="checkbox" name="terms" required className="mt-0.5 shrink-0" />
            <span>
              Li e aceito os{' '}
              <Link href="/termos" target="_blank" className="text-brand-600 underline">
                Termos de Uso
              </Link>{' '}
              e a{' '}
              <Link href="/privacidade" target="_blank" className="text-brand-600 underline">
                Política de Privacidade
              </Link>
              .
            </span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {isPending ? 'Criando conta…' : 'Criar conta'}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-gray-500">
        Já tem conta?{' '}
        <Link href="/login" className="text-brand-600 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  )
}
