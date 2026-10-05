/* Service Worker — Tucano Música */
const CACHE = 'tucano-v1';
const ASSETS = [
  './',
  './index.html',
  './candidatura.html',
  './candidatura-ok.html',
  './contrato-pergunta.html',
  './contrato-knitting.html',
  './contrato-assinado.html',
  './contrato-nenhum.html',
  './contrato-form.html',
  './contrato.html',
  './dashboard.html',
  './novo-tipo.html',
  './novo-faixas.html',
  './novo-capa.html',
  './suporte.html',
  './videoclipe.html',
  './manifest.json',
  './manifest.png',
  './resize.png',
  './tucano.png'
];

// Instala e faz cache de tudo
self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return Promise.all(ASSETS.map(function(url){
        return c.add(url).catch(function(){ /* ignora 404 individual */ });
      }));
    })
  );
  self.skipWaiting();
});

// Ativa e limpa caches antigos
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE; })
            .map(function(k){ return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: cache-first com fallback pra rede
self.addEventListener('fetch', function(e){
  if(e.request.method !== 'GET') return;

  // Não cacheia chamadas do Supabase (Storage, Auth, etc.)
  if(e.request.url.indexOf('supabase.co') !== -1) return;

  e.respondWith(
    caches.match(e.request).then(function(cached){
      if(cached) return cached;
      return fetch(e.request).then(function(res){
        if(res && res.status === 200 && res.type === 'basic'){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
        }
        return res;
      }).catch(function(){
        // Offline: devolve index como fallback
        return caches.match('./index.html');
      });
    })
  );
});