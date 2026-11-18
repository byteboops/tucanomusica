// ============================================================
// Tucano Música - Service Worker
// ============================================================

const VERSION = 'tucano_gostoso_v5';
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;

// ---------- SHELL ----------

const SHELL_ASSETS = [
  './',
  './index.html',
  './artistas.html',
  './faq.html',
  './login.html',
  './painel-de-controle.html',
  './privacidade.html',
  './releases.html',
  './manifest.webmanifest',
  './tucano.png',
  './favicon_tucano.svg',
  './tucano.svg'
];

// ---------- ASSETS ESTÁTICOS ----------

const STATIC_ASSETS = [
  // Imagens
  './Captura_de_tela_2026-11-16_190536-removebg-preview.png',
  './celular.jpg',
  './computador.jpg',
  './dinheiro.png',
  './praia.jpg',
  './sample.png',
  './spotify.png',
  './testi.png',
  './tucano-lindo-e-gostoso.png',
  './tucano_celuleiro.png',
  './tucano_computadorico.png',

  // SVGs
  './preto_tucano.svg',
  './pretocon.svg',

  // Áudios
  './alerta.wav',
  './botao.mp3',
  './sucessao.mp3',
  './sucesso.mp3',

  // Vídeos
  './acai-com-leite-ninho.mp4',
  './bosta.mp4',
  './sistema_tucanico.mp4',

  // Fontes
  './fonte.ttf',
  './kablammo.ttf',
  './tiktok.ttf'
];

// ---------- INSTALL ----------

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);

    await Promise.all(SHELL_ASSETS.map(async (url) => {
      try {
        await shell.add(new Request(url, { cache: 'reload' }));
      } catch (e) {
        console.warn('[SW] Shell falhou:', url, e);
      }
    }));

    const stat = await caches.open(STATIC_CACHE);

    await Promise.all(STATIC_ASSETS.map(async (url) => {
      try {
        await stat.add(new Request(url, { cache: 'reload' }));
      } catch (e) {
        console.warn('[SW] Static falhou:', url, e);
      }
    }));

    await self.skipWaiting();
  })());
});

// ---------- ACTIVATE ----------

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys
        .filter((key) => key !== SHELL_CACHE && key !== STATIC_CACHE)
        .map((key) => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

// ---------- FETCH ----------

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1. Supabase: nunca armazenar em cache.
  if (
    url.hostname.endsWith('supabase.co') ||
    url.hostname.endsWith('supabase.in')
  ) {
    return;
  }

  // 2. Arquivos estáticos: cache-first.
  const isStatic =
    /\.(mp3|wav|ogg|m4a|mp4|jpg|jpeg|png|gif|webp|svg|ico|ttf|otf|woff|woff2)$/i
      .test(url.pathname);

  if (isStatic) {
    event.respondWith((async () => {
      const cached = await caches.match(req);

      if (cached) return cached;

      try {
        const res = await fetch(req);

        if (res && res.ok) {
          const cache = await caches.open(STATIC_CACHE);
          cache.put(req, res.clone()).catch(() => {});
        }

        return res;
      } catch (e) {
        return new Response('', {
          status: 404,
          statusText: 'offline'
        });
      }
    })());

    return;
  }

  // 3. Navegação: network-first com cache individual.
  const isNavigation =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);

        if (res && res.ok) {
          const cache = await caches.open(SHELL_CACHE);
          cache.put(req, res.clone()).catch(() => {});
        }

        return res;
      } catch (e) {
        const cached = await caches.match(req);

        if (cached) return cached;

        const fallback =
          await caches.match('./index.html') ||
          await caches.match('./');

        if (fallback) return fallback;

        return new Response(
          '<h1>Offline</h1><p>Conecte-se à internet para carregar o Tucano Música.</p>',
          {
            status: 503,
            headers: {
              'Content-Type': 'text/html; charset=utf-8'
            }
          }
        );
      }
    })());

    return;
  }

  // 4. Demais requisições: network-first com fallback.
  event.respondWith((async () => {
    try {
      return await fetch(req);
    } catch (e) {
      return (
        await caches.match(req) ||
        new Response('', { status: 504 })
      );
    }
  })());
});

// ---------- MENSAGENS ----------

self.addEventListener('message', (event) => {
  const data = event.data || {};

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (data.type === 'CLEAR_CACHE') {
    event.waitUntil((async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys.map((key) => caches.delete(key))
      );

      if (event.source) {
        event.source.postMessage({
          type: 'CACHE_CLEARED'
        });
      }
    })());
  }
});
