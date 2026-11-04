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
          <!-- B -->
          <div id="sec-b" class="scroll-mt-24 rounded-3xl overflow-hidden relative" style="background:url('./sistema_tucanico.mp4') center/cover no-repeat #0f172a">
            <video src="./sistema_tucanico.mp4" autoplay muted loop playsinline class="absolute inset-0 w-full h-full object-cover opacity-25"></video>
            <div class="relative p-8 md:p-12" style="background:rgba(248,250,252,.92)">
              <h3 class="kab text-3xl">Distribua sua música em uma cacetada de DSPs</h3>
              <p class="tts mt-4 text-lg" style="color:#0f172a">São +480 plataformas para onde a sua música vai! Veja elas em <a href="https://plataformasknitting.vercel.app" target="_blank" rel="noopener noreferrer" style="color:#166534;text-decoration:underline">https://plataformasknitting.vercel.app</a>.</p>
            </div>
          </div>
          <!-- A -->
          <div id="sec-a" class="scroll-mt-24 rounded-3xl overflow-hidden" style="background:url('./sample.png') center/cover no-repeat">
            <div class="p-8 md:p-12" style="background:rgba(248,250,252,.92)">
              <h3 class="kab text-3xl">Seja curado em playlists</h3>
              <p class="tts mt-4 text-lg" style="color:#0f172a">A Tucano Música é uma sub-empresa de uma gravadora chamada Knitting Records™. A Knitting te curará. Entre em playlists públicas e na distribuição musical digital.</p>
            </div>
          </div>
          <!-- C -->
          <div id="sec-c" class="scroll-mt-24 rounded-3xl overflow-hidden" style="background:url('./dinheiro.png') center/cover no-repeat">
            <div class="p-8 md:p-12" style="background:rgba(248,250,252,.92)">
              <h3 class="kab text-3xl">Receba 75% dos seus royalties</h3>
              <p class="tts mt-4 text-lg" style="color:#0f172a">Você cede uma pequena comissão de 25% dos royalties a Tucano para nossos sistemas continuarem operando!</p>
            </div>
          </div>
          <!-- D -->
          <div id="sec-d" class="scroll-mt-24 rounded-3xl overflow-hidden" style="background:url('./spotify.png') center/cover no-repeat">
            <div class="p-8 md:p-12" style="background:rgba(248,250,252,.92)">
              <h3 class="kab text-3xl">Tenha fácil acesso ao Spotify for Artists</h3>
              <p class="tts mt-4 text-lg" style="color:#0f172a">A Tucano reivindica o seu perfil do Spotify for Artists e você pode solicitar acesso ao seu perfil! Mas não mexemos em nada nele.</p>
            </div>
          </div>
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

    <!-- NOVO BLOCO FINAL (Imagem + Texto Verde) -->
    <section class="py-12 flex flex-col items-center justify-center jungle-texture">
      <img src="./tucano.png" alt="Tucano Música" style="max-width:200px;border-radius:20px;margin-bottom:20px" onerror="this.style.display='none'">
      <h2 class="kab text-4xl text-center" style="color:#a3e635;text-shadow:0 2px 10px rgba(0,0,0,0.5)">Sua carreira nos agradece</h2>
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
          <div><label>E-mail *</label><input id="ct-mail" type="email"></div>
          <div><label>WhatsApp (opcional)</label><input id="ct-whats" type="text"></div>
          <div>
            <label>Motivo *</label>
            <select id="ct-reason">
              <option value="">Selecione</option>
              <option value="Quero usar a Tucano">Quero usar a Tucano</option>
              <option value="Quero reclamar do serviço">Quero reclamar do serviço</option>
              <option value="Quero dar uma avaliação">Quero dar uma avaliação</option>
            </select>
          </div>
          <div id="ct-stars-wrap" style="display:none">
            <label>Quantas estrelas você dá? *</label>
            <input id="ct-stars" type="text" placeholder="Digite um número de 0 a 5" inputmode="numeric">
            <div id="ct-stars-view" class="text-yellow-400 text-2xl mt-2"></div>
          </div>
          <div>
            <label>Como quer ser respondido? *</label>
            <select id="ct-channel">
              <option value="">Selecione</option>
              <option value="Zap">Zap</option>
              <option value="E-mail">E-mail</option>
            </select>
          </div>
          <div id="ct-pref-wrap" style="display:none">
            <label>Você prefere preencher o formulário em qual lugar? *</label>
            <select id="ct-pref">
              <option value="">Selecione</option>
              <option value="E-mail">E-mail</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Formulário oficial">O formulário oficial</option>
            </select>
          </div>
          <div id="ct-tucano-instructions" class="info-box text-sm" style="display:none">
            <p class="font-semibold mb-2">Como criar conta na Tucano:</p>
            <ol class="list-decimal list-inside space-y-1">
              <li>Preencha todo o Contate-nos, selecionando a opção "Quero usar a Tucano" e onde deseja preencher o formulário;</li>
              <li>Pegaremos seus dados de contato e iremos te contatar em alguns dias;</li>
              <li>Preencha o formulário e espere alguns dias;</li>
              <li>Se nos interessarmos, criaremos uma conta, se não, não criaremos;</li>
              <li>Boa sorte!</li>
            </ol>
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
          <p><a href="#" id="footer-login">Entrar na conta</a></p>
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
        <p>Todos os direitos são livres. Créditos de desenvolvimento ao DeepSeek e créditos de geração de imagem ao ChatGPT.</p>
      </div>
    </footer>`;
}

function bindLanding(){
  $$('.carousel-card').forEach(b=>{
    b.addEventListener('click', ()=>{
      const id = b.dataset.scroll;
      const el = document.getElementById(id);
      if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
    });
  });

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

  $('#footer-login').addEventListener('click', (e)=>{ e.preventDefault(); state.page='login'; render(); });

  // Contato
  $('#ct-reason').addEventListener('change', ()=>{
    const reason = $('#ct-reason').value;
    const prefWrap = $('#ct-pref-wrap');
    const messageWrap = $('#ct-msg-wrap');
    const tucanoInstructions = $('#ct-tucano-instructions');
    const starsWrap = $('#ct-stars-wrap');

    const showPref = reason === 'Quero usar a Tucano';
    const showMsg = reason === 'Quero reclamar do serviço' || reason === 'Quero dar uma avaliação';
    const showStars = reason === 'Quero dar uma avaliação';

    prefWrap.style.display = showPref ? 'block' : 'none';
    messageWrap.style.display = showMsg ? 'block' : 'none';
    tucanoInstructions.style.display = showPref ? 'block' : 'none';
    starsWrap.style.display = showStars ? 'block' : 'none';

    if(!showPref) $('#ct-pref').value='';
    if(!showMsg) $('#ct-msg').value='';
    if(!showStars){ $('#ct-stars').value=''; $('#ct-stars-view').textContent=''; }
  });

  $('#ct-stars').addEventListener('input', ()=>{
    const raw = $('#ct-stars').value.trim();
    const n = Math.max(0, Math.min(5, parseInt(raw,10) || 0));
    $('#ct-stars-view').textContent = '★'.repeat(n) + '☆'.repeat(5-n);
  });

  $('#ct-send').addEventListener('click', async ()=>{
    const name = $('#ct-name').value.trim();
    const mail = $('#ct-mail').value.trim();
    const whats = $('#ct-whats').value.trim();
    const reason = $('#ct-reason').value;
    const starsRaw = $('#ct-stars').value.trim();
    const channel = $('#ct-channel').value;
    const pref = $('#ct-pref').value;
    const message = $('#ct-msg').value.trim();
    const err = $('#ct-error'); err.style.display='none';
    const ok = $('#ct-ok'); ok.style.display='none';

    if(!name || !mail || !reason || !channel){ err.textContent='Preencha todos os campos obrigatórios.'; err.style.display='block'; return; }
    if(!/^\S+@\S+\.\S+$/.test(mail)){ err.textContent='E-mail inválido.'; err.style.display='block'; return; }
    if(reason === 'Quero usar a Tucano' && !pref){ err.textContent='Selecione onde você prefere preencher o formulário.'; err.style.display='block'; return; }
    if((reason === 'Quero reclamar do serviço' || reason === 'Quero dar uma avaliação') && !message){ err.textContent='Preencha a mensagem.'; err.style.display='block'; return; }
    if(reason === 'Quero dar uma avaliação'){
      const n = parseInt(starsRaw,10);
      if(isNaN(n) || n<0 || n>5){ err.textContent='Digite uma nota de 0 a 5.'; err.style.display='block'; return; }
    }
    const btn = $('#ct-send'); btn.disabled=true; btn.innerHTML='<span class="spinner"></span>';
    try{
      const txt = `Contato\n\nNome completo: ${name}\nE-mail: ${mail}\nWhatsApp: ${whats || '(não informado)'}\nMotivo: ${reason}\n${reason==='Quero dar uma avaliação' ? 'Estrelas: '+starsRaw+'\n' : ''}${reason==='Quero usar a Tucano' ? 'Prefere preencher em: '+pref+'\n' : ''}Canal de resposta: ${channel}\nData: ${new Date().toLocaleString('pt-BR')}\n${(reason === 'Quero reclamar do serviço' || reason === 'Quero dar uma avaliação') ? '\nMensagem:\n'+message : ''}`;
      await uploadText(txt, `landing_contato_${uid()}.txt`);
      ok.textContent='Mensagem enviada!'; ok.style.display='block';
      ['#ct-name','#ct-mail','#ct-whats','#ct-msg','#ct-stars'].forEach(s=>{ const el=$(s); if(el) el.value=''; });
      $('#ct-stars-view').textContent='';
      $('#ct-reason').value=''; $('#ct-channel').value=''; $('#ct-pref').value='';
      $('#ct-stars-wrap').style.display='none';
      $('#ct-msg-wrap').style.display='none';
      $('#ct-pref-wrap').style.display='none';
      $('#ct-tucano-instructions').style.display='none';
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
      if(state.user.isBand) syncBandReleases();
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
  $('#c-knit').addEventListener('click', ()=>{
    if(state.user.hasRealContract !== true) return liarAlert();
    state.user.contractType='knitting'; state.user.answeredContract=true;
    state.user.knittingAcknowledged=false;
    persistUser(); render();
  });
  $('#c-tuc').addEventListener('click', ()=>{
    if(state.user.hasRealContract !== true) return liarAlert();
    state.user.contractType='tucano'; state.user.answeredContract=true;
    state.user.contractSigned=true; state.user.contractPdfDownloaded=true;
    persistUser(); render();
  });
  $('#c-none').addEventListener('click', ()=>{
    state.user.contractType='none'; state.user.answeredContract=true;
    state.user.contractSigned=false; state.user.contractPdfDownloaded=false;
    persistUser(); render();
  });
}
