// ============================================================
// Tucano Música - Service Worker
// ============================================================
// Estratégias:
//  - Shell (HTML/CSS/JS/ícones): network-first com fallback de cache
//    → atualiza quando online, funciona offline se cair.
//  - Assets estáticos (imagens, áudios de efeito): cache-first
//    → carregam rápido e não dependem da rede pra tocar.
//  - Supabase Storage (status.txt, metadados.txt, etc.):
//    NUNCA cacheia → sempre vai à rede, senão status fica "preso"
//    e o artista acha que não foi aprovado.
//  - Supabase Auth/API: nunca cacheia.

const VERSION = 'tucano-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './tucano.png'
];

const STATIC_ASSETS = [
  './botao.mp3',
  './alerta.wav',
  './sucesso.mp3',
  './sucessao.mp3',
  './computador.jpg',
  './celular.jpg'
];

// ---------- INSTALL ----------
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    // addAll falha inteiro se um faltar; fazemos um por um pra não bloquear
    await Promise.all(SHELL_ASSETS.map(async (url) => {
      try { await shell.add(new Request(url, { cache: 'reload' })); }
      catch (e) { console.warn('[SW] shell falhou:', url, e); }
    }));
    const stat = await caches.open(STATIC_CACHE);
    await Promise.all(STATIC_ASSETS.map(async (url) => {
      try { await stat.add(new Request(url, { cache: 'reload' })); }
      catch (e) { console.warn('[SW] static falhou:', url, e); }
    }));
    self.skipWaiting();
  })());
});

// ---------- ACTIVATE ----------
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k !== SHELL_CACHE && k !== STATIC_CACHE)
      .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// ---------- FETCH ----------
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1) Supabase Storage / API / Auth: NUNCA cachear.
  //    status.txt, metadados.txt, mensagem.txt, candidatura.txt precisam
  //    ser sempre fresquinhos; senão o artista vê status antigo.
  if (url.hostname.endsWith('supabase.co') || url.hostname.endsWith('supabase.in')) {
    return; // deixa o navegador fazer o fetch normal
  }

  // 2) Áudios de efeito, imagens de fundo e ícones: cache-first.
  const isStatic = /\.(mp3|wav|ogg|m4a|jpg|jpeg|png|gif|webp|svg|ico)$/i.test(url.pathname);
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
        // se offline e sem cache, devolve 404 "vazio" pra não travar o áudio
        return new Response('', { status: 404, statusText: 'offline' });
      }
    })());
    return;
  }

  // 3) Navegação (HTML) e demais: network-first, fallback para cache.
  //    Assim você recebe atualização do site quando online e ainda
  //    consegue abrir quando offline.
  const isNavigation = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const cache = await caches.open(SHELL_CACHE);
          cache.put('./index.html', res.clone()).catch(() => {});
        }
        return res;
      } catch (e) {
        const cached = await caches.match('./index.html') || await caches.match('./');
        if (cached) return cached;
        return new Response(
          '<h1>Offline</h1><p>Abra o Tucano Música quando estiver conectado para carregar o app.</p>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
        );
      }
    })());
    return;
  }

  // 4) Resto (fetch normal): tenta rede, se falhar tenta cache.
  event.respondWith((async () => {
    try { return await fetch(req); }
    catch (e) { return (await caches.match(req)) || new Response('', { status: 504 }); }
  })());
});

// ---------- MENSAGENS ----------
// Permite ao app pedir "limpar cache e atualizar" se quiser.
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  if (data.type === 'CLEAR_CACHE') {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      if (event.source) event.source.postMessage({ type: 'CACHE_CLEARED' });
    })());
  }
});