// ============================================================
// TUCANO MÚSICA — APP.JS (reescrito)
// ============================================================
const SUPABASE_URL = 'https://mjqwiqjojkzobuysziyv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qcXdpcWpvamt6b2J1eXN6aXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3Nzc4MzMsImV4cCI6MjEwNjM1MzgzM30.w4zDJdmAOmZBnvfXHZ3YDu2qfiUs_gSOnccY0S2ahG8';
const BUCKET = 'releases';
const CACHE_VERSION = 'tucano_gostoso_v4';
const SESSION_KEY = 'tucano_session_v2';
const SESSION_LEGACY_KEY = 'sessao_tucano_contas_v1';
const THEME_KEY = 'tucano_theme';
const STATE_PREFIX = CACHE_VERSION + '_state_';
const STATUS_POLL_MS = 30000;

const GENRES = ['Sertanejo','Country','Pop','Rock','Metal','Hip Hop','Funk','Samba','Pagode','MPB','R&B','Jazz','Eletrônica','Coral','Orquestra','Phonk','Gospel','Forró','Boom Bap','J-pop','K-pop','Trip Hop','Piano','Ambiente','Infantil','Comédia','Música Clássica','Reggae','Louvor','Reggaeton','Dubstep','Halloween/Terror'];

const STATUS_COLORS = {
  'Ao Vivo':{bg:'rgba(163,230,53,.15)',color:'#a3e635'},
  'Aprovado':{bg:'rgba(34,197,94,.15)',color:'#22c55e'},
  'Revisão':{bg:'rgba(251,191,36,.15)',color:'#fbbf24'},
  'Rejeitado':{bg:'rgba(239,68,68,.15)',color:'#ef4444'},
  'Em edição':{bg:'rgba(100,116,139,.15)',color:'#94a3b8'}
};

const LICENSE_OPTIONS = [
  { v:'direitos', l:'Direitos Autorais (do próprio artista)' },
  { v:'cc0', l:'Creative Commons CC0' },
  { v:'cc-by', l:'Creative Commons CC BY' },
  { v:'cc-by-nd', l:'Creative Commons CC BY-ND' }
];

const state = {
  user:null, page:'landing', draft:{}, catalog:'releases',
  statusPollTimer:null, statusFetching:false, accountsCache:{},
  carouselDrag:null
};

// ============================================================
// UTILITÁRIOS
// ============================================================
function normUser(u){ return String(u||'').trim().toLowerCase(); }
function $(sel,ctx){ return (ctx||document).querySelector(sel); }
function $$(sel,ctx){ return Array.from((ctx||document).querySelectorAll(sel)); }
function esc(s){
  return String(s==null?'':s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function fmtDate(d){
  if(!d) return '';
  try{
    const dt = (typeof d==='string' && d.length===10) ? new Date(d+'T12:00:00') : new Date(d);
    return dt.toLocaleDateString('pt-BR');
  }catch(e){ return String(d); }
}
function uid(){
  if(window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return Date.now().toString(36)+Math.random().toString(36).slice(2,10);
}
function datePlus(days){ const d=new Date(); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }
function safePathUser(u){
  return String(u||'anon').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/g,'_').slice(0,40)||'anon';
}
function safeName(n){
  return String(n||'file').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w.\-]+/g,'_').slice(0,80);
}
function normStatus(s){
  return String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}
function displayStatus(s){
  const n = normStatus(s);
  if(n==='ao vivo') return 'Ao Vivo';
  if(n==='aprovado') return 'Aprovado';
  if(n==='revisao') return 'Revisão';
  if(n==='rejeitado') return 'Rejeitado';
  if(n==='rascunho') return 'Em edição';
  return s || 'Em edição';
}
function getStatusColor(status){ return STATUS_COLORS[displayStatus(status)] || STATUS_COLORS['Em edição']; }
function isBlocked(){
  const u = state.user; if(!u) return true;
  return !!(u.disabled || u.rescinded || u.deleted);
}

function generateNumericId(existing){
  const used = new Set((existing||[]).map(r=>String(r.id)));
  let tries = 0;
  while(tries < 9000){
    const n = 1000 + Math.floor(Math.random()*9000);
    if(!used.has(String(n))) return n;
    tries++;
  }
  for(let n=1000;n<=9999;n++){ if(!used.has(String(n))) return n; }
  return Date.now() % 9000 + 1000;
}
async function fetchJsonFile(path){
  const txt = await fetchTextFile(path);
  if(!txt) return null;
  try { 
    return JSON.parse(txt); 
  } catch(e) { 
    console.warn("JSON quebrado. Tentando consertar...");
    try {
      // Remove quebras de linha reais dentro de aspas
      let fixed = txt.replace(/[\r\n]+/g, ' '); 
      // Tenta de novo
      return JSON.parse(fixed);
    } catch(e2) {
      console.error("Falha ao consertar o JSON:", e2);
      return null;
    }
  }
}

// ============================================================
// DELTA DE ESTADO
// ============================================================
const DELTA_FIELDS = [
  'releases','artists','videoReleases',
  'answeredContract','contractType','contractSigned','contractPdfDownloaded',
  'knittingAcknowledged','hasRealContract',
  'disabled','rescinded','deleted',
  'bandMembers','isBand'
];

function loadDelta(username){
  try{
    const raw = localStorage.getItem(STATE_PREFIX + normUser(username));
    if(!raw) return {};
    const obj = JSON.parse(raw);
    return (obj && typeof obj==='object') ? obj : {};
  }catch(e){ return {}; }
}
function saveDelta(username, delta){
  const clean = {};
  for(const k of DELTA_FIELDS){ if(k in delta) clean[k] = delta[k]; }
  localStorage.setItem(STATE_PREFIX + normUser(username), JSON.stringify(clean));
}
function clearDelta(username){ localStorage.removeItem(STATE_PREFIX + normUser(username)); }

function mergeAccount(base, delta){
  const merged = { ...base, ...delta };
  if(!Array.isArray(merged.releases)) merged.releases = [];
  if(!Array.isArray(merged.videoReleases)) merged.videoReleases = [];
  if(!Array.isArray(merged.artists)) merged.artists = [];
  if(!Array.isArray(merged.bandMembers)) merged.bandMembers = [];
  return merged;
}

function persistUser(){
  if(!state.user) return;
  const delta = {};
  for(const k of DELTA_FIELDS){ if(k in state.user) delta[k] = state.user[k]; }
  saveDelta(state.user.username, delta);
  const key = normUser(state.user.username);
  localStorage.setItem(SESSION_KEY, key);
  localStorage.setItem(SESSION_LEGACY_KEY, key);
}

// ============================================================
// SUPABASE E ARQUIVOS
// ============================================================
let _sb = null;
function getSupabase(){
  if(!window.supabase) throw new Error('Biblioteca do Supabase não carregou.');
  if(!_sb) _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _sb;
}

async function uploadFile(file, path){
  const sb = getSupabase();
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { cacheControl:'3600', upsert:true });
  if(error) throw new Error('Supabase: '+(error.message||JSON.stringify(error)));
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function uploadText(text, path){
  const blob = new Blob([text], { type:'text/plain;charset=utf-8' });
  const file = new File([blob], safeName(path.split('/').pop()), { type:'text/plain' });
  return await uploadFile(file, path);
}

async function deleteFolderFiles(folderPath){
  const sb = getSupabase();
  const { data, error } = await sb.storage.from(BUCKET).list(folderPath);
  if(error){ console.warn('list error', error); return; }
  if(!data || !data.length) return;
  const paths = data.map(f => folderPath + '/' + f.name);
  const { error: delErr } = await sb.storage.from(BUCKET).remove(paths);
  if(delErr) console.warn('remove error', delErr);
}

async function fetchTextFile(path){
  try{
    const sb = getSupabase();
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    if(!data || !data.publicUrl) return null;
    const res = await fetch(data.publicUrl);
    if(!res.ok) return null;
    return await res.text();
  }catch(e){ return null; }
}

async function fetchJsonFile(path){
  const txt = await fetchTextFile(path);
  if(!txt) return null;
  try{ return JSON.parse(txt); }catch(e){ return null; }
}

function parseStatusTxt(txt){
  if(!txt) return null;
  const s = txt.match(/^\s*Status\s*:\s*(.*)$/mi);
  const m = txt.match(/^\s*Motivo\s*:\s*(.*)$/mi);
  return { status: s ? (s[1].trim() || null) : null, motivo: m ? m[1].trim() : '' };
}

// ============================================================
// CONTAS E LOGIN
// ============================================================
async function loadAccount(username){
  const safe = safePathUser(username);
  if(state.accountsCache[safe]) return state.accountsCache[safe];
  const json = await fetchJsonFile(`${safe}.json`);
  if(!json) return null;
  state.accountsCache[safe] = json;
  return json;
}

async function loginAccount(username, password){
  const base = await loadAccount(username);
  if(!base) return { ok:false, error:'Conta não encontrada. Se você ainda não tem conta, use o Contate-nos.' };
  if(String(base.password) !== String(password)) return { ok:false, error:'Senha incorreta.' };
  const delta = loadDelta(base.username || username);
  const merged = mergeAccount(base, delta);
  return { ok:true, user: merged };
}

// ============================================================
// SONS
// ============================================================
const soundCache = {};
function playSound(name){
  try{
    const files = { botao:'./botao.mp3', alerta:'./alerta.wav', sucesso:'./sucesso.mp3', sucessao:'./sucessao.mp3' };
    const src = files[name]; if(!src) return;
    if(!soundCache[src]){ soundCache[src] = new Audio(src); soundCache[src].preload='auto'; }
    const a = soundCache[src].cloneNode(); a.volume = 0.6; a.play().catch(()=>{});
  }catch(e){}
}

// ============================================================
// POLLING DE STATUS
// ============================================================
async function refreshReleaseStatuses(){
  if(!state.user || state.statusFetching) return;
  state.statusFetching = true;
  let changed = false;
  try{
    for(const r of (state.user.releases || [])){
      if(!r.basePath) continue;
      const txt = await fetchTextFile(`${r.basePath}/status.txt`);
      if(!txt) continue;
      const p = parseStatusTxt(txt); if(!p || !p.status) continue;
      const disp = displayStatus(p.status);
      if(disp !== r.status || p.motivo !== (r.motivo||'')){
        r.status = disp; r.motivo = p.motivo; changed = true;
      }
    }
    if(changed){
      persistUser();
      if((state.page==='dashboard' || state.page==='catalogs') && !document.activeElement?.matches?.('input,select,textarea')){
        render();
      }
    }
  }catch(e){ console.warn('refreshReleaseStatuses', e); }
  finally{ state.statusFetching = false; }
}

function startStatusPolling(){
  if(state.statusPollTimer) return;
  if(!state.user) return;
  refreshReleaseStatuses();
  state.statusPollTimer = setInterval(()=>{ if(state.user) refreshReleaseStatuses(); }, STATUS_POLL_MS);
}
function stopStatusPolling(){
  if(state.statusPollTimer){ clearInterval(state.statusPollTimer); state.statusPollTimer = null; }
}

// ============================================================
// RENDER PRINCIPAL
// ============================================================
function render(){
  const app = $('#app'); if(!app) return;
  let html=''; let binder=null;

  if(state.page==='login'){ html=viewLogin(); binder=bindLogin; }
  else if(!state.user){ html=viewLanding(); binder=bindLanding; }
  else if(!state.user.answeredContract){ html=viewContractQuestion(); binder=bindContractQuestion; }
  else if(state.user.contractType==='knitting' && !state.user.knittingAcknowledged){ html=viewKnitting(); binder=bindKnitting; }
  else if(state.user.contractType==='none' && !state.user.contractSigned){ html=viewNoneOption(); binder=bindNoneOption; }
  else if(state.user.contractType==='none' && state.user.contractSigned && !state.user.contractPdfDownloaded){ html=viewContractSigned(); binder=bindContractSigned; }
  else if(state.page==='physical'){ html=viewPhysicalDate(); binder=bindPhysicalDate; }
  else if(state.page==='settings'){ html=viewSettings(); binder=bindSettings; }
  else if(state.page==='catalogs'){ html=viewCatalogs(); binder=bindCatalogs; }
  else if(state.page==='support'){ html=viewSupport(); binder=bindSupport; }
  else if(state.page==='video'){ html=viewVideo(); binder=bindVideo; }
  else if(state.page==='type'){ html=viewType(); binder=bindType; }
  else if(state.page==='cover'){ html=viewCover(); binder=bindCover; }
  else if(state.page==='tracks'){ html=viewTracks(); binder=bindTracks; }
  else { html=viewDashboard(); binder=bindDashboard; }

  app.innerHTML = html;
  if(binder) binder();
  document.documentElement.setAttribute('data-theme', localStorage.getItem(THEME_KEY) || 'dark');
}

// ============================================================
// LANDING PAGE
// ============================================================
const CARDS = [
  { id:'sec-a', img:'./sample.png', type:'img', label:'Seja curado em playlists' },
  { id:'sec-b', img:'./sistema_tucanico.mp4', type:'video', label:'Distribua sua música em uma cacetada de DSPs' },
  { id:'sec-c', img:'./dinheiro.png', type:'img', label:'Receba 75% dos seus royalties' },
  { id:'sec-d', img:'./spotify.png', type:'img', label:'Tenha fácil acesso ao Spotify for Artists' }
];

function viewLanding(){
  const carousel = CARDS.concat(CARDS);
  return `
    <div class="landing-bg" id="landing-bg" style="background-image:url('./praia.jpg')"></div>

    <header class="sticky top-0 z-50 backdrop-blur-md" style="background:rgba(11,31,19,.85);border-bottom:1px solid var(--glass-border)">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <a href="#top" class="flex items-center gap-2" style="text-decoration:none;color:inherit">
          <img src="./tucano.png" alt="Tucano" width="40" height="40" style="border-radius:10px" onerror="this.style.display='none'">
          <span class="kab text-lg">Tucano Música</span>
        </a>
        <nav class="flex items-center gap-2 text-sm">
          <a href="https://plataformasknitting.vercel.app" target="_blank" rel="noopener noreferrer" class="btn-secondary text-sm" style="text-decoration:none"><i class="fas fa-handshake"></i> Parceiros</a>
        </nav>
      </div>
    </header>

    <section id="top" class="min-h-screen flex items-center justify-center p-4 jungle-texture">
      <div class="max-w-5xl w-full fade-in-scale">
        <div class="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h1 class="kab text-3xl md:text-5xl leading-tight">Já pensou em ver sua música em <span style="color:#a3e635">+480 plataformas</span>?</h1>
            <p class="tts mt-4 text-slate-300 text-lg">Distribua sua música em 480+ plataformas, uploads ilimitados e ganhe 75% dos seus royalties.</p>
            <div class="leaf-divider"></div>
          </div>
          <div class="flex flex-col items-center justify-center">
            <img src="./tucano.png" alt="Tucano Música" class="float mb-4" style="max-width:240px;height:auto;" onerror="this.style.display='none'">
            <h2 class="kab text-2xl" style="text-shadow:0 2px 14px rgba(0,0,0,.95)">Tucano Música</h2>
            <p class="tts text-slate-300 text-sm mt-1" style="text-shadow:0 2px 12px rgba(0,0,0,.95)">Distribuição musical digital</p>
          </div>
        </div>
      </div>
    </section>

    <section class="white-block py-16">
      <div class="max-w-6xl mx-auto px-4">
        <h2 class="kab text-3xl md:text-4xl text-center">Se liga no que a gente faz pra você:</h2>
        <div class="overflow-hidden mt-8" style="mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)">
          <div class="carousel-track" id="carousel">
            ${carousel.map(c=>`
              <button class="carousel-card" data-scroll="${c.id}">
                ${c.type==='video'
                  ? `<video src="${c.img}" autoplay muted loop playsinline></video>`
                  : `<img src="${c.img}" alt="">`}
                <p>${esc(c.label)}</p>
              </button>`).join('')}
          </div>
        </div>

        <div class="mt-20 space-y-24">
          <div id="sec-b" class="scroll-mt-24 rounded-3xl overflow-hidden">
            <video src="./sistema_tucanico.mp4" autoplay muted loop playsinline class="w-full" style="display:block;max-height:60vh;object-fit:cover"></video>
            <div class="p-8 md:p-12" style="background:rgba(6,78,59,.92)">
              <h3 class="kab text-3xl" style="color:#fff">Distribua sua música em uma cacetada de DSPs</h3>
              <p class="tts mt-4 text-lg" style="color:#e5e7eb">São +480 plataformas para onde a sua música vai! Veja elas em <a href="https://plataformasknitting.vercel.app" target="_blank" rel="noopener noreferrer" style="color:#a3e635;text-decoration:underline">https://plataformasknitting.vercel.app</a>.</p>
            </div>
          </div>
          <div id="sec-a" class="scroll-mt-24 rounded-3xl overflow-hidden">
            <img src="./sample.png" alt="" class="w-full" style="display:block;max-height:60vh;object-fit:cover">
            <div class="p-8 md:p-12" style="background:rgba(6,78,59,.92)">
              <h3 class="kab text-3xl" style="color:#fff">Seja curado em playlists</h3>
              <p class="tts mt-4 text-lg" style="color:#e5e7eb">A Tucano Música é uma sub-empresa de uma gravadora chamada Knitting Records™. A Knitting te curará. Entre em playlists públicas e playlists da própria Tucano!</p>
            </div>
          </div>
          <div id="sec-c" class="scroll-mt-24 rounded-3xl overflow-hidden">
            <img src="./dinheiro.png" alt="" class="w-full" style="display:block;max-height:60vh;object-fit:cover">
            <div class="p-8 md:p-12" style="background:rgba(6,78,59,.92)">
              <h3 class="kab text-3xl" style="color:#fff">Receba 75% dos seus royalties</h3>
              <p class="tts mt-4 text-lg" style="color:#e5e7eb">Você cede uma pequena comissão de 25% dos royalties a Tucano para nossos sistemas continuarem operando!</p>
            </div>
          </div>
          <div id="sec-d" class="scroll-mt-24 rounded-3xl overflow-hidden">
            <img src="./spotify.png" alt="" class="w-full" style="display:block;max-height:60vh;object-fit:cover">
            <div class="p-8 md:p-12" style="background:rgba(6,78,59,.92)">
              <h3 class="kab text-3xl" style="color:#fff">Tenha fácil acesso ao Spotify for Artists</h3>
              <p class="tts mt-4 text-lg" style="color:#e5e7eb">A Tucano reivindica o seu perfil do Spotify for Artists e você pode solicitar acesso ao seu perfil! Mas não mexemos em nada nele.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- NOVO BLOCO VERDE: Gerencie todos os seus lançamentos! -->
    <section class="py-16" style="background:#166534">
      <div class="max-w-6xl mx-auto px-4 text-center">
        <img src="./tucano.png" alt="Tucano Música" style="max-width:120px;border-radius:16px;margin:0 auto 16px" onerror="this.style.display='none'">
        <h2 class="kab text-3xl md:text-4xl" style="color:#fff">Gerencie todos os seus lançamentos!</h2>
        <p class="tts mt-3" style="color:#dcfce7">Um painel único para acompanhar status, catálogo, royalties e suporte.</p>

        <!-- Botão Portal do Artista -->
        <div class="mt-6">
          <button id="portal-artista-btn" class="btn-primary text-base" style="padding:.9rem 2rem;font-size:1rem"><i class="fas fa-right-to-bracket"></i> Portal do Artista</button>
        </div>

        <!-- As duas imagens lado a lado -->
        <div class="mt-8 flex flex-wrap items-center justify-center gap-6">
          <img
            src="./tucano_celuleiro.png"
            alt="Tucano no celular"
            class="rounded-2xl"
            style="display:block;width:min(100%, 420px);height:auto;object-fit:contain;background:rgba(255,255,255,.05);padding:8px"
            onerror="this.style.display='none'; this.insertAdjacentHTML('afterend','<div style=\'color:#dcfce7;font-size:14px;padding:16px\'>⚠️ tucano_celuleiro.png não encontrado</div>')"
          >
          <img
            src="./tucano_computadorico.png"
            alt="Tucano no computador"
            class="rounded-2xl"
            style="display:block;width:min(100%, 420px);height:auto;object-fit:contain;background:rgba(255,255,255,.05);padding:8px"
            onerror="this.style.display='none'; this.insertAdjacentHTML('afterend','<div style=\'color:#dcfce7;font-size:14px;padding:16px\'>⚠️ tucano_computadorico.png não encontrado</div>')"
          >
        </div>
      </div>
    </section>

    <!-- AVALIAÇÕES -->
    <section class="py-16 jungle-texture">
      <div class="max-w-6xl mx-auto px-4">
        <h2 class="kab text-3xl text-center mb-8">O que dizem por aí</h2>
        <div class="grid md:grid-cols-3 gap-4">
          ${[
            {n:'Lucas M.',s:5,t:'Subi meu single e em duas semanas já estava no ar. A curadoria deles é real.'},
            {n:'Bia R.',s:5,t:'O painel é simples e o suporte respondeu no mesmo dia. Recomendo.'},
            {n:'Pedro K.',s:4,t:'Bom demais para quem tá começando. O contrato é justo e sem enrolação.'}
          ].map(r=>`
            <div class="review-card p-6">
              <div class="text-yellow-400 mb-2">${'★'.repeat(r.s)}${'☆'.repeat(5-r.s)}</div>
              <p class="review-text text-sm mb-3">${esc(r.t)}</p>
              <p class="review-name text-sm font-semibold">— ${esc(r.n)}</p>
            </div>`).join('')}
        </div>
      </div>
    </section>

    <!-- Bloco final: Sua carreira nos agradece (fundo computador.jpg) -->
    <section class="py-16 flex flex-col items-center justify-center relative" style="background:url('./computador.jpg') center/cover no-repeat #052e16">
      <div style="position:absolute;inset:0;background:rgba(5,46,22,.55)"></div>
      <div class="relative z-10 flex flex-col items-center">
        <img src="./tucano.png" alt="Tucano Música" style="max-width:200px;border-radius:20px;margin-bottom:20px" onerror="this.style.display='none'">
        <h2 class="kab text-4xl text-center" style="color:#a3e635;text-shadow:0 2px 10px rgba(0,0,0,0.7)">Sua carreira nos agradece</h2>
      </div>
    </section>

    <!-- FAQ -->
    <section class="py-16" style="background:var(--bg-secondary)">
      <div class="max-w-3xl mx-auto px-4">
        <h2 class="kab text-3xl text-center mb-8">Perguntas frequentes</h2>
        <div class="glass p-6" id="faq-list">
          ${[
            {q:'Tem contrato?',a:'Sim, mas é um totalmente flexível e justo! Serve para evitar problemas ou simplicidade.'},
            {q:'É fácil de usar?',a:'Sim! É igual uma distribuidora normal: faça o upload, preencha os campos e envie para a revisão. Temos distribuição de vídeoclipe também.'},
            {q:'Como funciona o cadastro?',a:'Você passa por um processo de aprovação de artista, não operamos como self-service.'},
            {q:'Em quanto tempo minha música chega nas plataformas?',a:'Na data em que você selecionar, mas temos um mínimo de 14 dias para áudio e 28 dias para vídeo.'},
            {q:'Em quanto tempo o suporte responderá minhas reclamações?',a:'Em cerca de 1-5 dias corridos. Pode variar.'}
          ].map((f,i)=>`
            <div class="faq-item" data-faq="${i}">
              <button class="faq-q">${esc(f.q)}<i class="fas fa-chevron-down"></i></button>
              <div class="faq-a">${esc(f.a)}</div>
            </div>`).join('')}
        </div>
        <div class="glass p-6 mt-6">
          <label>Envie sua pergunta</label>
          <div class="flex gap-2">
            <input id="faq-q" type="text" placeholder="Sua pergunta...">
            <button id="faq-send" class="btn-primary whitespace-nowrap">Enviar</button>
          </div>
          <div id="faq-msg" class="text-sm mt-3"></div>
        </div>
      </div>
    </section>

    <!-- CONTATO -->
    <section id="contato" class="py-16 scroll-mt-20" style="background:var(--bg-primary)">
      <div class="max-w-2xl mx-auto px-4">
        <h2 class="kab text-3xl text-center mb-6">Contate-nos</h2>
        <p class="tts text-center text-slate-300 mb-6">Quer usar a Tucano, reclamar do serviço ou dar uma avaliação? É aqui.</p>
        <div class="glass p-6 space-y-4">
          <div><label>Nome completo *</label><input id="ct-name" type="text"></div>
          <div>
            <label>Motivo *</label>
            <select id="ct-reason">
              <option value="">Selecione</option>
              <option value="Quero poder utilizar a Tucano">Quero poder utilizar a Tucano</option>
              <option value="Quero reclamar do serviço">Quero reclamar do serviço</option>
              <option value="Quero dar uma avaliação">Quero dar uma avaliação</option>
            </select>
          </div>

          <div id="ct-pref-wrap" style="display:none">
            <label>Como deseja preencher o formulário de inscrição na Tucano? *</label>
            <select id="ct-pref">
              <option value="">Selecione</option>
              <option value="Por e-mail/zap">Prefiro preencher tudo por e-mail/zap para ter uma conta</option>
              <option value="No formulário da Tucano">Prefiro preencher no próprio formulário da Tucano</option>
            </select>
          </div>

          <div id="ct-stars-wrap" style="display:none">
            <label>Quantas estrelas você dá? *</label>
            <input id="ct-stars" type="text" placeholder="Digite um número de 0 a 5" inputmode="numeric">
            <div id="ct-stars-view" class="text-yellow-400 text-2xl mt-2"></div>
          </div>

          <div id="ct-channel-wrap" style="display:none">
            <label>Por onde quer ser respondido? *</label>
            <select id="ct-channel">
              <option value="">Selecione</option>
              <option value="E-mail">E-mail</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="TikTok">TikTok</option>
              <option value="Discord">Discord</option>
            </select>
          </div>

          <div id="ct-channel-data" style="display:none">
            <label id="ct-channel-label">Contato *</label>
            <input id="ct-channel-value" type="text">
          </div>

          <div id="ct-msg-wrap" style="display:none">
            <label>Mensagem *</label>
            <textarea id="ct-msg" rows="4"></textarea>
          </div>

          <div id="ct-error" class="alert-box" style="display:none"></div>
          <div id="ct-ok" class="success-box" style="display:none"></div>
          <button id="ct-send" class="btn-primary w-full"><i class="fas fa-paper-plane"></i> Enviar</button>
        </div>
      </div>
    </section>

    <!-- FOOTER -->
    <footer class="footer-dark py-12">
      <div class="max-w-6xl mx-auto px-4 grid md:grid-cols-3 gap-8">
        <div>
          <img src="./tucano.png" alt="Tucano" width="64" height="64" style="border-radius:14px" onerror="this.style.display='none'">
          <p class="mt-3 text-sm text-slate-400">Tucano Música — distribuição musical digital.</p>
        </div>
        <div class="text-sm space-y-2">
  <p><a href="https://www.tiktok.com/@tucanomusica" target="_blank" rel="noopener noreferrer"><i class="fab fa-tiktok"></i> @tucanomusica</a></p>
  <p><a href="https://www.instagram.com/tucanomusica" target="_blank" rel="noopener noreferrer"><i class="fab fa-instagram"></i> @tucanomusica</a></p>
  <p><a href="mailto:ncolassuport@gmail.com"><i class="fas fa-envelope"></i> ncolassuport@gmail.com</a></p>
  <p>
    <a href="https://open.spotify.com/user/31prcfuajw4lieuejvul45sjmizi?si=3252dc9eea3e4050" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:.5rem">
      <i class="fab fa-spotify" style="color:#1DB954;font-size:1.15rem"></i> Perfil no Spotify
    </a>
  </p>
</div>
        <div>
          <label class="text-white">Assinar newsletter</label>
          <div class="flex gap-2">
            <input id="nl-mail" type="email" placeholder="Seu e-mail">
            <button id="nl-send" class="btn-primary whitespace-nowrap">Assinar</button>
          </div>
          <div id="nl-msg" class="text-sm mt-2 text-slate-400"></div>
        </div>
      </div>
      <div class="max-w-6xl mx-auto px-4 mt-8 pt-6 border-t border-slate-800 text-xs text-slate-500">
        <p>Todos os direitos são livres. Créditos de desenvolvimento ao DeepSeek e créditos de geração de imagem ao ChatGPT e à Meta AI.</p>
      </div>
    </footer>`;
}

function bindLanding(){
  // Botão Portal do Artista (bloco verde)
  const portalBtn = $('#portal-artista-btn');
  if(portalBtn) portalBtn.addEventListener('click', ()=>{ playSound('botao'); state.page='login'; render(); });

  const track = $('#carousel');
  if(track){
    let auto = true;
    let last = performance.now();
    const tick = (now)=>{
      const dt = now - last; last = now;
      if(auto && track.scrollWidth > track.clientWidth){
        track.scrollLeft += 0.03 * dt;
        if(track.scrollLeft >= track.scrollWidth - track.clientWidth - 1){
          track.scrollLeft = 0;
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    let isDown=false, startX=0, startScroll=0, moved=false;
    const onDown = (e)=>{
      isDown=true; moved=false;
      const p = e.touches ? e.touches[0] : e;
      startX = p.clientX; startScroll = track.scrollLeft;
      auto = false;
    };
    const onMove = (e)=>{
      if(!isDown) return;
      const p = e.touches ? e.touches[0] : e;
      const dx = p.clientX - startX;
      if(Math.abs(dx) > 5) moved = true;
      track.scrollLeft = startScroll - dx;
    };
    const onUp = ()=>{
      if(!isDown) return;
      isDown=false;
      setTimeout(()=>{ auto = true; }, 1500);
    };
    track.addEventListener('mousedown', onDown);
    track.addEventListener('mousemove', onMove);
    track.addEventListener('mouseup', onUp);
    track.addEventListener('mouseleave', onUp);
    track.addEventListener('touchstart', onDown, {passive:true});
    track.addEventListener('touchmove', onMove, {passive:true});
    track.addEventListener('touchend', onUp);

    $$('.carousel-card').forEach(b=>{
      b.addEventListener('click', ()=>{
        if(moved) return;
        const el = document.getElementById(b.dataset.scroll);
        if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
      });
    });
  }

  $$('.faq-item').forEach(item=>{
    const q = item.querySelector('.faq-q');
    q.addEventListener('click', ()=> item.classList.toggle('open'));
  });

  $('#faq-send').addEventListener('click', async ()=>{
    const q = $('#faq-q').value.trim();
    const msg = $('#faq-msg');
    if(!q){ msg.textContent='Digite sua pergunta.'; msg.style.color='#fca5a5'; return; }
    const btn = $('#faq-send'); btn.disabled=true; btn.innerHTML='<span class="spinner"></span>';
    try{
      await uploadText(`Pergunta FAQ\n\nPergunta: ${q}\nData: ${new Date().toLocaleString('pt-BR')}`, `landing_faq_${uid()}.txt`);
      msg.textContent='Pergunta enviada!'; msg.style.color='#86efac'; $('#faq-q').value='';
    }catch(e){ msg.textContent='Erro: '+e.message; msg.style.color='#fca5a5'; }
    finally{ btn.disabled=false; btn.innerHTML='Enviar'; }
  });

  $('#nl-send').addEventListener('click', async ()=>{
    const mail = $('#nl-mail').value.trim();
    const msg = $('#nl-msg');
    if(!/^\S+@\S+\.\S+$/.test(mail)){ msg.textContent='E-mail inválido.'; msg.style.color='#fca5a5'; return; }
    const btn = $('#nl-send'); btn.disabled=true; btn.innerHTML='<span class="spinner"></span>';
    try{
      await uploadText(`Newsletter\n\nE-mail: ${mail}\nData: ${new Date().toLocaleString('pt-BR')}`, `landing_newsletter_${uid()}.txt`);
      msg.textContent='Inscrito!'; msg.style.color='#86efac'; $('#nl-mail').value='';
    }catch(e){ msg.textContent='Erro: '+e.message; msg.style.color='#fca5a5'; }
    finally{ btn.disabled=false; btn.innerHTML='Assinar'; }
  });

  const reasonSel = $('#ct-reason');
  const prefWrap = $('#ct-pref-wrap');
  const starsWrap = $('#ct-stars-wrap');
  const channelWrap = $('#ct-channel-wrap');
  const channelDataWrap = $('#ct-channel-data');
  const msgWrap = $('#ct-msg-wrap');
  const channelLabel = $('#ct-channel-label');
  const channelValue = $('#ct-channel-value');

  const channelPlaceholders = {
    'E-mail': { label:'E-mail *', placeholder:'seu@email.com', type:'email' },
    'WhatsApp': { label:'WhatsApp *', placeholder:'+55 (DD) 9 9999-9999', type:'tel' },
    'TikTok': { label:'TikTok *', placeholder:'@seu_usuario', type:'text' },
    'Discord': { label:'Discord *', placeholder:'usuario#0000 ou usuario', type:'text' }
  };

  reasonSel.addEventListener('change', ()=>{
    const v = reasonSel.value;
    prefWrap.style.display = (v === 'Quero poder utilizar a Tucano') ? 'block' : 'none';
    starsWrap.style.display = (v === 'Quero dar uma avaliação') ? 'block' : 'none';
    const showMsg = (v === 'Quero reclamar do serviço' || v === 'Quero dar uma avaliação');
    msgWrap.style.display = showMsg ? 'block' : 'none';
    channelWrap.style.display = v ? 'block' : 'none';
    if(!v){ channelDataWrap.style.display='none'; channelValue.value=''; }
    if(v !== 'Quero dar uma avaliação'){ $('#ct-stars').value=''; $('#ct-stars-view').textContent=''; }
    if(!showMsg){ $('#ct-msg').value=''; }
    if(v !== 'Quero poder utilizar a Tucano'){ prefWrap.style.display='none'; }
  });

  $('#ct-stars').addEventListener('input', ()=>{
    const raw = $('#ct-stars').value.trim();
    const n = Math.max(0, Math.min(5, parseInt(raw,10) || 0));
    $('#ct-stars-view').textContent = '★'.repeat(n) + '☆'.repeat(5-n);
  });

  $('#ct-channel').addEventListener('change', ()=>{
    const v = $('#ct-channel').value;
    if(!v){ channelDataWrap.style.display='none'; channelValue.value=''; return; }
    const meta = channelPlaceholders[v];
    channelLabel.textContent = meta.label;
    channelValue.type = meta.type;
    channelValue.placeholder = meta.placeholder;
    channelValue.value = '';
    channelDataWrap.style.display = 'block';
  });

  $('#ct-send').addEventListener('click', async ()=>{
    const name = $('#ct-name').value.trim();
    const reason = reasonSel.value;
    const pref = prefWrap.style.display==='none' ? '' : $('#ct-pref').value;
    const starsRaw = $('#ct-stars').value.trim();
    const channel = channelWrap.style.display==='none' ? '' : $('#ct-channel').value;
    const channelVal = channelDataWrap.style.display==='none' ? '' : channelValue.value.trim();
    const message = msgWrap.style.display==='none' ? '' : $('#ct-msg').value.trim();
    const err = $('#ct-error'); err.style.display='none';
    const ok = $('#ct-ok'); ok.style.display='none';

    if(!name){ err.textContent='Preencha seu nome.'; err.style.display='block'; return; }
    if(!reason){ err.textContent='Selecione um motivo.'; err.style.display='block'; return; }
    if(reason==='Quero poder utilizar a Tucano' && !pref){ err.textContent='Escolha como preencher o formulário de inscrição.'; err.style.display='block'; return; }
    if(reason==='Quero dar uma avaliação'){
      const n = parseInt(starsRaw,10);
      if(isNaN(n) || n<0 || n>5){ err.textContent='Digite uma nota de 0 a 5.'; err.style.display='block'; return; }
    }
    if(!channel || !channelVal){ err.textContent='Informe por onde quer ser respondido e o dado de contato.'; err.style.display='block'; return; }
    if((reason==='Quero reclamar do serviço' || reason==='Quero dar uma avaliação') && !message){
      err.textContent='Escreva sua mensagem.'; err.style.display='block'; return;
    }
    if(channel==='E-mail' && !/^\S+@\S+\.\S+$/.test(channelVal)){ err.textContent='E-mail inválido.'; err.style.display='block'; return; }

    const btn = $('#ct-send'); btn.disabled=true; btn.innerHTML='<span class="spinner"></span>';
    try{
      const txt = `Contato\n\nNome completo: ${name}\nMotivo: ${reason}\n` +
        (pref ? `Como preencher o formulário: ${pref}\n` : '') +
        (reason==='Quero dar uma avaliação' ? `Estrelas: ${starsRaw}\n` : '') +
        `Canal de resposta: ${channel}\nContato (${channel}): ${channelVal}\n` +
        (message ? `\nMensagem:\n${message}\n` : '') +
        `\nData: ${new Date().toLocaleString('pt-BR')}`;
      await uploadText(txt, `landing_contato_${uid()}.txt`);
      ok.textContent='Mensagem enviada!'; ok.style.display='block';
      ['#ct-name','#ct-stars','#ct-msg','#ct-channel-value'].forEach(s=>{ const el=$(s); if(el) el.value=''; });
      $('#ct-stars-view').textContent='';
      reasonSel.value=''; $('#ct-pref').value=''; $('#ct-channel').value='';
      prefWrap.style.display='none'; starsWrap.style.display='none';
      channelWrap.style.display='none'; channelDataWrap.style.display='none'; msgWrap.style.display='none';
    }catch(e){ err.textContent='Erro: '+e.message; err.style.display='block'; }
    finally{ btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> Enviar'; }
  });
}

// ============================================================
// LOGIN
// ============================================================
function viewLogin(){
  return `
    <div class="min-h-screen flex items-center justify-center p-4 jungle-texture">
      <div class="glass glow p-8 max-w-md w-full fade-in-scale">
        <div class="text-center mb-8">
          <img src="./tucano.png" alt="Tucano" class="mx-auto mb-4" style="max-width:100px" onerror="this.style.display='none'">
          <h1 class="kab text-2xl">Entrar na Tucano</h1>
          <p class="tts text-slate-400 text-sm mt-1">Use seu usuário e senha</p>
        </div>
        <div class="space-y-4">
          <div><label for="login-user">Usuário</label><input id="login-user" type="text" placeholder="Seu nome de usuário" autocomplete="username"></div>
          <div><label for="login-pass">Senha</label><input id="login-pass" type="password" placeholder="Sua senha" autocomplete="current-password"></div>
          <div id="login-error" class="alert-box" style="display:none"></div>
          <button id="login-btn" class="btn-primary w-full"><i class="fas fa-right-to-bracket"></i> Fazer Login</button>
          <div class="text-center pt-2">
            <a href="#" id="login-back" class="text-sm" style="color:#a3e635">Voltar ao início</a>
          </div>
        </div>
      </div>
    </div>`;
}
function bindLogin(){
  const attempt = async ()=>{
    const user = $('#login-user').value.trim();
    const pass = $('#login-pass').value;
    const errEl = $('#login-error');
    errEl.style.display='none';
    if(!user || !pass){ errEl.textContent='Preencha usuário e senha.'; errEl.style.display='block'; return; }
    const btn = $('#login-btn'); const old = btn.innerHTML;
    btn.disabled=true; btn.innerHTML='<span class="spinner"></span>';
    try{
      const res = await loginAccount(user, pass);
      if(!res.ok){ errEl.textContent = res.error; errEl.style.display='block'; return; }
      playSound('botao');
      state.user = res.user;
      persistUser();
      state.page='dashboard'; render();
      startStatusPolling();
      syncSharedReleases();
    }catch(e){
      errEl.textContent = 'Erro ao entrar: '+e.message; errEl.style.display='block';
    }finally{ btn.disabled=false; btn.innerHTML=old; }
  };
  $('#login-btn').addEventListener('click', attempt);
  $('#login-user').addEventListener('keydown', e=>{ if(e.key==='Enter') attempt(); });
  $('#login-pass').addEventListener('keydown', e=>{ if(e.key==='Enter') attempt(); });
  $('#login-back').addEventListener('click', (e)=>{ e.preventDefault(); state.page='landing'; render(); });
}

// ============================================================
// CONTRATO
// ============================================================
function viewContractQuestion(){
  return `
    <div class="min-h-screen flex items-center justify-center p-4 jungle-texture">
      <div class="glass glow p-8 max-w-lg w-full fade-in-scale">
        <h1 class="kab text-2xl mb-2">Você assinou algum contrato com:</h1>
        <p class="tts text-slate-400 mb-6">Selecione a opção verdadeira.</p>
        <div class="space-y-3">
          <button id="c-knit" class="btn-secondary w-full justify-start"><i class="fas fa-scroll"></i> Knitting Records™</button>
          <button id="c-tuc" class="btn-secondary w-full justify-start"><i class="fas fa-bird"></i> Tucano Independente</button>
          <button id="c-none" class="btn-secondary w-full justify-start"><i class="fas fa-ban"></i> Nenhum</button>
        </div>
        <button id="cq-out" class="btn-danger w-full mt-6"><i class="fas fa-right-from-bracket"></i> Sair</button>
      </div>
    </div>`;
}
function bindContractQuestion(){
  const doLogout = ()=>{
    stopStatusPolling();
    state.user = null;
    localStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_LEGACY_KEY);
    state.page='landing'; render();
  };
  $('#cq-out').addEventListener('click', doLogout);

  const real = state.user.hasRealContract === true;
  const contractTypeAtual = state.user.contractType || 'none';

  $('#c-knit').addEventListener('click', ()=>{
    if(contractTypeAtual !== 'knitting' && !real) return liarAlert();
    state.user.contractType='knitting'; state.user.answeredContract=true;
    state.user.knittingAcknowledged=false; state.user.hasRealContract=true;
    persistUser(); render();
  });
  $('#c-tuc').addEventListener('click', ()=>{
    if(contractTypeAtual !== 'tucano' && !real) return liarAlert();
    state.user.contractType='tucano'; state.user.answeredContract=true;
    state.user.contractSigned=true; state.user.contractPdfDownloaded=true;
    state.user.hasRealContract=true;
    persistUser(); render();
  });
  $('#c-none').addEventListener('click', ()=>{
    state.user.contractType='none'; state.user.answeredContract=true;
    state.user.contractSigned=false; state.user.contractPdfDownloaded=false;
    state.user.hasRealContract=false;
    persistUser(); render();
  });
}
function liarAlert(){
  try{
    if('Notification' in window && Notification.permission==='granted') new Notification('Assine primeiro, mentiroso da porra 😡');
    else if('Notification' in window && Notification.permission!=='denied') Notification.requestPermission().then(p=>{ if(p==='granted') new Notification('Assine primeiro, mentiroso 😡'); });
  }catch(e){}
  const ov = document.createElement('div'); ov.className='modal-overlay';
  ov.innerHTML = `<div class="modal-content text-center"><div style="font-size:5rem">😡</div><h2 class="kab text-2xl text-red-500 mb-3">Assine primeiro, mentiroso!</h2><p class="text-slate-400 mb-6">Você não tem um contrato registrado. Escolha "Nenhum" e assine o contrato da Tucano de verdade.</p><button id="liar-ok" class="btn-primary w-full">Entendi</button></div>`;
  document.body.appendChild(ov);
  $('#liar-ok').addEventListener('click', ()=>ov.remove());
}

function viewKnitting(){
  return `
    <div class="min-h-screen flex items-center justify-center p-4 jungle-texture">
      <div class="glass glow p-8 max-w-lg w-full fade-in-scale">
        <h1 class="kab text-2xl mb-2 text-red-400">Você é artista da Knitting Records™</h1>
        <p class="tts text-slate-300 mb-4">A Knitting Records™ é uma <strong>gravadora</strong>, e o seu contrato com ela significa que:</p>
        <ul class="space-y-2 text-red-400 mb-6 tts">
          <li>❌ A Knitting retém 80% de tudo o que você ganha</li>
          <li>❌ A Knitting é uma gravadora — não é distribuidora independente</li>
          <li>❌ A Knitting retém <strong>todos</strong> os direitos sobre as suas obras</li>
          <li>❌ A Knitting é dona da Tucano Música</li>
          <li>❌ O seu contrato com a Knitting é exclusivo — você não pode distribuir em outro lugar</li>
        </ul>
        <p class="tts text-slate-300 mb-2">Você está na Knitting Records™. Isso <strong>não é uma opção</strong> de distribuição: é um contrato de gravadora.</p>
        <p class="tts text-slate-300 mb-4">A Tucano Independente existe justamente para o artista <strong>não</strong> precisar estar na Knitting.</p>
        <p class="text-sm text-slate-500 mb-4">Aguarde <span id="cd">5</span>s para confirmar que entendeu.</p>
        <button id="k-ok" class="btn-primary w-full" disabled>Entendi</button>
      </div>
    </div>`;
}
function bindKnitting(){
  let t=5; const el=$('#cd'); const btn=$('#k-ok');
  const iv = setInterval(()=>{ t--; if(el) el.textContent=t; if(t<=0){ clearInterval(iv); btn.disabled=false; } }, 1000);
  btn.addEventListener('click', ()=>{
    clearInterval(iv);
    state.user.knittingAcknowledged=true;
    persistUser(); render();
  });
}

function viewNoneOption(){
  return `
    <div class="min-h-screen flex items-center justify-center p-4 jungle-texture">
      <div class="glass glow p-8 max-w-lg w-full fade-in-scale">
        <h1 class="kab text-2xl mb-2">Você não assinou nenhum contrato.</h1>
        <p class="tts text-slate-400 mb-6">Gostaria de assinar o contrato com a Tucano Independente?</p>
        <div class="space-y-3">
          <button id="n-yes" class="btn-primary w-full"><i class="fas fa-pen"></i> Sim, quero assinar</button>
          <button id="n-no" class="btn-secondary w-full"><i class="fas fa-xmark"></i> Não</button>
        </div>
        <div id="n-warn" class="warning-box mt-4" style="display:none">
          <p class="mb-2">Sem contrato você não pode usar a Tucano.</p>
          <div class="flex gap-2 mt-2">
            <button id="n-login" class="btn-secondary text-sm flex-1">Sair</button>
          </div>
        </div>
      </div>
    </div>`;
}
function bindNoneOption(){
  const doLogout = ()=>{
    stopStatusPolling();
    state.user = null;
    localStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_LEGACY_KEY);
    state.page='landing'; render();
  };
  $('#n-no').addEventListener('click', ()=>{ $('#n-warn').style.display='block'; });
  $('#n-yes').addEventListener('click', ()=>{
    const u = state.user;
    showContract(u.fullName||'', u.artistName||'', u.email||'', u.whatsapp||'', u.tiktok||'', u.schoolGrade||'');
  });
  $('#n-login').addEventListener('click', doLogout);
}

function showContract(fullName, artistName, email, whatsapp, tiktok, schoolGrade){
  const today = fmtDate(new Date());
  const fill = v=>`<span class="contract-fill">${esc(v)}</span>`;
  const html = `
    <div class="min-h-screen p-4 py-8 jungle-texture">
      <div class="glass glow p-6 md:p-8 max-w-3xl mx-auto fade-in">
        <div class="flex items-center justify-between mb-4">
          <h1 class="kab text-2xl">Contrato de Distribuição</h1>
          <button id="ct-back" class="btn-secondary text-sm"><i class="fas fa-arrow-left"></i> Voltar</button>
        </div>
        <div class="bg-slate-900/60 p-6 rounded-xl max-h-96 overflow-y-auto mb-6 text-sm whitespace-pre-wrap scrollbar-thin" style="line-height:1.7;color:var(--text-secondary)"><strong>CONTRATO DE DISTRIBUIÇÃO FONOGRÁFICA E AUDIOVISUAL</strong>

Pelo presente instrumento particular celebrado em ${fill(today)}, as partes, doravante denominadas <strong>Tucano</strong> e <strong>Artista</strong> se identificarão abaixo:

<strong>Tucano:</strong> Tucano Música, de e-mail <a href="mailto:ncolassuport@gmail.com" style="color:#a3e635">ncolassuport@gmail.com</a>, WhatsApp +55 41 8452-7352, TikTok @tucanomusica, Discord yanbananao_.42487, com seu representante legal Yan Matheus Antunes Batista, de WhatsApp +55 (41) 9 9147-1356, e-mail <a href="mailto:yanmatheus160589@gmail.com" style="color:#a3e635">yanmatheus160589@gmail.com</a>, TikTok @knitting.cat e Discord yanbananao._42487.

<strong>Artista:</strong> ${fill(fullName)}, de nome artístico ${fill(artistName)}, e-mail ${fill(email)}, WhatsApp ${fill(whatsapp)}, TikTok ${fill(tiktok || '(não informado)')} e série escolar ${fill(schoolGrade)}.

Quando a Tucano e o Artista forem referidos em conjunto, serão denominados "<strong>partes</strong>".

Considerando que:

<em>a) Isso aqui não tem validade jurídica alguma e serve apenas como acordo, pois as partes são menores impúberes</em>
<em>b) Só isso mesmo</em>

As partes resolvem celebrar o justo e firmado o seguinte:

<strong>CLÁUSULA PRIMEIRA - PROPOSTA</strong>

A Tucano deverá <u>distribuir as obras fonográficas</u> (doravante "Obras") do Artista nas plataformas digitais disponíveis listadas <a href="https://www.plataformasknitting.vercel.app" target="_blank" rel="noopener noreferrer" style="color:#a3e635;text-decoration:underline">neste anexo público</a>.

<strong>CLÁUSULA SEGUNDA - DA CONTA</strong>

2.1. Quando o Artista for aprovado pela candidatura, a Tucano se obriga a criar uma conta para o Artista poder utilizar o site, com uma senha que o Artista poderá definir conforme o Anexo I.
2.2. Este contrato é assinado quando o Artista já tem a conta e a Tucano já cria uma senha para o Artista poder entrar na conta e assinar, podendo o Artista mudar depois.

<strong>CLÁUSULA TERCEIRA - REQUISITOS</strong>

Para áudio:

I. MP3;
a) 320kbps se for MP3;
II. WAV
a) 16/24 bits;
b) codec PCM_S16LE/PCM_S24LE;
III. 44,1kHz+;
IV. Capa em PNG ou JPG/JPEG, quadrado, únicos textos permitidos são nome do lançamento, do artista/banda e opcionalmente, obrigatoriamente se for explícito, selo Parental Advisory.

<strong>CLÁUSULA QUARTA - EXCLUSIVIDADE</strong>

4.1. <u>Este contrato não é exclusivo</u>, podendo o Artista distribuir suas obras em outras distribuidoras.
4.2. A exclusividade fica apenas para os releases que já foram lançados pela Tucano, não podendo ser re-distribuídas por outras distribuidoras.
4.2.1. Isso não se deve a uma simples decisão da Tucano, mas sim por causa da distribuidora utilizada pela Tucano para realizar as distribuições, a Lantuns.
4.3. Caso o Artista <strong>deseje</strong> utilizar a Tucano com <strong>exclusividade</strong>, deverá solicitar via <strong>e-mail ncolassuport@gmail.com</strong> ou <strong>WhatsApp +55 41 8452-7352</strong>.

<strong>CLÁUSULA QUINTA - DIREITOS AUTORAIS</strong>

5.1. <u>O Artista mantém 100% dos direitos autorais, fonográficos e conexos</u> sobre suas Obras e Vídeos.
5.2. A Tucano não reivindica nenhum direito sobre as obras além da distribuição digital das Obras, Vídeos e da de reivindicar o painel do Spotify for Artists prevista neste acordo.

<strong>CLÁUSULA SEXTA - ROYALTIES</strong>

6.1. A comissão sobre royalties de Obras e Vídeos é de <strong>25% para a Tucano e 75% para o Artista</strong>.
6.2. A Tucano deverá pagar os royalties em até 15 dias corridos após receber das plataformas.
6.3. Como acordo entre amigos, <u>não há taxa de adesão nem cobrança extra</u> além da comissão prevista no item 6.1.

<strong>CLÁUSULA SÉTIMA - DAS VIAS</strong>

O Artista pode optar por assinar este contrato em 2 vias físicas de igual teor, 1 via eletrônica digital neste site, ou em 2 vias eletrônicas de igual teor em PDF para cada uma das partes se solicitado por WhatsApp, e-mail, Discord ou TikTok.

<strong>CLÁUSULA OITAVA - VIGÊNCIA, VIGOR E RENOVAÇÃO</strong>

8.1. A vigência deste contrato é de <u>730 </u>(setecentos e trinta) dias <u>corridos</u>.
8.2. O vigor deste contrato tem efeito imediato.
8.3. A renovação é automática, salvo se qualquer das partes manifestar intenção de rescindir conforme a cláusula nona.

<strong>CLÁUSULA NONA - RESCISÃO</strong>

9.1. A rescisão é gratuita, podendo ser realizada por acordo entre a Tucano e o Artista.
9.2. Após a rescisão, a Tucano tem até 15 dias corridos para remover as Obras e Vídeos do Artista das plataformas digitais.

<strong>CLÁUSULA DÉCIMA - QUEM PODE USAR</strong>

Apenas estudantes do colégio do representante legal da Tucano (Colégio Estadual Victor Gabriel Camargo) ou parceiros de companhia do representante legal da Tucano são membros autorizados para a distribuição.

<strong>CLÁUSULA DÉCIMA PRIMEIRA - CONDUTA</strong>

Não serão aceitas Obras ou Vídeos que contenham:

I. Plágio de outro artista sem licença;
II. Apologia a crime, drogas ou violência;
III. Discurso de ódio;
IV. Conteúdo sexual sem aviso explícito.

<strong>CLÁUSULA DÉCIMA SEGUNDA - DOS ANEXOS NO PDF</strong>

A segunda via que o Artista fizer o download (PDF) não contém os anexos junto, e se o Artista desejar, deverá contatar diretamente a Tucano pelo e-mail <a href="mailto:ncolassuport@gmail.com" style="color:#a3e635">ncolassuport@gmail.com</a>.

<strong>CLÁUSULA DÉCIMA TERCEIRA - GERENCIAMENTO DE ESTATÍSTICAS E DINHEIRO</strong>

13.1. O Artista poderá gerenciar suas estatísticas de dinheiro, ouvintes mensais e streams no total em uma conta que a Tucano criará no site https://paineldoartista.vercel.app, que é um serviço da Knitting Records™ que a Tucano contratou (doravante denominado "Painel de Gerenciamento").
13.2. O nome artístico, senha e releases serão os mesmos da Tucano.
13.3. Foto de perfil, biografia, foto de biografia e estatísticas serão os mesmos do Spotify for Artists.
13.4. Caso não tenha biografia, foto de biografia ou foto de perfil, serão usadas a logo da Knitting Records™ no lugar e o texto "Sem biografia" no lugar da biografia.
13.5. Não haverá nenhuma conta no Painel de Gerenciamento caso não tenha conta no Spotify for Artists.
13.5.1. Isso se deve por causa que a Knitting Records™ precisa disso para mostrar estatísticas.

<strong>CLÁUSULA DÉCIMA QUARTA - DO SPOTIFY FOR ARTISTS</strong>

14.1. A Tucano tem direito de reivindicar o perfil do Spotify for Artists do Artista.
14.2. O Artista poderá solicitar a Tucano para entrar no grupo para gerenciar seu perfil.

<strong>CLÁUSULA DÉCIMA QUINTA - DOS CRÉDITOS NAS PLATAFORMAS</strong>

15.1. Os créditos © nas plataformas como o Artista digitou na hora de criar um release, junto do texto "(dist. Tucano)" ao lado.
15.2. Os créditos ℗ nas plataformas aparecerão como "Lantuns".
15.2.1. Isso se deve por causa que a distribuidora musical contratada pela Tucano, a Lantuns, não permite mudar os créditos ℗.

<strong>CLÁUSULA DÉCIMA SEXTA - PRAZO DE DISTRIBUIÇÃO DE MÍDIA</strong>

O tempo que a distribuição das Obras levará para ser distribuído será escolhido pelo Artista (data e hora), <u>não podendo ser antes do prazo mínimo de 14 dias</u>.

<strong>CLÁUSULA DÉCIMA SÉTIMA - PRAZO DE RESPOSTA DO SUPORTE</strong>

O tempo em que o suporte da Tucano responderá o Artista será entre <u>1-5 dias corridos</u>.

<strong>CLÁUSULA DÉCIMA OITAVA - CONTATO DE SUPORTE</strong>

18.1. O Artista poderá enviar suas reclamações ou outras coisas via SAC no painel, Contate-Nos na seção inicial ou diretamente via e-mail de SAC <a href="mailto:ncolassuport@gmail.com" style="#a3e635"><strong>ncolassuport@gmail.com</strong></a>.
18.2. As reclamações do Artista serão respondidas pelo e-mail <strong>ncolassuport@gmail.com</strong>.

<strong>CLÁUSULA DÉCIMA NONA - DOS ATRASOS NOS RELEASES</strong>

Caso uma das Obras seja atrasada e não seja enviada no prazo em que o Artista escolheu (data e hora), a Tucano deverá <u>avisar previamente</u> sobre o atraso.

<strong>CLÁUSULA VIGÉSIMA - DOS ATRASOS NA RESPOSTA DO SUPORTE</strong>

Caso o suporte atrase a resposta da reclamação do Artista, a mensagem deverá vir acompanhada do porquê o motivo do atraso.

<strong>CLÁUSULA VIGÉSIMA PRIMEIRA - DOS DIREITOS AUTORAIS E LICENÇAS</strong>

21.1. O Artista <u>não poderá distribuir obras sob as licenças CC-NC, CC-SA, CC BY-NC, CC BY-NC-SA, CC BY-NC-ND ou CC BY-NC-ND-SA</u>.
21.2. Caso seja CC-BY ou CC-BY-ND, o Artista preencherá um campo do atribuído e a Tucano colocará a atribuição nos créditos © separado por barra entre o crédito © que o Artista colocou e o titular da criação e distribuição.
21.2.1. A atribuição poderá ser o nome completo ou nome de usuário de onde o Artista pegou.
21.3. Serão aceitos normalmente e sem exigências as Obras com licença CC0 ou direitos autorais 100% do Artista.
21.4. Só serão aceitas a distribuição de Obras com licença Creative Commons ou direitos autorais.

<strong>CLÁUSULA VIGÉSIMA SEGUNDA - DAS DISTRIBUIÇÕES ADICIONAIS</strong>

O Artista também opcionalmente poderá distribuir suas Obras em:

I. YouTube Content ID (requer 100% de direitos autorais);
II. Roblox (o Artista concorda com o <a href="https://en.help.roblox.com/hc/en-us/articles/23359485439124-Audio-Upload-License-Agreement">Acordo de Licença de Upload de Áudio da Roblox</a>.)
III. Udio;
IV. SoundCloud Monetization;
V. Facebook Fingerprint;
VI. Spotify for Kids (precisa ser do gênero de música infantil e passar pelos requisitos da Spotify AB);
VII. YouTube Kids (precisa ser do gênero de música infantil e passar pelos requisitos do YouTube).

<strong>CLÁUSULA VIGÉSIMA TERCEIRA - PUBLICIDADE NOS PERFIS DA TUCANO</strong>

O Artista concorda que a Tucano poderá divulgar o Artista no perfil oficial da Tucano Música (@tucanomusica).

<strong>CLÁUSULA VIGÉSIMA QUARTA - CURADORIA</strong>

O Artista concorda que a Tucano poderá inserir o Artista em playlists oficiais da Tucano.

<strong>CLÁUSULA VIGÉSIMA QUINTA - FORCE MAJEURE</strong>

25.1. Caso o Artista se mude para outro domicílio de residência ou instituição escolar de ensino, poderá continuar distribuindo suas Obras e Vídeos pela Tucano, desde que não perca contato.
25.2. Caso o Artista mude o número de WhatsApp sem aviso prévio, deverá avisar presencialmente seu novo número de WhatsApp, e poderá continuar utilizando os serviços da Tucano.
25.3. Caso o agente de distribuição da Tucano fique em momentos de castigo e proibido ao uso de aparelhos eletrônicos essenciais, o Artista temporariamente não poderá utilizar os serviços da Tucano, por tempo indeterminado, até que acabe o período do castigo e o agente de distribuição recupere os aparelhos eletrônicos e possa continuar a distribuição.
25.3.1. O site será desativado temporariamente neste caso.
25.4. Caso o Artista perca totalmente qualquer contato com a Tucano, não poderá mais utilizar os serviços da Tucano e a conta do Artista será excluída e este contrato será rescindido.
25.5. Caso o mesmo acontecimento do item 25.4 desta cláusula aconteça com o agente de distribuição da Tucano, o Artista não poderá mais utilizar os serviços da Tucano e a conta do Artista será excluída e este contrato será rescindido.
25.6. Caso os mesmos acontecimentos dos itens 25.1 e 25.2 desta cláusula aconteçam com a Tucano, as instruções serão as mesmas e o Artista poderá continuar utilizando os serviços da Tucano.
25.7. Caso aconteça guerras, golpes militares e quaisquer coisas sérias que envolvam destruição, destruição da nação, guerra com a nação ou com o mundo, o Artista poderá continuar utilizando os serviços da Tucano, desde que isso não afete aparelhos eletrônicos, rede de internet, saúde das partes ou quaisquer outras coisas que impossibilitem a prestação do serviço.

<strong>CLÁUSULA VIGÉSIMA SEXTA - TIPO DE CONTRATO</strong>

Este contrato se aplica como um contrato paritário, podendo as partes negociarem as cláusulas.

<strong>CLÁUSULA VIGÉSIMA SÉTIMA - FORO</strong>

Fica eleito o foro do PV do TikTok (@knitting.cat) ou do Discord (yanbananao._42487) para dirimir quaisquer controvérsias oriundas deste contrato.

E por estarem assim, justos e contratados, as partes assinam este contrato em 1 via eletrônica, salvo se for solicitado 2 de igual teor, e preencherá os anexos.

<strong>Assinatura da Tucano:</strong>

<img src="./tucano.png" alt="Assinatura Tucano" style="max-width:180px;margin-top:8px">
        </div>

        <div class="mb-2">
          <label>Assine abaixo com o dedo ou o mouse:</label>
          <canvas id="sig-canvas" class="sig-canvas"></canvas>
          <div class="flex gap-2 mt-2">
            <button id="sig-clear" class="btn-secondary text-sm">Limpar</button>
          </div>
        </div>

        <div class="space-y-3 mb-4">
          <button id="sign" class="btn-primary w-full" disabled><i class="fas fa-signature"></i> Assinar Contrato</button>
        </div>

        <div class="border-t border-slate-700 pt-4 mt-4 space-y-3">
          <button id="phys-link" class="btn-secondary w-full"><i class="fas fa-file-signature"></i> Assinar Físico</button>
        </div>
      </div>
    </div>`;
  $('#app').innerHTML = html;

  $('#ct-back').addEventListener('click', ()=>{ state.page='dashboard'; render(); });

  const canvas = $('#sig-canvas');
  const ctx = canvas.getContext('2d');
  const fit = ()=>{
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = r.width * dpr;
    canvas.height = r.height * dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0,0,r.width,r.height);
  };
  setTimeout(fit, 0);
  window.addEventListener('resize', fit);

  let drawing=false; let hasStroke=false;
  const pos = (e)=>{
    const r = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: p.clientX - r.left, y: p.clientY - r.top };
  };
  const start = (e)=>{ e.preventDefault(); drawing=true; const p=pos(e); ctx.beginPath(); ctx.moveTo(p.x,p.y); };
  const move = (e)=>{ if(!drawing) return; e.preventDefault(); const p=pos(e); ctx.lineTo(p.x,p.y); ctx.stroke(); if(!hasStroke){ hasStroke=true; $('#sign').disabled=false; } };
  const end = ()=> drawing=false;
  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', end);
  canvas.addEventListener('mouseleave', end);
  canvas.addEventListener('touchstart', start, {passive:false});
  canvas.addEventListener('touchmove', move, {passive:false});
  canvas.addEventListener('touchend', end);

  $('#sig-clear').addEventListener('click', ()=>{
    fit(); hasStroke=false; $('#sign').disabled=true;
  });

  $('#sign').addEventListener('click', async ()=>{
    if(!hasStroke) return;
    state.user.fullName = fullName;
    state.user.artistName = artistName;
    state.user.contractType = 'tucano';
    state.user.contractSigned = true;
    state.user.contractPdfDownloaded = false;
    state.user.hasRealContract = true;
    state.user.answeredContract = true;
    if(!state.user.artists) state.user.artists = [];
    if(artistName && !state.user.artists.includes(artistName)) state.user.artists.push(artistName);
    persistUser();

    try{
      const dataUrl = canvas.toDataURL('image/png');
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `assinatura_${Date.now()}.png`, { type:'image/png' });
      await uploadFile(file, `${safePathUser(state.user.username)}/assinatura_${Date.now()}.png`);
    }catch(e){ console.warn('Falha ao subir assinatura (não bloqueante):', e); }

    render();
  });

  $('#phys-link').addEventListener('click', ()=>{
    state.page='physical'; persistUser(); render();
  });
}

function viewContractSigned(){
  return `
    <div class="min-h-screen flex items-center justify-center p-4 jungle-texture">
      <div class="glass glow p-8 max-w-lg w-full text-center fade-in-scale">
        <div style="font-size:4rem">📜</div>
        <h1 class="kab text-2xl mt-4 mb-2">Contrato assinado!</h1>
        <p class="tts text-slate-400 mb-6">Faça o download do PDF da sua via. O admin precisa ter subido o arquivo <code>contrato.pdf</code> no seu diretório do bucket.</p>
        <button id="pdf-dl" class="btn-primary w-full mb-3"><i class="fas fa-file-pdf"></i> Baixar PDF</button>
        <p id="pdf-info" class="text-xs text-slate-500 mb-3"></p>
        <button id="pdf-done" class="btn-secondary w-full">Já baixei, continuar</button>
      </div>
    </div>`;
}
function getContractPdfUrl(user){
  try{
    const sb = getSupabase();
    const path = `${safePathUser(user.username)}/contrato.pdf`;
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    return data && data.publicUrl ? data.publicUrl : null;
  }catch(e){ return null; }
}
function bindContractSigned(){
  const url = getContractPdfUrl(state.user);
  if(!url) $('#pdf-info').textContent = 'PDF ainda não disponível para esta conta. Peça ao admin para subir o contrato no bucket.';
  $('#pdf-dl').addEventListener('click', async ()=>{
    const u = getContractPdfUrl(state.user);
    if(!u){ alert('PDF não encontrado. Avise o admin da Tucano.'); return; }
    try{
      const btn=$('#pdf-dl'); btn.disabled=true; btn.innerHTML='<span class="spinner"></span>';
      const res = await fetch(u,{mode:'cors'});
      if(!res.ok) throw new Error('HTTP '+res.status);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `contrato_${safePathUser(state.user.username)}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
      btn.disabled=false; btn.innerHTML='<i class="fas fa-file-pdf"></i> Baixar PDF';
    }catch(e){
      alert('Não foi possível baixar o PDF (bloqueio CORS ou arquivo ausente). Abra o link manualmente ou avise o admin.');
      $('#pdf-dl').disabled=false; $('#pdf-dl').innerHTML='<i class="fas fa-file-pdf"></i> Baixar PDF';
    }
  });
  $('#pdf-done').addEventListener('click', ()=>{ state.user.contractPdfDownloaded=true; persistUser(); render(); });
}

function viewPhysicalDate(){
  const min = datePlus(1);
  return `
    <div class="min-h-screen flex items-center justify-center p-4 jungle-texture">
      <div class="glass glow p-8 max-w-lg w-full fade-in-scale">
        <h1 class="kab text-2xl mb-2">Agendar via física</h1>
        <p class="tts text-slate-400 mb-6">Escolha uma data (seg-sex, não feriado, a partir de amanhã).</p>
        <label>Data</label>
        <input id="phys-date" type="date" min="${min}" value="${min}">
        <div id="phys-error" class="alert-box mt-3" style="display:none"></div>
        <button id="phys-ok" class="btn-primary w-full mt-4"><i class="fas fa-check"></i> Confirmar</button>
        <button id="phys-back" class="btn-secondary w-full mt-2">Voltar ao painel</button>
      </div>
    </div>`;
}
function bindPhysicalDate(){
  $('#phys-back').addEventListener('click', ()=>{ state.page='dashboard'; render(); });
  $('#phys-ok').addEventListener('click', async ()=>{
    const val = $('#phys-date').value;
    const err = $('#phys-error'); err.style.display='none';
    if(!val){ err.textContent='Escolha uma data.'; err.style.display='block'; return; }
    const d = new Date(val+'T12:00:00'); const day = d.getDay();
    if(day===0||day===6){ err.textContent='Sábado e domingo não são permitidos.'; err.style.display='block'; return; }
    const today = new Date(); today.setHours(0,0,0,0);
    if(d <= today){ err.textContent='Escolha uma data futura.'; err.style.display='block'; return; }
    const feriados = ['01-01','04-21','05-01','09-07','10-12','11-02','11-15','12-25'];
    if(feriados.includes(val.slice(5))){ err.textContent='Data é feriado.'; err.style.display='block'; return; }
    const btn=$('#phys-ok'); btn.disabled=true; btn.innerHTML='<span class="spinner"></span>';
    try{
      const txt = `Solicitação de via física\n\nDADOS DO ARTISTA\nNome completo: ${state.user.fullName || ''}\nNome artístico: ${state.user.artistName || ''}\nE-mail: ${state.user.email || ''}\nWhatsApp: ${state.user.whatsapp || ''}\nUsuário: ${state.user.username}\nTikTok: ${state.user.tiktok || ''}\nSérie escolar: ${state.user.schoolGrade || ''}\nData da solicitação: ${new Date().toLocaleString('pt-BR')}\n\nData escolhida para assinar físico: ${fmtDate(val)}`;
      await uploadText(txt, `${safePathUser(state.user.username)}/fisico.txt`);
      playSound('sucessao'); alert('Solicitação de via física enviada!');
      state.page='dashboard'; render();
    }catch(e){ err.textContent='Erro: '+e.message; err.style.display='block'; }
    finally{ btn.disabled=false; btn.innerHTML='<i class="fas fa-check"></i> Confirmar'; }
  });
}

// ============================================================
// DASHBOARD
// ============================================================
function viewDashboard(){
  const u = state.user;
  const blocked = isBlocked();
  const showRevive = u.disabled || u.rescinded;
  const releases = (u.releases || []);
  return `
    <div class="min-h-screen" style="background-image:url('./praia.jpg');background-size:cover;background-position:center;background-attachment:fixed;">
      <header class="glass sticky top-0 z-50 mx-2 mt-2 px-4 py-3 flex items-center justify-between" style="background:rgba(11,31,19,0.85)">
        <div class="flex items-center gap-3">
          <img src="./tucano.png" alt="Tucano" width="48" height="48" style="border-radius:12px" onerror="this.style.display='none'">
          <span class="kab text-lg hidden sm:inline">Tucano Música</span>
        </div>
        <div class="flex items-center gap-2">
          ${u.isBand ? `<button id="manage-band" class="btn-secondary text-sm" ${blocked?'disabled':''}><i class="fas fa-users"></i> <span class="hidden sm:inline">Gerenciar Artistas</span></button>` : ''}
          ${showRevive ? `<button id="revive-btn" class="btn-primary text-sm"><i class="fas fa-heart-pulse"></i> Revigorar</button>` : ''}
          <button id="refresh-status" class="btn-secondary" style="padding:.5rem .75rem" title="Atualizar status"><i class="fas fa-rotate"></i></button>
          <button id="hamb" class="btn-secondary" style="padding:.5rem .75rem"><i class="fas fa-bars"></i></button>
        </div>
      </header>
      <div id="hmenu" class="hamburger-menu">
        <button class="menu-item" id="m-new" ${blocked?'disabled':''}><i class="fas fa-plus"></i> Novo Release</button>
        <button class="menu-item" id="m-sup" ${blocked?'disabled':''}><i class="fas fa-life-ring"></i> Suporte</button>
        <button class="menu-item" id="m-vid" disabled><i class="fas fa-video"></i> Distribuição de videoclipe</button>
        <button class="menu-item" id="m-cat"><i class="fas fa-folder"></i> Catálogos</button>
        <button class="menu-item" id="m-set"><i class="fas fa-gear"></i> Configurações</button>
        <button class="menu-item" id="m-app"><i class="fas fa-download"></i> Baixar o App</button>
        <div style="height:1px;background:var(--border-color);margin:6px 12px"></div>
        <button class="menu-item danger" id="m-out"><i class="fas fa-right-from-bracket"></i> Sair</button>
      </div>
      <main class="p-4 max-w-6xl mx-auto">
        ${blocked ? `<div class="warning-box mb-4 text-sm"><i class="fas fa-triangle-exclamation"></i> Conta ${u.disabled?'desativada':u.rescinded?'rescindida':'excluída'}. Envios estão bloqueados.</div>` : ''}
        <div class="flex items-center justify-between mb-6 mt-4 glass p-4">
          <h1 class="kab text-2xl">Meus Lançamentos</h1>
          <button id="new-rel" class="btn-primary" ${blocked?'disabled':''}><i class="fas fa-plus"></i> Novo Release</button>
        </div>
        ${releases.length === 0 ? `
          <div class="glass p-12 text-center fade-in">
            <div style="font-size:3rem">🎵</div>
            <p class="text-slate-400 mt-4">Nenhum lançamento ainda. Crie o primeiro!</p>
          </div>
        ` : `
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            ${releases.map(r=>renderReleaseCard(r, !!showRevive)).join('')}
          </div>
        `}
      </main>
    </div>`;
}
function renderReleaseCard(r, dimmed){
  const st = displayStatus(r.status || 'Em edição');
  const sc = getStatusColor(st);
  return `
    <div class="glass grid-card relative p-3 ${dimmed?'opacity-50':''}" data-release-id="${esc(r.id)}">
      ${r.coverUrl ? `<img src="${esc(r.coverUrl)}" alt="${esc(r.title)}" class="release-card-cover mb-3" loading="lazy">` : `<div class="release-card-cover mb-3 flex items-center justify-center text-4xl">🎵</div>`}
      <h3 class="kab text-sm truncate">${esc(r.title)}</h3>
      <p class="text-xs text-slate-400 mb-1">${esc((r.type||'').toUpperCase())} • ID ${esc(String(r.id))}</p>
      <span class="status-badge" style="background:${sc.bg};color:${sc.color}"><i class="fas fa-circle" style="font-size:6px"></i> ${esc(st)}</span>
      ${st==='Rejeitado' && r.motivo ? `<div class="mt-2 alert-box text-xs">${esc(r.motivo)}</div>` : ''}
      <button class="edit-rel btn-secondary absolute top-2 right-2" style="padding:.4rem .6rem" data-id="${esc(r.id)}"><i class="fas fa-pen"></i></button>
      <button class="kebab-btn absolute bottom-2 right-2 btn-secondary" style="padding:.3rem .5rem" data-id="${esc(r.id)}"><i class="fas fa-ellipsis-vertical"></i></button>
    </div>`;
}
function bindDashboard(){
  startStatusPolling();
  syncSharedReleases();

  $('#refresh-status').addEventListener('click', async ()=>{
    const btn=$('#refresh-status'); const old=btn.innerHTML;
    btn.innerHTML='<span class="spinner"></span>';
    await refreshReleaseStatuses(); btn.innerHTML=old;
  });
  $('#hamb').addEventListener('click', (e)=>{ e.stopPropagation(); $('#hmenu').classList.toggle('open'); playSound('botao'); });
  const onDocClick = (e)=>{
    const menu = $('#hmenu');
    if(menu && !menu.contains(e.target) && e.target.id !== 'hamb') menu.classList.remove('open');
    $$('.kebab-menu').forEach(m=>{ if(!m.contains(e.target) && !e.target.classList.contains('kebab-btn')) m.remove(); });
  };
  document.addEventListener('click', onDocClick);

  const bindMenu = (id, action, blockedFlag)=>{
    const el=$(id); if(!el) return;
    el.addEventListener('click', ()=>{
      playSound('botao');
      if(blockedFlag){ alert('Conta bloqueada. Não é possível realizar esta ação.'); return; }
      action();
      const m=$('#hmenu'); if(m) m.classList.remove('open');
    });
  };
  const blocked = isBlocked();
  bindMenu('#m-new', ()=>startNewRelease(), blocked);
  bindMenu('#m-sup', ()=>{ state.page='support'; render(); }, blocked);
  bindMenu('#m-vid', ()=>{ alert('🚧 Estamos implementando, chegará em breve.'); }, false);
  bindMenu('#m-cat', ()=>{ state.catalog='releases'; state.page='catalogs'; render(); }, false);
  bindMenu('#m-set', ()=>{ state.page='settings'; render(); }, false);
  bindMenu('#m-app', ()=>{ openInstallMenu(); }, false);
  bindMenu('#m-out', ()=>{
    stopStatusPolling();
    state.user=null;
    localStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_LEGACY_KEY);
    state.page='landing'; render();
  }, false);

  const newRel = $('#new-rel');
  if(newRel) newRel.addEventListener('click', ()=>{
    playSound('botao');
    if(isBlocked()){ alert('Conta bloqueada. Não é possível criar release.'); return; }
    startNewRelease();
  });
  const manageBtn = $('#manage-band');
  if(manageBtn) manageBtn.addEventListener('click', ()=>{ if(isBlocked()) return; openBandManager(); });
  const reviveBtn = $('#revive-btn');
  if(reviveBtn) reviveBtn.addEventListener('click', ()=>{
    if(!confirm('Revigorar reativa a conta apenas localmente. Fonogramas removidos no servidor não serão reativados automaticamente. Continuar?')) return;
    state.user.disabled=false; state.user.rescinded=false;
    persistUser(); render();
  });

  $$('.edit-rel').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(isBlocked()){ alert('Conta bloqueada.'); return; }
      const id=btn.dataset.id;
      const r=(state.user.releases||[]).find(x=>String(x.id)===String(id)); if(!r) return;
      state.draft = JSON.parse(JSON.stringify(r));
      state.page='cover'; render();
    });
  });

  $$('.kebab-btn').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      $$('.kebab-menu').forEach(m=>m.remove());
      const id=btn.dataset.id;
      const menu=document.createElement('div');
      menu.className='kebab-menu open';
      menu.style.position='absolute'; menu.style.bottom='40px'; menu.style.right='8px';
      menu.innerHTML = `
        <button class="kebab-item" data-act="edit"><i class="fas fa-pen"></i> Editar</button>
        <button class="kebab-item" data-act="takedown"><i class="fas fa-arrow-down"></i> Takedown</button>
        <button class="kebab-item danger" data-act="delete"><i class="fas fa-trash"></i> Excluir</button>`;
      btn.parentElement.appendChild(menu);
      menu.querySelectorAll('.kebab-item').forEach(item=>{
        item.addEventListener('click', async (ev)=>{
          ev.stopPropagation(); menu.remove();
          if(isBlocked()){ alert('Conta bloqueada.'); return; }
          try{ await handleReleaseAction(id, item.dataset.act); }
          catch(err){ alert('Erro: '+err.message); }
        });
      });
    });
  });
}

function openInstallMenu(){
  const ov = document.createElement('div'); ov.className='modal-overlay';
  ov.innerHTML = `
    <div class="modal-content">
      <h2 class="kab text-xl mb-4">Baixar o App</h2>
      <div class="space-y-3">
        <a href="#" id="ins-win" class="btn-secondary w-full" style="text-decoration:none"><i class="fab fa-windows"></i> Windows (tucano.exe)</a>
        <button id="ins-android" class="btn-secondary w-full"><i class="fab fa-android"></i> Android (tucano.apk)</button>
        <button id="ins-pwa" class="btn-secondary w-full"><i class="fas fa-mobile-screen"></i> PWA (Adicionar à tela inicial)</button>
      </div>
      <button id="ins-close" class="btn-primary w-full mt-4">Fechar</button>
    </div>`;
  document.body.appendChild(ov);
  $('#ins-close').addEventListener('click', ()=>ov.remove());

  $('#ins-win').addEventListener('click', (e)=>{
    e.preventDefault();
    alert('Você deve pedir diretamente por WhatsApp.');
  });

  $('#ins-android').addEventListener('click', ()=>{
    const eula = `ACORDO DE LICENÇA DE USO DO APP ANDROID DA TUCANO MÚSICA

Ao instalar o app da Tucano Música, você concorda com o acordo:

Você pode redistribuir;
Você não precisa dar créditos a Tucano Música, embora seja bom;
Você não pode fazer engenharia reversa;
Você não pode usar o app para fins de crimes;
Você não pode falar que é seu;
Isso não tem validade jurídica, pois somos menores impúberes, mas vale na palavra da amizade.`;
    const eov = document.createElement('div'); eov.className='modal-overlay';
    eov.innerHTML = `
      <div class="modal-content">
        <h2 class="kab text-lg mb-3">EULA — App Android</h2>
        <pre class="text-sm whitespace-pre-wrap mb-4" style="color:var(--text-secondary);font-family:'Ifood RC',sans-serif">${esc(eula)}</pre>
        <div class="flex gap-2">
          <button id="eula-no" class="btn-secondary flex-1">Não aceito</button>
          <button id="eula-yes" class="btn-primary flex-1">Aceito</button>
        </div>
      </div>`;
    document.body.appendChild(eov);
    $('#eula-no').addEventListener('click', ()=>eov.remove());
    $('#eula-yes').addEventListener('click', async ()=>{
      eov.remove();
      try{
        const sb = getSupabase();
        const { data } = sb.storage.from(BUCKET).getPublicUrl('tucano.apk');
        if(data && data.publicUrl){ const a=document.createElement('a'); a.href=data.publicUrl; a.download='tucano.apk'; document.body.appendChild(a); a.click(); a.remove(); }
        else alert('Arquivo tucano.apk não encontrado no repositório.');
      }catch(err){ alert('Erro: '+err.message); }
    });
  });

  $('#ins-pwa').addEventListener('click', ()=>{
    alert('Use o menu do navegador para "Adicionar à tela inicial".');
  });
}

async function handleReleaseAction(id, act){
  const r=(state.user.releases||[]).find(x=>String(x.id)===String(id)); if(!r) return;
  if(act==='edit'){ state.draft=JSON.parse(JSON.stringify(r)); state.page='cover'; render(); return; }
  if(act==='takedown'){
    if(!confirm('Tem certeza que deseja fazer o takedown? Essa ação ainda é reversível.')) return;
    await uploadText(`Takedown solicitado em ${new Date().toLocaleString('pt-BR')} pelo usuário ${state.user.username}.\nRelease: ${r.title}\n`, `${r.basePath}/takedown.txt`);
    alert('Takedown solicitado. O efeito final depende do admin.');
    return;
  }
  if(act==='delete'){
    if(!confirm('Tem certeza de que deseja excluir? Essa ação é irreversível.')) return;
    const n1 = prompt('Digite o nome do lançamento para confirmar:');
    if(n1 !== r.title){ alert('Nome incorreto.'); return; }
    const n2 = prompt('Digite "delete my release." para confirmar:');
    if(n2 !== 'delete my release.'){ alert('Confirmação incorreta.'); return; }
    await deleteFolderFiles(r.basePath);
    await uploadText('Lançamento excluído pelo artista.', `${r.basePath}/EXCLUA`);
    state.user.releases = (state.user.releases||[]).filter(x=>String(x.id)!==String(id));
    persistUser(); render();
  }
}

// ============================================================
// NOVO LANÇAMENTO
// ============================================================
function startNewRelease(){
  if(isBlocked()){ alert('Conta bloqueada. Não é possível criar release.'); return; }
  state.draft = { type:'', title:'', tracks:[], releaseDate:'' };
  state.page='type'; render();
}
function viewType(){
  if(isBlocked()) return renderBlockedScreen();
  return `
    <div class="min-h-screen p-4 py-8">
      <div class="max-w-3xl mx-auto fade-in">
        <div class="flex items-center justify-between mb-6">
          <h1 class="kab text-2xl">Novo Lançamento</h1>
          <button id="bk" class="btn-secondary"><i class="fas fa-arrow-left"></i> Voltar</button>
        </div>
        <p class="tts text-slate-400 mb-4">Escolha o tipo:</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="type-btn glass p-6 text-center cursor-pointer" data-type="single"><div style="font-size:3rem;color:#a3e635">🎵</div><h3 class="kab text-xl mt-2">Single</h3><p class="text-sm text-slate-400">1 a 3 faixas</p></div>
          <div class="type-btn glass p-6 text-center cursor-pointer" data-type="ep"><div style="font-size:3rem;color:#a855f7">💿</div><h3 class="kab text-xl mt-2">EP</h3><p class="text-sm text-slate-400">4 a 6 faixas</p></div>
          <div class="type-btn glass p-6 text-center cursor-pointer" data-type="album"><div style="font-size:3rem;color:#fbbf24">📀</div><h3 class="kab text-xl mt-2">Álbum</h3><p class="text-sm text-slate-400">7+ faixas</p></div>
        </div>
      </div>
    </div>`;
}
function renderBlockedScreen(){
  return `
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="glass glow p-8 max-w-md w-full text-center fade-in-scale">
        <div style="font-size:3rem">🚫</div>
        <h1 class="kab text-2xl mt-4 mb-2">Conta bloqueada</h1>
        <p class="tts text-slate-400 mb-6">Sua conta está desativada ou rescindida. Não é possível criar releases nem enviar videoclipes.</p>
        <button class="btn-secondary" id="bk-dash">Voltar ao painel</button>
      </div>
    </div>`;
}
function bindBlockedBack(){
  const el = $('#bk-dash');
  if(el) el.addEventListener('click', ()=>{ state.page='dashboard'; render(); });
}
function bindType(){
  if(isBlocked()){ bindBlockedBack(); return; }
  $('#bk').addEventListener('click', ()=>{ state.page='dashboard'; render(); });
  $$('.type-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      playSound('botao');
      state.draft = { type: btn.dataset.type, title:'', tracks:[], releaseDate:'', releaseTime:'', timezone:'' };
      state.page='cover'; render();
    });
  });
}

// ============================================================
// CAPA E METADADOS
// ============================================================
function viewCover(){
  if(isBlocked()) return renderBlockedScreen();
  const d = state.draft;
  const isKnitting = state.user.contractType === 'knitting';
  const isTucano = state.user.contractType === 'tucano';
  const yearNow = new Date().getFullYear();

  const timezones = [
    {v:'-03:00', l:'Brasília (UTC-3)'}, {v:'-04:00', l:'Manaus (UTC-4)'},
    {v:'-05:00', l:'Acre (UTC-5)'}, {v:'+00:00', l:'Londres (UTC+0)'},
    {v:'+01:00', l:'Paris (UTC+1)'}, {v:'+03:00', l:'Moscou (UTC+3)'},
    {v:'+09:00', l:'Tóquio (UTC+9)'}, {v:'-08:00', l:'Los Angeles (UTC-8)'},
    {v:'-05:00', l:'Nova York (UTC-5)'}
  ];

  return `
    <div class="min-h-screen p-4 py-8">
      <div class="max-w-2xl mx-auto fade-in">
        <div class="flex items-center justify-between mb-6">
          <h1 class="kab text-2xl">Capa e Metadados</h1>
          <button id="bk" class="btn-secondary"><i class="fas fa-arrow-left"></i> Voltar</button>
        </div>
        <div class="info-box mb-4 text-sm">
          <strong>Diretrizes:</strong> PNG/JPG • 3000x3000 obrigatório • Apenas nome do lançamento, artista e Parental Advisory • Sem logos ou conteúdo explícito • Sem bordas.<br>
          <span class="text-xs">O navegador valida formato e dimensão. Bitrate/codec de áudio e regras visuais da capa não são verificadas no navegador — o admin revisa.</span>
        </div>
        <div class="glass p-4 mb-4">
          <label>Capa * (PNG/JPG 3000x3000)</label>
          <div class="file-input-wrapper"><input id="cov-in" type="file" accept="image/png,image/jpeg"><button type="button" class="btn-secondary w-full"><i class="fas fa-image"></i> <span id="cov-label">Escolher capa</span></button></div>
          <div id="cov-preview" class="mt-3" style="display:none"><img id="cov-img" style="width:100%;border-radius:12px" alt="Preview"></div>
        </div>

        <div class="glass p-4 mb-4 space-y-2">
          <label>ID do Release (numérico, 4 dígitos) *</label>
          <div class="flex gap-2">
            <input id="f-id" type="text" inputmode="numeric" maxlength="4" pattern="\\d{4}" placeholder="${esc(d.id||'')}" value="${d.id && !d.idAuto ? esc(d.id) : ''}" ${d.idAuto?'disabled':''}>
            <label class="flex items-center gap-2 text-sm whitespace-nowrap"><input type="checkbox" id="f-id-auto" ${d.idAuto?'checked':''}> Automático</label>
          </div>
          <p class="text-xs text-slate-400">Deixe em automático ou digite um ID de 1000 a 9999.</p>
        </div>

        <div class="glass p-4 mb-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" id="f-compilation" ${d.isCompilation?'checked':''}>
            <span class="text-sm">É uma compilação? (vários artistas)</span>
          </label>
        </div>

        <div class="glass p-4 mb-4 space-y-2">
          <label>É um feat? *</label>
          <select id="f-feat">
            <option value="">Selecione</option>
            <option value="nao" ${d.isFeat==='nao'?'selected':''}>Não</option>
            <option value="sim" ${d.isFeat==='sim'?'selected':''}>Sim</option>
          </select>
          <div id="f-feat-area" style="display:${d.isFeat==='sim'?'block':'none'}">
            <label>Artistas convidados (feat.)</label>
            <div id="f-feat-list" class="space-y-2">
              ${(d.featArtists||[]).map((f,i)=>`
                <div class="flex gap-2 items-center">
                  <input class="feat-name" type="text" placeholder="Nome do artista" value="${esc(f.name||'')}">
                  <input class="feat-spotify" type="text" placeholder="URL/URI do Spotify (opcional)" value="${esc(f.spotify||'')}">
                  <button class="rm-feat btn-danger" style="padding:.2rem .5rem" data-i="${i}"><i class="fas fa-times"></i></button>
                </div>`).join('')}
            </div>
            <button id="add-feat" class="btn-secondary text-sm mt-2"><i class="fas fa-plus"></i> Adicionar artista</button>
          </div>
        </div>

        <div class="glass p-4 mb-4 space-y-3">
          <div>
            <label>Licença da Capa *</label>
            <select id="f-license">
              ${LICENSE_OPTIONS.map(o=>`<option value="${o.v}" ${d.license===o.v?'selected':''}>${o.l}</option>`).join('')}
            </select>
          </div>
          <div id="license-attr-wrap" style="display:none">
            <label>Atribuição (Nome completo ou usuário) *</label>
            <input id="f-license-attr" type="text" value="${esc(d.licenseAttr||'')}" placeholder="Ex: @fulano ou João Silva">
          </div>
        </div>

        <div class="glass p-4 space-y-3">
          <div><label>Título *</label><input id="f-title" type="text" value="${esc(d.title||'')}"></div>
          <div><label>UPC/EAN</label><input id="f-upc" type="text" value="${esc(d.upc||'')}"></div>
          <div>
            <label>Gênero principal *</label>
            <select id="f-genre"><option value="">Selecione</option>${GENRES.map(g=>`<option value="${esc(g)}" ${d.genre===g?'selected':''}>${esc(g)}</option>`).join('')}</select>
          </div>
          <div><label>Subgênero</label><input id="f-sub" type="text" value="${esc(d.subgenre||'')}"></div>
          ${!isKnitting ? `<div><label>Ano de produção ℗ *</label><input id="f-py" type="number" min="1900" max="${yearNow}" value="${esc(d.py||yearNow)}"></div>` : ''}
          ${!isKnitting && !isTucano ? `<div><label>Detentor ℗ *</label><input id="f-ph" type="text" value="${esc(d.ph||'')}"></div>` : ''}
          ${!isKnitting ? `<div><label>Ano de produção © *</label><input id="f-cy" type="number" min="1900" max="${yearNow}" value="${esc(d.cy||yearNow)}"></div>` : ''}
          ${!isKnitting ? `<div><label>Detentor © *</label><input id="f-ch" type="text" value="${esc(d.ch||'')}"></div>` : ''}
          <div class="grid grid-cols-2 gap-3">
            <div><label>Data de lançamento * (mín. 14 dias)</label><input id="f-date" type="date" min="${datePlus(14)}" value="${esc(d.releaseDate||'')}"></div>
            <div><label>Horário *</label><input id="f-time" type="time" value="${esc(d.releaseTime||'')}"></div>
          </div>
          <div>
            <label>Fuso Horário *</label>
            <select id="f-timezone">
              <option value="">Selecione</option>
              ${timezones.map(t=>`<option value="${t.v}" ${d.timezone===t.v?'selected':''}>${t.l}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="cover-error" class="alert-box mt-3" style="display:none"></div>
        <div class="grid grid-cols-2 gap-3 mt-4">
          <button id="save-draft" class="btn-secondary w-full"><i class="fas fa-floppy-disk"></i> Salvar como Rascunho</button>
          <button id="next-tracks" class="btn-primary w-full"><i class="fas fa-arrow-right"></i> Próximo (Faixas)</button>
        </div>
      </div>
    </div>`;
}

function bindCover(){
  if(isBlocked()){ bindBlockedBack(); return; }
  const d = state.draft;
  $('#bk').addEventListener('click', ()=>{ state.page='type'; render(); });
  let coverFile = d.coverFile || null; let coverDimsOk = !!d.coverDimsOk; let previewUrl = d.coverUrl || null;

  if(previewUrl && coverDimsOk){
    $('#cov-label').textContent = 'Capa já carregada';
    $('#cov-img').src = previewUrl;
    $('#cov-preview').style.display = 'block';
  }

  const licSel = $('#f-license');
  const syncLic = ()=>{
    const v = licSel.value;
    $('#license-attr-wrap').style.display = (v==='cc-by' || v==='cc-by-nd') ? 'block' : 'none';
  };
  licSel.addEventListener('change', syncLic); syncLic();

  const idInput = $('#f-id');
  const idAuto = $('#f-id-auto');
  const syncId = ()=>{
    if(idAuto.checked){ idInput.disabled = true; idInput.value = ''; }
    else { idInput.disabled = false; }
  };
  idAuto.addEventListener('change', syncId); syncId();

  const featSel = $('#f-feat');
  const featArea = $('#f-feat-area');
  featSel.addEventListener('change', ()=>{
    featArea.style.display = featSel.value==='sim' ? 'block' : 'none';
    if(featSel.value!=='sim'){ d.featArtists = []; render(); }
  });
  const addFeat = $('#add-feat');
  if(addFeat) addFeat.addEventListener('click', ()=>{
    d.featArtists = d.featArtists || [];
    d.featArtists.push({ name:'', spotify:'' });
    $$('.feat-name').forEach((el,i)=>{ if(d.featArtists[i]) d.featArtists[i].name = el.value; });
    $$('.feat-spotify').forEach((el,i)=>{ if(d.featArtists[i]) d.featArtists[i].spotify = el.value; });
    render();
  });
  $$('.rm-feat').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      $$('.feat-name').forEach((el,i)=>{ if(d.featArtists[i]) d.featArtists[i].name = el.value; });
      $$('.feat-spotify').forEach((el,i)=>{ if(d.featArtists[i]) d.featArtists[i].spotify = el.value; });
      d.featArtists.splice(+btn.dataset.i, 1);
      render();
    });
  });

  $('#cov-in').addEventListener('change', ()=>{
    const f = $('#cov-in').files[0]; if(!f) return;
    if(!['image/png','image/jpeg'].includes(f.type)){ alert('Formato inválido. Use PNG ou JPG.'); $('#cov-in').value=''; return; }
    if(previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(f);
    const img = new Image();
    img.onload = ()=>{
      if(img.width !== 3000 || img.height !== 3000){ alert('A capa precisa ter exatamente 3000x3000 pixels.'); $('#cov-in').value=''; return; }
      coverFile=f; coverDimsOk=true;
      $('#cov-label').textContent=f.name;
      $('#cov-img').src=previewUrl;
      $('#cov-preview').style.display='block';
    };
    img.onerror = ()=>{ alert('Erro ao carregar imagem.'); $('#cov-in').value=''; };
    img.src = previewUrl;
  });

  const collectCover = ()=>{
    const isKnitting = state.user.contractType === 'knitting';
    const isTucano = state.user.contractType === 'tucano';
    const yearNow = new Date().getFullYear();
    d.title = $('#f-title').value.trim();
    d.upc = $('#f-upc').value.trim();
    d.genre = $('#f-genre').value;
    d.subgenre = $('#f-sub').value.trim();
    d.releaseDate = $('#f-date').value;
    d.releaseTime = $('#f-time').value;
    d.timezone = $('#f-timezone').value;
    d.license = licSel.value;
    d.licenseAttr = $('#f-license-attr').value.trim();
    d.coverFile = coverFile; d.coverDimsOk = coverDimsOk;
    d.isCompilation = $('#f-compilation').checked;
    d.isFeat = $('#f-feat').value || '';
    if(featArea.style.display !== 'none'){
      d.featArtists = $$('.feat-name').map((el,i)=>({
        name: el.value.trim(),
        spotify: ($$('.feat-spotify')[i] || {}).value?.trim() || ''
      }));
    } else { d.featArtists = []; }
    if(idAuto.checked){
      d.id = d.id || generateNumericId(state.user.releases);
      d.idAuto = true;
    } else {
      const raw = idInput.value.trim();
      d.idAuto = false;
      d.id = /^\d{4}$/.test(raw) ? raw : '';
    }
    if(!isKnitting){
      d.py = $('#f-py') ? $('#f-py').value : yearNow;
      d.ph = isTucano ? 'Lantuns' : ($('#f-ph') ? $('#f-ph').value.trim() : '');
      d.cy = $('#f-cy') ? $('#f-cy').value : yearNow;
      d.ch = $('#f-ch') ? $('#f-ch').value.trim() : '';
    } else {
      d.py=yearNow; d.ph='Knitting'; d.cy=yearNow; d.ch='Knitting';
    }
  };

  const validate = ()=>{
    const err = $('#cover-error'); err.style.display='none';
    if(!coverDimsOk){ err.textContent='Envie a capa 3000x3000.'; err.style.display='block'; return false; }
    if(!d.title){ err.textContent='Preencha o título.'; err.style.display='block'; return false; }
    if(!d.genre){ err.textContent='Selecione o gênero.'; err.style.display='block'; return false; }
    if(!d.releaseDate){ err.textContent='Preencha a data de lançamento.'; err.style.display='block'; return false; }
    if(d.releaseDate < datePlus(14)){ err.textContent=`Data mínima: ${fmtDate(datePlus(14))}.`; err.style.display='block'; return false; }
    if(!d.releaseTime){ err.textContent='Preencha o horário.'; err.style.display='block'; return false; }
    if(!d.timezone){ err.textContent='Selecione o fuso horário.'; err.style.display='block'; return false; }
    if((d.license==='cc-by' || d.license==='cc-by-nd') && !d.licenseAttr){ err.textContent='Preencha a atribuição da licença.'; err.style.display='block'; return false; }
    if(!d.id || !/^\d{4}$/.test(String(d.id))){ err.textContent='Informe um ID numérico de 4 dígitos.'; err.style.display='block'; return false; }
    if((state.user.releases||[]).some(r=>String(r.id)===String(d.id))){
      err.textContent='Já existe um release com esse ID. Use outro ou automático.'; err.style.display='block'; return false;
    }
    if(d.isFeat==='sim'){
      const feats = (d.featArtists||[]).filter(f=>f.name);
      if(!feats.length){ err.textContent='Adicione ao menos um artista feat.'; err.style.display='block'; return false; }
    }
    return true;
  };

  $('#save-draft').addEventListener('click', async ()=>{
    collectCover();
    d.statusDraft = true;
    if(!d.tracks || d.tracks.length===0) d.tracks=[emptyTrack()];
    await submitRelease(true);
  });

  $('#next-tracks').addEventListener('click', ()=>{
    collectCover();
    if(!validate()) return;
    if(!d.tracks || d.tracks.length === 0) d.tracks = [emptyTrack()];
    state.page='tracks'; render();
  });
}

// ============================================================
// FAIXAS
// ============================================================
function emptyTrack(){
  return {
    title:'', file:null, artist:'', feat:'', featSpotify:'', composers:'',
    isrc:'', explicit:false, license:'direitos', fileUrl:'', duration:0, fileName:'', url:''
  };
}

function viewTracks(){
  if(isBlocked()) return renderBlockedScreen();
  const d = state.draft;
  const type = d.type;
  const max = type==='single'?3:type==='ep'?6:50;
  const artists = (state.user.artists || []).concat([state.user.artistName]).filter(Boolean);
  const uniqArtists = [...new Set(artists)];
  return `
    <div class="min-h-screen p-4 py-8">
      <div class="max-w-3xl mx-auto fade-in">
        <div class="flex items-center justify-between mb-6">
          <h1 class="kab text-2xl">Faixas - ${esc((type||'').toUpperCase())}</h1>
          <button id="bk" class="btn-secondary"><i class="fas fa-arrow-left"></i> Voltar</button>
        </div>
        <div id="tracks-container" class="space-y-4">${d.tracks.map((t,i)=>trackCard(t,i,uniqArtists)).join('')}</div>
        <button id="add-t" class="btn-secondary w-full mt-4" ${d.tracks.length>=max?'disabled':''}><i class="fas fa-plus"></i> Adicionar faixa</button>
        <div id="track-error" class="alert-box mt-3" style="display:none"></div>
        <div class="grid grid-cols-2 gap-3 mt-4">
          <button id="save-draft" class="btn-secondary w-full"><i class="fas fa-floppy-disk"></i> Salvar como Rascunho</button>
          <button id="submit-release" class="btn-primary w-full"><i class="fas fa-paper-plane"></i> Enviar para Revisão 🐦🕵️🌴♫♪</button>
        </div>
      </div>
    </div>`;
}

function trackCard(t, i, artists){
  return `
    <div class="glass p-4 fade-in" data-idx="${i}">
      <div class="flex items-center justify-between mb-3">
        <h3 class="kab">Faixa ${i+1}</h3>
        <button class="rm-t btn-danger" style="padding:.3rem .5rem" data-idx="${i}"><i class="fas fa-trash"></i></button>
      </div>
      <div class="space-y-3">
        <div><label>Título *</label><input class="t-title" type="text" value="${esc(t.title)}"></div>
        <div>
          <label>Arquivo de áudio * (MP3/WAV)</label>
          <input class="t-file" type="file" accept=".mp3,.wav">
          <p class="text-xs text-slate-400 mt-1">${t.file ? '📁 '+esc(t.file.name) : (t.fileName ? '📁 '+esc(t.fileName)+' (já no servidor)' : 'Nenhum arquivo')}</p>
        </div>
        <div>
          <label>Artista principal *</label>
          <select class="t-artist"><option value="">Selecione</option>${artists.map(a=>`<option value="${esc(a)}" ${t.artist===a?'selected':''}>${esc(a)}</option>`).join('')}</select>
        </div>
        <div>
          <label>É um feat? *</label>
          <select class="t-feat-sel">
            <option value="nao" ${t.isFeat==='sim'?'':'selected'}>Não</option>
            <option value="sim" ${t.isFeat==='sim'?'selected':''}>Sim</option>
          </select>
        </div>
        <div class="t-feat-area" style="display:${t.isFeat==='sim'?'block':'none'}">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div><label>Artista convidado</label><input class="t-feat" type="text" value="${esc(t.feat||'')}"></div>
            <div><label>URL/URI do Spotify (opcional)</label><input class="t-feat-spotify" type="text" value="${esc(t.featSpotify||'')}"></div>
          </div>
        </div>
        <div><label>Compositores *</label><input class="t-composers" type="text" value="${esc(t.composers)}"></div>
        <div>
          <label>Licença *</label>
          <select class="t-license">
            ${LICENSE_OPTIONS.map(o=>`<option value="${o.v}" ${t.license===o.v?'selected':''}>${o.l}</option>`).join('')}
          </select>
        </div>
        <div><label>ISRC</label><input class="t-isrc" type="text" value="${esc(t.isrc)}"></div>
        <label class="flex items-center gap-2 cursor-pointer"><input class="t-explicit" type="checkbox" ${t.explicit?'checked':''}><span class="text-sm">Conteúdo explícito</span></label>
      </div>
    </div>`;
}

function bindTracks(){
  if(isBlocked()){ bindBlockedBack(); return; }
  const d = state.draft;
  const objectUrls = [];
  const revokeAll = ()=>{ objectUrls.forEach(u=>URL.revokeObjectURL(u)); objectUrls.length=0; };
  $('#bk').addEventListener('click', ()=>{ revokeAll(); state.page='cover'; render(); });

  const collect = ()=>{
    $$('#tracks-container > div').forEach(card=>{
      const i = +card.dataset.idx;
      const t = d.tracks[i] || emptyTrack();
      t.title = card.querySelector('.t-title').value;
      t.artist = card.querySelector('.t-artist').value;
      t.isFeat = card.querySelector('.t-feat-sel').value;
      t.feat = card.querySelector('.t-feat').value;
      t.featSpotify = card.querySelector('.t-feat-spotify').value;
      t.composers = card.querySelector('.t-composers').value;
      t.license = card.querySelector('.t-license').value;
      t.isrc = card.querySelector('.t-isrc').value;
      t.explicit = card.querySelector('.t-explicit').checked;
    });
  };

  $$('.t-feat-sel').forEach(sel=>{
    sel.addEventListener('change', ()=>{
      const card = sel.closest('[data-idx]');
      const area = card.querySelector('.t-feat-area');
      area.style.display = sel.value==='sim' ? 'block' : 'none';
    });
  });

  $$('.t-file').forEach(inp=>{
    inp.addEventListener('change', ()=>{
      const card = inp.closest('[data-idx]');
      const i = +card.dataset.idx;
      const f = inp.files[0];
      if(!f) return;
      const ext = f.name.split('.').pop().toLowerCase();
      if(!['mp3','wav'].includes(ext)){ alert('Formato inválido. Use MP3 ou WAV.'); inp.value=''; return; }
      const url = URL.createObjectURL(f);
      objectUrls.push(url);
      const audio = new Audio(url);
      audio.addEventListener('loadedmetadata', ()=>{
        const dur = audio.duration;
        if(!isFinite(dur) || dur < 30 || dur > 2700){ alert('Duração fora do permitido (30s a 45min).'); inp.value=''; return; }
        d.tracks[i].file = f;
        d.tracks[i].duration = dur;
        const p = card.querySelector('.text-xs');
        if(p) p.textContent = '📁 '+f.name;
      });
      audio.addEventListener('error', ()=>{ alert('Não foi possível ler o áudio.'); inp.value=''; });
    });
  });

  $$('.rm-t').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const i = +btn.dataset.idx;
      collect();
      d.tracks.splice(i,1);
      if(d.tracks.length===0) d.tracks.push(emptyTrack());
      revokeAll(); render();
    });
  });

  const addBtn = $('#add-t');
  if(addBtn) addBtn.addEventListener('click', ()=>{ collect(); d.tracks.push(emptyTrack()); revokeAll(); render(); });

  $('#save-draft').addEventListener('click', async ()=>{
    collect();
    d.statusDraft = true;
    await submitRelease(true);
  });

  $('#submit-release').addEventListener('click', async ()=>{
    collect();
    d.statusDraft = false;
    await submitRelease(false);
  });
}

async function submitRelease(isDraft){
  const d = state.draft;
  const err = $('#track-error'); if(err) err.style.display='none';
  const type = d.type;
  const min = type==='single'?1:type==='ep'?4:7;
  const max = type==='single'?3:type==='ep'?6:50;

  if(!isDraft){
    if(d.tracks.length < min){ err.textContent=`Mínimo de ${min} faixas.`; err.style.display='block'; return; }
    if(d.tracks.length > max){ err.textContent=`Máximo de ${max} faixas.`; err.style.display='block'; return; }
    for(let i=0;i<d.tracks.length;i++){
      const t = d.tracks[i];
      if(!t.title || (!t.file && !t.fileName) || !t.artist || !t.composers || !t.license){
        err.textContent = `Preencha todos os campos obrigatórios da faixa ${i+1}.`;
        err.style.display='block'; return;
      }
    }
    if(type==='ep'){
      const totalDur = d.tracks.reduce((s,t)=>s+(t.duration || 0), 0);
      if(totalDur < 600){ err.textContent='EP precisa de pelo menos 10 minutos totais.'; err.style.display='block'; return; }
    }
  }

  const btn = $('#submit-release') || $('#save-draft');
  const old = btn.innerHTML;
  btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Enviando...';

  try{
    const releaseId = String(d.id || generateNumericId(state.user.releases));
    const basePath = `${safePathUser(state.user.username)}/${releaseId}`;
    let coverUrl = d.coverUrl || '';
    if(d.coverFile){
      coverUrl = await uploadFile(d.coverFile, `${basePath}/capa_${safeName(d.coverFile.name)}`);
    }
    playSound('sucesso');

    const trackUrls = [];
    for(let i=0;i<d.tracks.length;i++){
      const t = d.tracks[i];
      if(t.file){
        const nn = String(i+1).padStart(2,'0');
        const url = await uploadFile(t.file, `${basePath}/faixa${nn}_${safeName(t.file.name)}`);
        trackUrls.push(url); playSound('sucesso');
      } else {
        trackUrls.push(t.url || '');
      }
    }

    let meta = `Lançamento ${isDraft?'(rascunho)':''}

ID: ${releaseId}
Tipo: ${d.type.toUpperCase()}
Título: ${d.title}
UPC/EAN: ${d.upc || ''}
Capa: ${d.coverFile ? d.coverFile.name : (d.coverUrl ? '(já no servidor)' : '')}
Licença da Capa: ${d.license} ${d.licenseAttr ? '(Atribuição: '+d.licenseAttr+')' : ''}
Compilação: ${d.isCompilation?'Sim':'Não'}
É um feat?: ${d.isFeat || 'Não'}
${(d.featArtists||[]).map((f,i)=>`Feat ${i+1}: ${f.name}${f.spotify?` (Spotify: ${f.spotify})`:''}`).join('\n')}
Gênero principal: ${d.genre}
Subgênero: ${d.subgenre || ''}
Ano de produção dos direitos ℗: ${d.py}
Detentor ℗: ${d.ph}
Ano de produção do ©: ${d.cy}
Detentor ©: ${d.ch}
Data de lançamento: ${fmtDate(d.releaseDate)} às ${d.releaseTime} (${d.timezone})

DADOS DO ARTISTA
Nome completo: ${state.user.fullName || ''}
Nome artístico: ${state.user.artistName || ''}
E-mail: ${state.user.email || ''}
WhatsApp: ${state.user.whatsapp || ''}
Usuário: ${state.user.username}
Data do envio: ${new Date().toLocaleString('pt-BR')}

`;
    d.tracks.forEach((t,i)=>{
      meta += `Música ${i+1}
Título: ${t.title}
Artista principal: ${t.artist}
É um feat?: ${t.isFeat || 'Não'}
Artista featured: ${t.feat || ''}
Spotify do feat: ${t.featSpotify || ''}
Compositores: ${t.composers}
Licença: ${t.license || ''}
ISRC: ${t.isrc || ''}
Explícito: ${t.explicit ? 'Sim (Parental Advisory)' : 'Não'}
Nome do arquivo: ${t.file ? t.file.name : (t.fileName || '')}

`;
    });
    await uploadText(meta, `${basePath}/metadados.txt`);

    const statusTxt = `Tipo: Som\nID: ${releaseId}\nStatus: ${isDraft?'Rascunho':'Revisão'}\nMotivo: `;
    await uploadText(statusTxt, `${basePath}/status.txt`);

    const release = {
      id: releaseId, title: d.title || '(sem título)', type: d.type, genre: d.genre,
      releaseDate: d.releaseDate, releaseTime: d.releaseTime, timezone: d.timezone,
      license: d.license, licenseAttr: d.licenseAttr,
      isCompilation: !!d.isCompilation, isFeat: d.isFeat || 'nao',
      featArtists: d.featArtists || [],
      coverUrl, trackUrls, basePath,
      metaPath: `${basePath}/metadados.txt`,
      status: isDraft ? 'Em edição' : 'Revisão', motivo:'',
      createdAt: new Date().toISOString(),
      tracks: d.tracks.map((t,i)=>({
        title:t.title, artist:t.artist, isFeat:t.isFeat||'nao', feat:t.feat||'',
        featSpotify:t.featSpotify||'', composers:t.composers, license:t.license||'',
        isrc:t.isrc||'', explicit:!!t.explicit,
        fileName: t.file ? t.file.name : (t.fileName||''),
        url: trackUrls[i]||''
      }))
    };

    state.user.releases = (state.user.releases || []).filter(r=>String(r.id)!==String(releaseId));
    state.user.releases.push(release);
    persistUser();
    playSound(isDraft ? 'sucesso' : 'sucessao');
    state.draft = {};
    state.page='dashboard'; render();
  }catch(e){
    console.error(e);
    if(err){ err.textContent = 'Erro: '+e.message; err.style.display='block'; }
    else alert('Erro: '+e.message);
    btn.disabled=false; btn.innerHTML=old;
  }
}

// ============================================================
// SUPORTE
// ============================================================
function viewSupport(){
  if(isBlocked()) return renderBlockedScreen();
  return `
    <div class="min-h-screen p-4 py-8">
      <div class="max-w-xl mx-auto fade-in">
        <div class="flex items-center justify-between mb-6">
          <h1 class="kab text-2xl">Suporte</h1>
          <button id="bk" class="btn-secondary"><i class="fas fa-arrow-left"></i> Voltar</button>
        </div>
        <div class="glass p-6 space-y-4">
          <div><label>Assunto *</label><input id="s-sub" type="text"></div>
          <div><label>Mensagem *</label><textarea id="s-msg" rows="5"></textarea></div>
          <div>
            <label>Foto (opcional)</label>
            <div class="file-input-wrapper"><input id="s-photo" type="file" accept="image/*"><button type="button" class="btn-secondary w-full"><i class="fas fa-image"></i> <span id="s-photo-label">Escolher foto</span></button></div>
          </div>
          <div id="s-error" class="alert-box" style="display:none"></div>
          <button id="s-end" class="btn-primary w-full"><i class="fas fa-paper-plane"></i> Enviar</button>
        </div>
      </div>
    </div>`;
}
function bindSupport(){
  if(isBlocked()){ bindBlockedBack(); return; }
  $('#bk').addEventListener('click', ()=>{ state.page='dashboard'; render(); });
  $('#s-photo').addEventListener('change', ()=>{ const f=$('#s-photo').files[0]; $('#s-photo-label').textContent = f ? f.name : 'Escolher foto'; });
  $('#s-end').addEventListener('click', async ()=>{
    if(isBlocked()){ alert('Conta bloqueada.'); return; }
    const sub=$('#s-sub').value.trim(); const msg=$('#s-msg').value.trim();
    const photo=$('#s-photo').files[0];
    const err=$('#s-error'); err.style.display='none';
    if(!sub||!msg){ err.textContent='Preencha assunto e mensagem.'; err.style.display='block'; return; }
    const btn=$('#s-end'); btn.disabled=true; btn.innerHTML='<span class="spinner"></span>';
    try{
      const sid = uid();
      const base = `support/${safePathUser(state.user.username)}/${sid}`;
      let photoUrl='';
      if(photo){ photoUrl = await uploadFile(photo, `${base}/foto_${safeName(photo.name)}`); playSound('sucesso'); }
      const txt = `Suporte\n\nUsuário: ${state.user.username}\nNome completo: ${state.user.fullName || ''}\nNome artístico: ${state.user.artistName || ''}\nE-mail: ${state.user.email || ''}\nWhatsApp: ${state.user.whatsapp || ''}\nAssunto: ${sub}\nData: ${new Date().toLocaleString('pt-BR')}\nFoto: ${photoUrl || '(nenhuma)'}\n\nMensagem:\n${msg}`;
      await uploadText(txt, `${base}/mensagem.txt`);
      playSound('sucessao'); alert('Mensagem de suporte enviada!');
      state.page='dashboard'; render();
    }catch(e){ err.textContent='Erro: '+e.message; err.style.display='block'; }
    finally{ btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> Enviar'; }
  });
}

// ============================================================
// VIDEOCLIPE
// ============================================================
function viewVideo(){
  if(isBlocked()) return renderBlockedScreen();
  return `
    <div class="min-h-screen p-4 py-8 flex items-center justify-center">
      <div class="glass glow p-12 max-w-lg w-full text-center fade-in-scale">
        <div style="font-size:5rem">🚧</div>
        <h1 class="kab text-3xl mt-4 mb-2">Estamos implementando!</h1>
        <p class="tts text-slate-300">A distribuição de videoclipes chegará em breve.</p>
        <button id="bk" class="btn-secondary w-full mt-6"><i class="fas fa-arrow-left"></i> Voltar ao painel</button>
      </div>
    </div>`;
}
function bindVideo(){
  $('#bk').addEventListener('click', ()=>{ state.page='dashboard'; render(); });
}

// ============================================================
// CATÁLOGOS
// ============================================================
function viewCatalogs(){
  const isVideo = state.catalog === 'videos';
  const items = isVideo ? [] : (state.user.releases || []);
  return `
    <div class="min-h-screen p-4 py-8">
      <div class="max-w-4xl mx-auto fade-in">
        <div class="flex items-center justify-between mb-6">
          <h1 class="kab text-2xl">Catálogos</h1>
          <div class="flex gap-2">
            <button id="refresh-cat" class="btn-secondary text-sm"><i class="fas fa-rotate"></i></button>
            <button id="bk" class="btn-secondary"><i class="fas fa-arrow-left"></i> Voltar</button>
          </div>
        </div>
        <div class="flex gap-2 mb-6">
          <button id="cat-rel" class="btn-${isVideo?'secondary':'primary'} text-sm">Releases</button>
          <button id="cat-vid" class="btn-${isVideo?'primary':'secondary'} text-sm">Videoclipes</button>
        </div>
        ${isVideo ? `
          <div class="glass p-12 text-center">
            <div style="font-size:4rem">🚧</div>
            <h3 class="kab text-xl mt-4">Estamos implementando, chegará em breve.</h3>
          </div>
        ` : items.length === 0 ? `<div class="glass p-12 text-center"><p class="text-slate-400">Nenhum item neste catálogo.</p></div>` : `<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">${items.map(r=>catalogCard(r, isVideo)).join('')}</div>`}
      </div>
    </div>`;
}
function catalogCard(r, isVideo){
  const st = displayStatus(r.status || 'Em edição');
  const sc = getStatusColor(st);
  return `
    <div class="glass p-4 relative">
      ${r.coverUrl ? `<img src="${esc(r.coverUrl)}" alt="" class="release-card-cover mb-3" loading="lazy">` : ''}
      <h3 class="kab">${esc(r.title)}</h3>
      <p class="text-xs text-slate-400 mb-2">${isVideo ? esc(r.releaseTitle||'') : esc((r.type||'').toUpperCase())} • ID ${esc(String(r.id))}</p>
      <span class="status-badge" style="background:${sc.bg};color:${sc.color}"><i class="fas fa-circle" style="font-size:6px"></i> ${esc(st)}</span>
      ${st==='Rejeitado' && r.motivo ? `<div class="mt-2 alert-box text-xs">${esc(r.motivo)}</div>` : ''}
    </div>`;
}
function bindCatalogs(){
  startStatusPolling();
  $('#bk').addEventListener('click', ()=>{ state.page='dashboard'; render(); });
  $('#cat-rel').addEventListener('click', ()=>{ state.catalog='releases'; render(); });
  $('#cat-vid').addEventListener('click', ()=>{ state.catalog='videos'; render(); });
  $('#refresh-cat').addEventListener('click', async ()=>{
    const btn=$('#refresh-cat'); const old=btn.innerHTML; btn.innerHTML='<span class="spinner"></span>';
    await refreshReleaseStatuses(); btn.innerHTML=old;
  });
}

// ============================================================
// CONFIGURAÇÕES
// ============================================================
function viewSettings(){
  return `
    <div class="min-h-screen p-4 py-8">
      <div class="max-w-2xl mx-auto fade-in">
        <div class="flex items-center justify-between mb-6">
          <h1 class="kab text-2xl">Configurações</h1>
          <button id="bk" class="btn-secondary"><i class="fas fa-arrow-left"></i> Voltar</button>
        </div>
        <div class="space-y-4">
          <div class="glass p-4">
            <h3 class="kab mb-3">1. Geral</h3>
            <div class="ml-4 space-y-2">
              <details>
                <summary class="cursor-pointer font-semibold text-sm">1.1. Tema</summary>
                <div class="ml-4 mt-2 flex gap-2">
                  <button id="theme-dark" class="btn-secondary text-sm"><i class="fas fa-moon"></i> Preto</button>
                  <button id="theme-light" class="btn-secondary text-sm"><i class="fas fa-sun"></i> Branco</button>
                </div>
              </details>
              <details>
                <summary class="cursor-pointer font-semibold text-sm">1.2. Contrato de Distribuição</summary>
                <div class="ml-4 mt-2"><button id="view-contract" class="btn-secondary text-sm w-full">Ver contrato</button></div>
              </details>
            </div>
          </div>
          <div class="glass p-4">
            <h3 class="kab mb-3">2. Conta</h3>
            <div class="ml-4 space-y-2">
              <details>
                <summary class="cursor-pointer font-semibold text-sm">2.1. Dados</summary>
                <div class="ml-4 mt-2 text-sm space-y-1 text-slate-300">
                  <p><strong>Usuário:</strong> ${esc(state.user.username)}</p>
                  <p><strong>Nome completo:</strong> ${esc(state.user.fullName||'-')}</p>
                  <p><strong>Nome artístico:</strong> ${esc(state.user.artistName||'-')}</p>
                  <p><strong>E-mail:</strong> ${esc(state.user.email||'-')}</p>
                  <p><strong>WhatsApp:</strong> ${esc(state.user.whatsapp||'-')}</p>
                  <p><strong>TikTok:</strong> ${esc(state.user.tiktok||'-')}</p>
                  <p><strong>Série escolar:</strong> ${esc(state.user.schoolGrade||'-')}</p>
                </div>
              </details>
            </div>
          </div>
          <div class="glass p-4">
            <h3 class="kab mb-3">3. Reclamações</h3>
            <div class="ml-4 space-y-2">
              <button id="go-support" class="btn-secondary text-sm w-full justify-start"><i class="fas fa-life-ring"></i> 3.1. Suporte</button>
              <button id="go-updates" class="btn-secondary text-sm w-full justify-start"><i class="fas fa-bell"></i> 3.2. Atualizações</button>
            </div>
          </div>
          <div class="glass p-4" style="border-color:rgba(239,68,68,.3)">
            <h3 class="kab mb-3 text-red-400">4. Área perigosa</h3>
            <div class="ml-4 space-y-2">
              <button id="deactivate" class="btn-danger text-sm w-full justify-start"><i class="fas fa-pause"></i> 4.1. Desativar conta</button>
              <button id="rescind" class="btn-danger text-sm w-full justify-start"><i class="fas fa-file-contract"></i> 4.2. Rescindir contrato</button>
              <button id="delete-acc" class="btn-danger text-sm w-full justify-start"><i class="fas fa-trash"></i> 4.3. Excluir conta</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}
function bindSettings(){
  $('#bk').addEventListener('click', ()=>{ state.page='dashboard'; render(); });
  $('#theme-dark').addEventListener('click', ()=>{ playSound('botao'); localStorage.setItem(THEME_KEY,'dark'); document.documentElement.setAttribute('data-theme','dark'); });
  $('#theme-light').addEventListener('click', ()=>{ playSound('botao'); localStorage.setItem(THEME_KEY,'light'); document.documentElement.setAttribute('data-theme','light'); });

  $('#view-contract').addEventListener('click', ()=>{
    const u=state.user;
    showContract(u.fullName||'', u.artistName||'', u.email||'', u.whatsapp||'', u.tiktok||'', u.schoolGrade||'');
  });

  $('#go-support').addEventListener('click', ()=>{ playSound('botao'); state.page='support'; render(); });
  $('#go-updates').addEventListener('click', ()=>{ alert('Tucano Música v1.2 — Sistema de lançamentos com ID numérico, licenças, compilação, feat e suporte.'); });

  $('#deactivate').addEventListener('click', ()=>{
    if(!confirm('Tem certeza de que deseja desativar sua conta? Isso só resulta no processo onde você não pode mais utilizar sua conta, mas é reversível, e seus fonogramas distribuídos aqui ainda ficarão no ar.')) return;
    state.user.disabled = true; persistUser(); render();
  });

  $('#rescind').addEventListener('click', async ()=>{
    if(!confirm('Tem certeza de que deseja rescindir? Isso resultará no takedown de todos os fonogramas distribuídos aqui, mas ainda é reversível.\n\nAtenção: o pedido é registrado no Supabase, mas a remoção efetiva nas plataformas depende do admin.')) return;
    const btn=$('#rescind'); const old=btn.innerHTML;
    btn.disabled=true; btn.innerHTML='<span class="spinner"></span>';
    try{
      const txt = `Rescisão de contrato\n\nDADOS DO ARTISTA\nNome completo: ${state.user.fullName || ''}\nNome artístico: ${state.user.artistName || ''}\nE-mail: ${state.user.email || ''}\nWhatsApp: ${state.user.whatsapp || ''}\nUsuário: ${state.user.username}\nData da rescisão: ${new Date().toLocaleString('pt-BR')}\n\nO Artista rescindiu o contrato com a Tucano. Todos os fonogramas distribuídos devem ser removidos das plataformas.`;
      await uploadText(txt, `${safePathUser(state.user.username)}/rescisao.txt`);
      state.user.rescinded = true; persistUser();
      alert('Rescisão registrada no Supabase. A remoção efetiva depende do admin.');
      render();
    }catch(e){ alert('Erro ao enviar rescisao.txt: '+e.message); btn.disabled=false; btn.innerHTML=old; }
  });

  $('#delete-acc').addEventListener('click', async ()=>{
    playSound('alerta');
    if(!confirm('Tem certeza de que deseja excluir? Isso resultará em todos os seus fonogramas deletados, você não poderá mais usar a Tucano e é irreversível.\n\nAtenção: o pedido é registrado no Supabase e o estado desta conta é removido deste dispositivo. A exclusão definitiva nos servidores (e do JSON) depende do admin.')) return;
    try{
      const txt = `Exclusão de conta\n\nDADOS DO ARTISTA\nNome completo: ${state.user.fullName || ''}\nNome artístico: ${state.user.artistName || ''}\nE-mail: ${state.user.email || ''}\nWhatsApp: ${state.user.whatsapp || ''}\nUsuário: ${state.user.username}\nData da exclusão: ${new Date().toLocaleString('pt-BR')}\n\nO Artista excluiu sua conta. Tudo deve ser excluído: releases, vídeos, suporte, candidaturas e a própria conta.`;
      await uploadText(txt, `${safePathUser(state.user.username)}/EXCLUA.txt`);
    }catch(e){ alert('Erro ao enviar EXCLUA.txt: '+e.message); }

    const key = normUser(state.user.username);
    clearDelta(key);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_LEGACY_KEY);
    stopStatusPolling();
    state.user = null;
    state.page = 'landing';
    render();
    alert('Estado da conta removido deste dispositivo. O JSON no repositório permanece até o admin remover de lá.');
  });
}

// ============================================================
// BANDAS E SINCRONIZAÇÃO
// ============================================================
function openBandManager(){
  if(isBlocked()){ alert('Conta bloqueada.'); return; }
  const members = state.user.bandMembers || [];
  const ov = document.createElement('div'); ov.className='modal-overlay';
  ov.innerHTML = `
    <div class="modal-content">
      <h2 class="kab text-xl mb-4">Gerenciar Artistas</h2>
      <div id="bm-list" class="space-y-2 mb-4">
        ${members.map((m,i)=>`<div class="flex items-center justify-between glass p-2"><span>${esc(m)}</span><button class="rm-member btn-danger text-xs" data-i="${i}" style="padding:.2rem .5rem"><i class="fas fa-times"></i></button></div>`).join('')}
        ${members.length === 0 ? '<p class="text-slate-400 text-sm">Nenhum membro.</p>' : ''}
      </div>
      <div class="flex gap-2">
        <input id="bm-new" type="text" placeholder="Nome do artista">
        <button id="bm-add" class="btn-primary text-sm whitespace-nowrap">Adicionar</button>
      </div>
      <button id="bm-close" class="btn-secondary w-full mt-4">Fechar e Sincronizar</button>
    </div>`;
  document.body.appendChild(ov);

  const close = ()=>{ ov.remove(); render(); };
  $('#bm-close').addEventListener('click', close);
  $('#bm-add').addEventListener('click', ()=>{
    const v=$('#bm-new').value.trim(); if(!v) return;
    state.user.bandMembers = state.user.bandMembers || [];
    if(!state.user.bandMembers.includes(v)) state.user.bandMembers.push(v);
    if(!state.user.artists) state.user.artists = [];
    if(!state.user.artists.includes(v)) state.user.artists.push(v);
    persistUser(); close();
  });
  ov.querySelectorAll('.rm-member').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const i=+btn.dataset.i;
      state.user.bandMembers.splice(i,1);
      persistUser(); close();
    });
  });
}

async function syncSharedReleases(){
  if(!state.user) return;
  try{
    const sb = getSupabase();
    const members = (state.user.bandMembers || []).slice();
    if(!members.includes(state.user.username)) members.push(state.user.username);

    const seen = new Set((state.user.releases||[]).map(r=>r.basePath));
    let count = 0;

    for(const m of members){
      const safe = safePathUser(m);
      const { data, error } = await sb.storage.from(BUCKET).list(safe, { limit: 200 });
      if(error || !data) continue;

      for(const folder of data){
        if(!folder.name) continue;
        if(folder.name.includes('.')) continue;
        if(['support','applications'].includes(folder.name)) continue;

        const basePath = `${safe}/${folder.name}`;
        if(seen.has(basePath)) continue;

        const txt = await fetchTextFile(`${basePath}/metadados.txt`);
        if(!txt) continue;

        const statusTxt = await fetchTextFile(`${basePath}/status.txt`);
        const parsed = parseStatusTxt(statusTxt || '');

        const titleMatch = txt.match(/Título:\s*(.+)/);
        const typeMatch = txt.match(/Tipo:\s*(.+)/);
        const idMatch = txt.match(/ID:\s*(\d{4})/);
        const coverMatch = txt.match(/Capa:\s*(.+)/);
        const isCompMatch = txt.match(/Compilação:\s*(Sim|Não)/i);
        const isFeatMatch = txt.match(/É um feat\?:\s*(Sim|Não)/i);

        let coverUrl = '';
        if(coverMatch && !coverMatch[1].includes('(já no servidor)')){
          const coverName = coverMatch[1].trim();
          const { data: cData } = sb.storage.from(BUCKET).getPublicUrl(`${basePath}/${coverName}`);
          if(cData) coverUrl = cData.publicUrl;
        }

        const tracks = [];
        const blocks = txt.split(/Música\s+\d+/i).slice(1);
        blocks.forEach(block=>{
          const get = (k)=>{
            const mm = block.match(new RegExp('^\\s*'+k+'\\s*:\\s*(.*)$','mi'));
            return mm ? mm[1].trim() : '';
          };
          tracks.push({
            title:get('Título'), artist:get('Artista principal'),
            isFeat: /sim/i.test(get('É um feat?')) ? 'sim' : 'nao',
            feat:get('Artista featured'), featSpotify:get('Spotify do feat'),
            composers:get('Compositores'), license:get('Licença'),
            isrc:get('ISRC'), explicit:/Sim/.test(get('Explícito')),
            fileName:get('Nome do arquivo'), url:''
          });
        });

        let releaseId = idMatch ? idMatch[1] : folder.name;
        if(!/^\d{4}$/.test(String(releaseId))) releaseId = folder.name;

        if((state.user.releases||[]).some(r=>String(r.id)===String(releaseId))) {
          seen.add(basePath); continue;
        }

        state.user.releases = state.user.releases || [];
        state.user.releases.push({
          id: releaseId,
          title: titleMatch ? titleMatch[1].trim() : folder.name,
          type: typeMatch ? typeMatch[1].trim().toLowerCase() : 'single',
          isCompilation: isCompMatch ? /sim/i.test(isCompMatch[1]) : false,
          isFeat: isFeatMatch ? (/sim/i.test(isFeatMatch[1]) ? 'sim' : 'nao') : 'nao',
          basePath,
          status: parsed?.status ? displayStatus(parsed.status) : 'Revisão',
          motivo: parsed?.motivo || '',
          coverUrl,
          createdAt: folder.created_at || new Date().toISOString(),
          tracks
        });
        seen.add(basePath);
        count++;
      }
    }

    if(count > 0){
      persistUser();
      await refreshReleaseStatuses();
      if(state.page === 'dashboard' || state.page === 'catalogs') render();
    }
  }catch(e){ console.warn('syncSharedReleases', e); }
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async ()=>{
  document.documentElement.setAttribute('data-theme', localStorage.getItem(THEME_KEY) || 'dark');

  const sess = localStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_LEGACY_KEY);
  if(sess){
    try{
      const base = await loadAccount(sess);
      if(base){
        const delta = loadDelta(base.username || sess);
        state.user = mergeAccount(base, delta);
        state.page='dashboard';
      }
    }catch(e){ console.warn('Falha ao restaurar sessão:', e); }
  }

  const params = new URLSearchParams(location.search);
  const action = params.get('action');
  if(action==='support' && state.user) state.page='support';
  else if(action==='new' && state.user) state.page='type';

  render();

  if(state.user){
    startStatusPolling();
    syncSharedReleases();
  }

  if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(()=>{}); }
});
