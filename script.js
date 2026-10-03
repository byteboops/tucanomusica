const SUPABASE_URL='https://mjqwiqjojkzobuysziyv.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qcXdpcWpvamt6b2J1eXN6aXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3Nzc4MzMsImV4cCI6MjEwNjM1MzgzM30.w4zDJdmAOmZBnvfXHZ3YDu2qfiUs_gSOnccY0S2ahG8';
const BUCKET='releases';

/* Supabase só é criado quando REALMENTE precisar (nunca bloqueia o login) */
let supabaseClient=null;
function getSupabase(){
  if(supabaseClient) return supabaseClient;
  if(!window.supabase){ throw new Error('Biblioteca do Supabase não carregou (verifique a internet).') }
  supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
  return supabaseClient;
}

/* ============================================================
   CONTAS — NOVO
   - Chaves novas (v2) — não usam mais o localStorage antigo quebrado
   - Busca ignora maiúscula/minúscula/acento
   - Usuários padrão SEMPRE garantidos (recria se faltar)
   ============================================================ */
const ACCOUNTS_KEY='tucano_accounts_v2';
const SESSION_KEY='tucano_session_v2';

function normUser(s){
  return String(s==null?'':s).trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}
function loadAccounts(){
  try{
    const raw=localStorage.getItem(ACCOUNTS_KEY);
    if(!raw) return {};
    const o=JSON.parse(raw);
    return (o&&typeof o==='object')?o:{};
  }catch(e){ return {} }
}
function saveAccounts(a){ localStorage.setItem(ACCOUNTS_KEY,JSON.stringify(a)) }

function defaultAccounts(){
  return {
    'ricardo':{
      username:'Ricardo',password:'oreiade_baterbolo332',
      answeredContract:false,contractType:null,contractSigned:true,contractPdfDownloaded:true,
      knittingAcknowledged:false,hasRealContract:true,
      releases:[],artists:[],videoReleases:[],
      fullName:'Ricardo de Almeida dos Santos',artistName:'Ricardo',
      email:'robsonj56@gmail.com',whatsapp:'+55 41 98478 1295'
    },
    'davi luiz':{
      username:'Daví Luiz',password:'daviluiz_497',
      answeredContract:false,contractType:null,contractSigned:true,contractPdfDownloaded:true,
      knittingAcknowledged:false,hasRealContract:true,
      releases:[],artists:[],videoReleases:[],
      fullName:'Daví Luiz',artistName:'Daví Luiz',
      email:'',whatsapp:'+55 41 9626-5488'
    }
  };
}
function ensureAccounts(){
  const acc=loadAccounts();
  const defs=defaultAccounts();
  let changed=false;
  for(const k in defs){
    if(!acc[k]){ acc[k]=defs[k]; changed=true; }
    else{
      if(!acc[k].username){ acc[k].username=acc[k].fullName||k; changed=true }
    }
  }
  if(changed) saveAccounts(acc);
  return acc;
}

const state={user:null,page:'landing',draft:{}};

function persistUser(){
  if(!state.user) return;
  const acc=loadAccounts();
  const key=state.user.__key || normUser(state.user.username);
  const copy={...state.user};
  delete copy.__key;
  acc[key]=copy;
  saveAccounts(acc);
}

function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function fmtDate(d){if(!d)return'';return new Date(d+'T00:00:00').toLocaleDateString('pt-BR')}
function getSpeed(){if(!navigator.onLine)return 0;const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;return c?(c.downlink||10):10}
function simulateUpload(cb){const s=getSpeed();if(s===0){cb(0,true);return}let p=0;const i=setInterval(()=>{p+=Math.min(8,Math.max(1,s*0.4));if(p>=100){p=100;clearInterval(i);cb(100,false)}else cb(p,false)},150)}

async function uploadFile(file,path){
  const sb=getSupabase();
  const {error}=await sb.storage.from(BUCKET).upload(path,file,{cacheControl:'3600',upsert:false});
  if(error){ console.error('Erro Supabase:',error); throw new Error('Supabase: '+(error.message||JSON.stringify(error))); }
  const {data}=sb.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
async function uploadText(text,path){
  const blob=new Blob([text],{type:'text/plain;charset=utf-8'});
  const file=new File([blob],path.split('/').pop(),{type:'text/plain'});
  return await uploadFile(file,path);
}

function datePlus(days){
  const d=new Date();d.setDate(d.getDate()+days);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function go(p){state.page=p;render()}

function liarAlert(){
  try{
    if('Notification' in window && Notification.permission==='granted'){
      new Notification('Tucano Música',{body:'Assine primeiro, mentiroso da porra 😡'});
    }else if('Notification' in window && Notification.permission!=='denied'){
      Notification.requestPermission().then(p=>{
        if(p==='granted') new Notification('Tucano Música',{body:'Assine primeiro, mentiroso da porra 😡'});
      });
    }
  }catch(e){}
  const div=document.createElement('div');
  div.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px';
  div.innerHTML=`
    <div class="glass" style="max-width:480px;width:100%;padding:32px;text-align:center">
      <div style="font-size:72px;line-height:1;margin-bottom:16px">😡</div>
      <h2 style="font-size:24px;font-weight:700;margin-bottom:12px;color:#f87171">Assine primeiro, mentiroso da porra</h2>
      <p style="color:#94a3b8;margin-bottom:24px">Você não tem um contrato registrado. Escolha <b>"Nenhum"</b> e assine o contrato da Tucano de verdade.</p>
      <button id="liar-ok" class="btn-primary" style="padding:12px 32px;border-radius:12px;color:#fff;font-weight:700;border:none;cursor:pointer">Entendi</button>
    </div>`;
  document.body.appendChild(div);
  div.querySelector('#liar-ok').onclick=()=>div.remove();
}

function render(){
  const app=$('app');
  if(!state.user){app.innerHTML=viewLanding();bindLanding();return}
  if(!state.user.answeredContract){app.innerHTML=viewContractQuestion();bindContractQuestion();return}
  if(state.user.contractType==='knitting'&&!state.user.knittingAcknowledged){app.innerHTML=viewKnitting();bindKnitting();return}
  if(state.user.contractType==='none'&&!state.user.contractSigned){app.innerHTML=viewNoneOption();bindNoneOption();return}
  if(state.user.contractType==='none'&&state.user.contractSigned&&!state.user.contractPdfDownloaded){app.innerHTML=viewContractSigned();bindContractSigned();return}
  switch(state.page){
    case 'type':app.innerHTML=viewTypeSelector();bindTypeSelector();break;
    case 'tracks':app.innerHTML=viewTrackEditor();bindTrackEditor();break;
    case 'cover':app.innerHTML=viewCoverMeta();bindCoverMeta();break;
    case 'support':app.innerHTML=viewSupport();bindSupport();break;
    case 'video':app.innerHTML=viewVideo();bindVideo();break;
    default:app.innerHTML=viewDashboard();bindDashboard();
  }
}

function viewLanding(){
  return `<div class="min-h-screen flex items-center justify-center p-6">
    <div class="glass glow p-8 md:p-12 max-w-6xl w-full flex flex-col md:flex-row items-center gap-8">
      <div class="flex-1 text-left">
        <h1 class="text-3xl md:text-5xl font-bold leading-tight mb-6">
          Distribua sua música em <span class="text-sky-400">várias plataformas</span> <span class="text-yellow-400">GRATUITAMENTE</span>, uploads <span class="text-purple-400">ILIMITADOS ∞</span> e ganhe <span class="text-green-400">75%</span> dos seus royalties!
        </h1>
        <p class="text-slate-400 mb-6 text-lg"><i class="fas fa-exclamation-triangle text-yellow-500 mr-2"></i>Desculpe, mas não aceitamos criação de conta comum para artistas.</p>
        <div class="space-y-4 max-w-sm">
          <input type="text" id="login-user" placeholder="Usuário" autocomplete="username">
          <input type="password" id="login-pass" placeholder="Senha" autocomplete="current-password">
          <button id="login-btn" type="button" class="btn-primary w-full py-3 rounded-xl font-bold text-white text-lg"><i class="fas fa-sign-in-alt mr-2"></i>Fazer Login</button>
          <p id="login-error" class="text-red-400 text-sm hidden">Credenciais inválidas.</p>
        </div>
      </div>
      <div class="flex-shrink-0 text-center">
        <img src="tucano.png" alt="Tucano Música" class="tucano-logo">
        <p class="mt-4 text-2xl font-bold text-sky-300">Tucano Música</p>
      </div>
    </div>
  </div>`;
}

function bindLanding(){
  const btn=$('login-btn');
  const err=$('login-error');
  const doLogin=()=>{
    err.classList.add('hidden');
    const typedU=$('login-user').value;
    const typedP=$('login-pass').value;
    const key=normUser(typedU);
    const acc=ensureAccounts();
    const account=acc[key];
    if(account && account.password===typedP){
      const u={...account,__key:key};
      state.user=u;
      localStorage.setItem(SESSION_KEY,key);
      go('dashboard');
    }else{
      err.classList.remove('hidden');
    }
  };
  btn.onclick=doLogin;
  $('login-pass').addEventListener('keydown',e=>{ if(e.key==='Enter') doLogin(); });
  $('login-user').addEventListener('keydown',e=>{ if(e.key==='Enter') doLogin(); });
}

function viewContractQuestion(){
  return `<div class="min-h-screen flex items-center justify-center p-6">
    <div class="glass p-8 md:p-12 max-w-2xl w-full text-center">
      <h2 class="text-3xl font-bold mb-6">Você assinou algum contrato com:</h2>
      <div class="space-y-4">
        <button id="c-knit" class="btn-primary w-full py-4 rounded-xl font-bold text-white text-lg"><i class="fas fa-file-signature mr-2"></i>Knitting Records™</button>
        <button id="c-tuc" class="btn-primary w-full py-4 rounded-xl font-bold text-white text-lg"><i class="fas fa-file-signature mr-2"></i>Tucano Independente</button>
        <button id="c-none" class="bg-slate-700 hover:bg-slate-600 w-full py-4 rounded-xl font-bold text-white text-lg"><i class="fas fa-ban mr-2"></i>Nenhum</button>
      </div>
    </div>
  </div>`;
}
function bindContractQuestion(){
  $('c-knit').onclick=()=>{
    if(state.user.hasRealContract!==true){liarAlert();return}
    state.user.contractType='knitting';state.user.answeredContract=true;state.user.knittingAcknowledged=false;persistUser();render();
  };
  $('c-tuc').onclick=()=>{
    if(state.user.hasRealContract!==true){liarAlert();return}
    state.user.contractType='tucano';state.user.answeredContract=true;state.user.contractSigned=true;state.user.contractPdfDownloaded=true;persistUser();render();
  };
  $('c-none').onclick=()=>{state.user.contractType='none';state.user.answeredContract=true;state.user.contractSigned=false;state.user.contractPdfDownloaded=false;persistUser();render()};
}

function viewKnitting(){
  return `<div class="min-h-screen flex items-center justify-center p-6">
    <div class="glass p-8 md:p-12 max-w-2xl w-full text-center">
      <h2 class="text-3xl font-bold mb-6 text-red-400">Aviso Knitting Records™</h2>
      <ul class="text-left space-y-3 text-lg mb-8">
        <li><i class="fas fa-times-circle text-red-500 mr-2"></i>Knitting retém 80%;</li>
        <li><i class="fas fa-times-circle text-red-500 mr-2"></i>Knitting é gravadora;</li>
        <li><i class="fas fa-times-circle text-red-500 mr-2"></i>Knitting retém todos os direitos;</li>
        <li><i class="fas fa-times-circle text-red-500 mr-2"></i>Knitting é dona da Tucano;</li>
        <li><i class="fas fa-times-circle text-red-500 mr-2"></i>Knitting é exclusiva.</li>
      </ul>
      <p class="text-slate-400 mb-6">Redirecionando em <span id="cd">5</span>s...</p>
      <button id="k-ok" class="btn-primary px-8 py-3 rounded-xl font-bold text-white">Entendi</button>
    </div>
  </div>`;
}
function bindKnitting(){
  let s=5;
  const t=setInterval(()=>{s--;const el=$('cd');if(el)el.textContent=s;if(s<=0){clearInterval(t);state.user.knittingAcknowledged=true;persistUser();render()}},1000);
  $('k-ok').onclick=()=>{clearInterval(t);state.user.knittingAcknowledged=true;persistUser();render()};
}

function viewContractSigned(){
  return `<div class="min-h-screen flex items-center justify-center p-6">
    <div class="glass p-8 md:p-12 max-w-2xl w-full text-center">
      <h2 class="text-3xl font-bold mb-6 text-green-400">Contrato Assinado!</h2>
      <p class="text-slate-300 mb-6">Baixe a cópia em PDF para continuar.</p>
      <button id="pdf-btn" class="btn-primary px-8 py-4 rounded-xl font-bold text-white text-lg"><i class="fas fa-file-pdf mr-2"></i>Baixar PDF da cópia assinada</button>
    </div>
  </div>`;
}
function bindContractSigned(){
  $('pdf-btn').onclick=()=>{
    const blob=new Blob(['Contrato Tucano Música - Cópia assinada'],{type:'application/pdf'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='contrato_tucano.pdf';a.click();
    URL.revokeObjectURL(url);
    state.user.contractPdfDownloaded=true;persistUser();render();
  };
}

function viewNoneOption(){
  return `<div class="min-h-screen flex items-center justify-center p-6">
    <div class="glass p-8 md:p-12 max-w-2xl w-full text-center">
      <h2 class="text-3xl font-bold mb-6">Você não assinou nenhum contrato.</h2>
      <p class="text-slate-300 mb-6">Gostaria de assinar o contrato com a Tucano Independente?</p>
      <div class="space-y-4">
        <button id="n-yes" class="btn-primary w-full py-4 rounded-xl font-bold text-white text-lg"><i class="fas fa-check mr-2"></i>Sim, quero assinar</button>
        <button id="n-no" class="bg-slate-700 hover:bg-slate-600 w-full py-4 rounded-xl font-bold text-white text-lg"><i class="fas fa-times mr-2"></i>Não, obrigado</button>
      </div>
      <p id="n-warn" class="text-red-400 text-sm mt-4 hidden">Você precisa assinar o contrato para acessar o painel.</p>
    </div>
  </div>`;
}
function bindNoneOption(){
  $('n-no').onclick=()=>{$('n-warn').classList.remove('hidden')};
  $('n-yes').onclick=()=>{
    $('app').innerHTML=`<div class="min-h-screen flex items-center justify-center p-6">
      <div class="glass p-8 md:p-12 max-w-2xl w-full">
        <h2 class="text-3xl font-bold mb-2 text-center">Preencha seus dados</h2>
        <p class="text-slate-400 text-center mb-6">Esses dados vão aparecer no contrato.</p>
        <div class="space-y-4 mb-6">
          <div>
            <label class="block mb-2 font-bold">Nome completo do artista *</label>
            <input type="text" id="full-name" required placeholder="Ex: João da Silva Santos">
          </div>
          <div>
            <label class="block mb-2 font-bold">Nome artístico *</label>
            <input type="text" id="artist-name" required placeholder="Ex: Joãozinho MC">
          </div>
          <div>
            <label class="block mb-2 font-bold">E-mail *</label>
            <input type="email" id="user-email" required placeholder="Ex: joao@email.com">
          </div>
          <div>
            <label class="block mb-2 font-bold">WhatsApp *</label>
            <input type="tel" id="user-whats" required placeholder="Ex: (11) 91234-5678">
          </div>
        </div>
        <button id="go-contract" class="btn-primary w-full py-4 rounded-xl font-bold text-white text-lg">
          Ir para o contrato <i class="fas fa-arrow-right ml-2"></i>
        </button>
      </div>
    </div>`;
    $('go-contract').onclick=()=>{
      const full=$('full-name').value.trim();
      const art=$('artist-name').value.trim();
      const mail=$('user-email').value.trim();
      const whats=$('user-whats').value.trim();
      if(!full||!art||!mail||!whats){alert('Preencha todos os campos, por favor.');return}
      if(!/^\S+@\S+\.\S+$/.test(mail)){alert('Digite um e-mail válido.');return}
      state.user.fullName=full;
      state.user.artistName=art;
      state.user.email=mail;
      state.user.whatsapp=whats;
      persistUser();
      showContract(full,art,mail,whats);
    };
  };
}

function showContract(fullName,artistName,email,whatsapp){
  const hoje=new Date().toLocaleDateString('pt-BR');
  const contractHTML=`CONTRATO DE DISTRIBUIÇÃO FONOGRÁFICA E AUDIOVISUAL

Nota importante: Isto não é um contrato de verdade, mas sim um acordo entre amigos. A Tucano Música não foi criada com intuito empresarial, mas como uma ajuda entre amigos.

Pelo presente instrumento particular, Tucano Música, com seu representante legal Yan Matheus Antunes Batista, doravante denominado Tucano, e <span class="contract-fill">${esc(fullName)}</span>, de nome artístico <span class="contract-fill">${esc(artistName)}</span>, e-mail <span class="contract-fill">${esc(email)}</span> e WhatsApp <span class="contract-fill">${esc(whatsapp)}</span>, doravante denominado Artista, tem entre si justo e contratado o seguinte:

1. Proposta

A Tucano deverá distribuir as obras fonográficas (doravante "Obras") ou audiovisuais (doravante "Vídeos") do Artista nas principais plataformas digitais.

2. Requisitos

Para áudio:

MP3;
WAV;
320kbps se for MP3;
16/24 bits;
codec PCM_S16LE/PCM_S24LE;
44,1kHz+;
Capa em PNG ou JPG/JPEG, quadrado, únicos textos permitidos são nome do lançamento, do artista/banda e opcionalmente, obrigatoriamente se for explícito, selo Parental Advisory.

Para vídeo:

MP4;
MOV;
720p mínimo;
1920x1080;
24fps;
Capa em PNG ou JPG/JPEG, 1920x1080, permitido apenas selo Parental Advisory(opcionalmente, obrigatoriamente se for explícito) como texto.

3. Exclusividade

Este contrato não é exclusivo, podendo o Artista distribuir suas obras em outras distribuidoras.

4. Direitos autorais

O Artista mantém 100% dos direitos autorais, fonográficos e conexos sobre suas Obras e Vídeos. A Tucano não reivindica nenhum direito sobre as obras além da distribuição digital prevista neste acordo.

5. Royalties

5.1. A comissão sobre royalties de Obras e Vídeos é de 25% para a Tucano e 75% para o Artista.
5.2. A Tucano deverá pagar os royalties em até 15 dias corridos após receber das plataformas.
5.3. Como acordo entre amigos, não há taxa de adesão nem cobrança extra além da comissão prevista no item 5.1.

6. Vigência, vigor e renovação

6.1. A vigência deste contrato é de 30(trinta) dias corridos.
6.2. O vigor deste contrato tem efeito imediato.
6.3. A renovação é automática, salvo se qualquer das partes manifestar intenção de rescindir conforme a cláusula 7.

7. Rescisão

7.1. A rescisão é gratuita, podendo ser realizada por acordo entre a Tucano e o Artista.
7.2. Após a rescisão, a Tucano tem até 15 dias corridos para remover as Obras e Vídeos do Artista das plataformas digitais.

8. Quem pode usar

Apenas estudantes do colégio do representante legal da Tucano são membros autorizados para a distribuição.

9. Conduta

Não serão aceitas Obras ou Vídeos que contenham:

Plágio de outro artista sem licença;
Apologia a crime, drogas ou violência;
Discurso de ódio;
Conteúdo sexual sem aviso explícito.

10. Foro

Fica eleito o foro da carteira do Yan para dirimir quaisquer controvérsias oriundas deste contrato.

E por estarem assim, justos e contratados, as partes assinam este contrato em 2 vias de igual teor, uma no site/aplicativo oficial e outra em PDF.

Data de celebração: <span class="contract-fill">${hoje}</span>

Pela Tucano: Tucano.
Pelo Artista:`;
  $('app').innerHTML=`<div class="min-h-screen flex items-center justify-center p-6">
    <div class="glass p-8 md:p-12 max-w-3xl w-full">
      <h2 class="text-2xl font-bold mb-4">Contrato Tucano Independente</h2>
      <div class="bg-slate-900/60 p-6 rounded-xl max-h-96 overflow-y-auto mb-6 text-sm whitespace-pre-wrap">${contractHTML}</div>
      <label class="flex items-center gap-3 mb-6"><input type="checkbox" id="agree" class="w-5 h-5"><span>Concordo integralmente com todas as cláusulas.</span></label>
      <button id="sign" class="btn-primary w-full py-4 rounded-xl font-bold text-white text-lg" disabled>Assinar Contrato</button>
    </div>
  </div>`;
  $('agree').onchange=(e)=>{$('sign').disable
