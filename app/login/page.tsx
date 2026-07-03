'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { signIn } from '@/server/auth'
import { LogoMark } from '@/components/Logo'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const data = new FormData(e.currentTarget)
    const email = data.get('email') as string
    const password = data.get('password') as string

    startTransition(async () => {
      const result = await signIn(email, password)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <div className="card !p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <LogoMark className="mb-3 h-12 w-12" />
          <h1 className="text-2xl font-bold tracking-tight text-brand-900">
            Bem-vindo de volta
          </h1>
          <p className="mt-1 text-sm text-gray-500">Entre para acompanhar seus pedidos.</p>
        </div>

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
              className="w-full px-3.5 py-2.5 text-sm"
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
              autoComplete="current-password"
              className="w-full px-3.5 py-2.5 text-sm"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <button type="submit" disabled={isPending} className="btn-primary disabled:opacity-50">
            {isPending ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-gray-500">
        Não tem conta?{' '}
        <Link href="/cadastro/cliente" className="font-medium text-brand-700 hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  )
}
