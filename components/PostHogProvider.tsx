'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// PostHog page tracking — só ativa se NEXT_PUBLIC_POSTHOG_KEY estiver definido.
// Para habilitar:
//   1. npm install posthog-js
//   2. Defina NEXT_PUBLIC_POSTHOG_KEY e NEXT_PUBLIC_POSTHOG_HOST no .env.local
//   3. Descomente o bloco abaixo

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY

  useEffect(() => {
    if (!key) return
    // Quando posthog-js for instalado, descomentar:
    // import('posthog-js').then(({ default: posthog }) => {
    //   if (!posthog.__loaded) {
    //     posthog.init(key, {
    //       api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com',
    //       capture_pageview: false,
    //     })
    //   }
    //   posthog.capture('$pageview')
    // })
  }, [pathname, key])

  return <>{children}</>
}
