// Block Blast service worker.
// Precache the app shell so the game installs to the desktop and still works
// offline, then keep Vite's hashed build assets in a runtime cache. There is no
// build-time manifest to maintain, so this file stays in sync automatically.
const CACHE_PREFIX = 'block-blast'
const SHELL_CACHE = `${CACHE_PREFIX}-shell-v1`
const RUNTIME_CACHE = `${CACHE_PREFIX}-runtime-v1`

const scopeUrl = new URL(self.registration.scope)
const shellUrl = new URL('./', scopeUrl).href
const SHELL_FILES = [
  './',
  'manifest.webmanifest',
  'favicon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
].map((file) => new URL(file, scopeUrl).href)

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith(CACHE_PREFIX) &&
                key !== SHELL_CACHE &&
                key !== RUNTIME_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

// Navigation: try the network first so a fresh deploy is picked up, then fall
// back to the cached shell when the player is offline.
async function handleNavigation(request) {
  const runtime = await caches.open(RUNTIME_CACHE)

  try {
    const response = await fetch(request)
    if (response.ok) await runtime.put(shellUrl, response.clone())
    return response
  } catch {
    return (
      (await runtime.match(request)) ??
      (await runtime.match(shellUrl)) ??
      (await caches.match(shellUrl)) ??
      Response.error()
    )
  }
}

// Assets: answer from cache instantly while refreshing in the background.
async function handleAsset(event, request) {
  const runtime = await caches.open(RUNTIME_CACHE)
  const cached = await runtime.match(request)
  const network = fetch(request).then((response) => {
    if (response.ok && response.type === 'basic') {
      runtime.put(request, response.clone())
    }
    return response
  })

  if (cached) {
    event.waitUntil(network.catch(() => {}))
    return cached
  }

  try {
    return await network
  } catch {
    return Response.error()
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    request.mode === 'navigate' ? handleNavigation(request) : handleAsset(event, request),
  )
})
