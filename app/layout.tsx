import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import Script from 'next/script'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/server/auth'
import './globals.css'

export const metadata: Metadata = {
  title: 'Concluído — Serviços em Vitória/Vila Velha',
  description: 'Contrate serviços domésticos e pague só quando estiver pronto.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Concluído',
  },
}

export const viewport: Viewport = {
  themeColor: '#2563eb',
}

function GuestNav() {
  return (
    <nav className="flex items-center gap-4 text-sm">
      <Link href="/login" className="text-gray-600 hover:text-gray-900">
        Entrar
      </Link>
      <Link
        href="/cadastro/cliente"
        className="rounded-md bg-brand-600 px-3 py-1.5 text-white hover:bg-brand-700"
      >
        Começar
      </Link>
    </nav>
  )
}

async function UserNav() {
  const envReady =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  if (!envReady) return <GuestNav />

  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return <GuestNav />

    const { data: rawProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = rawProfile as { role?: string } | null

    const dashboardHref =
      profile?.role === 'provider'
        ? '/prestador'
        : profile?.role === 'admin'
          ? '/admin'
          : '/cliente'

    return (
      <nav className="flex items-center gap-4 text-sm">
        <Link href={dashboardHref} className="text-gray-600 hover:text-gray-900">
          Painel
        </Link>
        <Link href="/pedidos" className="text-gray-600 hover:text-gray-900">
          Pedidos
        </Link>
        <form action={signOut}>
          <button type="submit" className="text-gray-400 underline hover:text-gray-600">
            Sair
          </button>
        </form>
      </nav>
    )
  } catch {
    return <GuestNav />
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Concluído" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <header className="border-b border-gray-200">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-bold text-brand-600">
              Concluído
            </Link>
            <UserNav />
          </div>
        </header>
        <main>{children}</main>
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').catch(() => {});
              });
            }
          `}
        </Script>
      </body>
    </html>
  )
}