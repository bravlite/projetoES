// Service Worker — Concluído PWA
// Estratégia:
//   - App shell (/, /login, /cadastro/*) → Cache First (instalação)
//   - Páginas de pedidos (/pedidos, /pedidos/*) → Network First com fallback para cache
//   - API routes → Network Only (nunca cachear)
//   - Assets estáticos (_next/static) → Cache First, imutáveis

const CACHE_NAME = 'concluido-v1'
const OFFLINE_URL = '/offline'

const PRECACHE_URLS = [
  '/',
  '/login',
  '/cadastro/cliente',
  '/cadastro/prestador',
  '/pedidos',
]

// Instalação: pré-cacheia o app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch(() => {
        // Ignora falhas individuais (página pode precisar de auth)
      })
    )
  )
  self.skipWaiting()
})

// Ativação: remove caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// Fetch: estratégia por rota
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignora requests não-GET e cross-origin
  if (request.method !== 'GET') return
  if (url.origin !== location.origin) return

  // API routes → Network Only
  if (url.pathname.startsWith('/api/')) return

  // Assets imutáveis (_next/static) → Cache First
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
      })
    )
    return
  }

  // Páginas de pedidos e navegação → Network First com fallback cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cacheia respostas bem-sucedidas de páginas navegáveis
        if (response.ok && response.type === 'basic') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => {
        // Offline: tenta servir do cache
        return caches.match(request).then((cached) => {
          if (cached) return cached
          // Fallback: lista de pedidos cacheada
          if (url.pathname.startsWith('/pedidos')) {
            return caches.match('/pedidos')
          }
          return new Response(
            '<html><body style="font-family:sans-serif;padding:2rem"><h1>Sem conexão</h1><p>Verifique sua internet e tente novamente.</p><a href="/pedidos">Ver pedidos (cache)</a></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          )
        })
      })
  )
})
