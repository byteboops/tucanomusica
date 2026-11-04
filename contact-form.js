(() => {
  const USE_REASON = 'Quero usar a Tucano';
  const FEEDBACK_REASONS = ['Quero reclamar do serviço', 'Quero dar uma avaliação'];
  let initialized = false;

  function setupContactForm() {
    const reasonSelect = document.getElementById('ct-reason');
    if (!reasonSelect || initialized) return;

    const prefSelect = document.getElementById('ct-pref');
    const message = document.getElementById('ct-msg');
    const starsWrap = document.getElementById('ct-stars-wrap');
    const stars = document.getElementById('ct-stars');
    const starsView = document.getElementById('ct-stars-view');
    const sendButton = document.getElementById('ct-send');
    const errorBox = document.getElementById('ct-error');
    const successBox = document.getElementById('ct-ok');
    if (!prefSelect || !message || !sendButton || !errorBox || !successBox) return;

    initialized = true;

    const useOption = Array.from(reasonSelect.options).find(option =>
      option.value === 'Quero poder utilizar a Tucano'
    );
    if (useOption) {
      useOption.value = USE_REASON;
      useOption.textContent = USE_REASON;
    }

    const prefWrap = prefSelect.closest('div');
    const messageWrap = message.closest('div');
    if (!prefWrap || !messageWrap) return;

    const prefLabel = prefWrap.querySelector('label');
    if (prefLabel) prefLabel.textContent = 'Você prefere preencher o formulário em qual lugar?';
    prefSelect.innerHTML = `
      <option value="">Selecione</option>
      <option value="E-mail">E-mail</option>
      <option value="WhatsApp">WhatsApp</option>
      <option value="Formulário oficial">O formulário oficial</option>`;
    prefWrap.style.display = 'none';
    messageWrap.style.display = 'none';

    const instructions = document.createElement('div');
    instructions.id = 'ct-tucano-instructions';
    instructions.className = 'info-box text-sm';
    instructions.style.display = 'none';
    instructions.innerHTML = `
      <p class="font-semibold mb-2">Como criar conta na Tucano:</p>
      <ol class="list-decimal list-inside space-y-1">
        <li>Preencha todo o Contate-nos, selecionando a opção "Quero usar a Tucano" e onde deseja preencher o formulário;</li>
        <li>Pegaremos seus dados de contato e iremos te contatar em alguns dias;</li>
        <li>Preencha o formulário e espere alguns dias;</li>
        <li>Se nos interessarmos, criaremos uma conta, se não, não criaremos;</li>
        <li>Boa sorte!</li>
      </ol>`;
    prefWrap.insertAdjacentElement('afterend', instructions);

    const updateVisibility = () => {
      const reason = reasonSelect.value;
      const wantsTucano = reason === USE_REASON;
      const wantsFeedback = FEEDBACK_REASONS.includes(reason);
      prefWrap.style.display = wantsTucano ? 'block' : 'none';
      instructions.style.display = wantsTucano ? 'block' : 'none';
      messageWrap.style.display = wantsFeedback ? 'block' : 'none';
      if (!wantsTucano) prefSelect.value = '';
      if (!wantsFeedback) message.value = '';
      if (starsWrap) starsWrap.style.display = reason === 'Quero dar uma avaliação' ? 'block' : 'none';
      if (reason !== 'Quero dar uma avaliação' && stars) stars.value = '';
      if (reason !== 'Quero dar uma avaliação' && starsView) starsView.textContent = '';
    };

    reasonSelect.addEventListener('change', updateVisibility);
    updateVisibility();

    document.addEventListener('click', async event => {
      if (event.target.closest('#ct-send') !== sendButton) return;
      event.preventDefault();
      event.stopImmediatePropagation();

      const name = document.getElementById('ct-name').value.trim();
      const mail = document.getElementById('ct-mail').value.trim();
      const whats = document.getElementById('ct-whats').value.trim();
      const reason = reasonSelect.value;
      const channel = document.getElementById('ct-channel').value;
      const pref = prefSelect.value;
      const contactMessage = message.value.trim();
      const starsRaw = stars ? stars.value.trim() : '';
      errorBox.style.display = 'none';
      successBox.style.display = 'none';

      if (!name || !mail || !reason || !channel) {
        errorBox.textContent = 'Preencha todos os campos obrigatórios.';
        errorBox.style.display = 'block';
        return;
      }
      if (!/^\S+@\S+\.\S+$/.test(mail)) {
        errorBox.textContent = 'E-mail inválido.';
        errorBox.style.display = 'block';
        return;
      }
      if (reason === USE_REASON && !pref) {
        errorBox.textContent = 'Selecione onde você prefere preencher o formulário.';
        errorBox.style.display = 'block';
        return;
      }
      if (FEEDBACK_REASONS.includes(reason) && !contactMessage) {
        errorBox.textContent = 'Preencha a mensagem.';
        errorBox.style.display = 'block';
        return;
      }
      if (reason === 'Quero dar uma avaliação') {
        const rating = Number(starsRaw);
        if (!starsRaw || !Number.isInteger(rating) || rating < 0 || rating > 5) {
          errorBox.textContent = 'Digite uma nota de 0 a 5.';
          errorBox.style.display = 'block';
          return;
        }
      }

      const oldButton = sendButton.innerHTML;
      sendButton.disabled = true;
      sendButton.innerHTML = '<span class="spinner"></span>';
      try {
        const details = [
          'Contato', '',
          `Nome completo: ${name}`,
          `E-mail: ${mail}`,
          `WhatsApp: ${whats || '(não informado)'}`,
          `Motivo: ${reason}`,
          ...(reason === 'Quero dar uma avaliação' ? [`Estrelas: ${starsRaw}`] : []),
          `Canal de resposta: ${channel}`,
          ...(reason === USE_REASON ? [`Preferência de preenchimento: ${pref}`] : []),
          `Data: ${new Date().toLocaleString('pt-BR')}`,
          ...(FEEDBACK_REASONS.includes(reason) ? ['', 'Mensagem:', contactMessage] : [])
        ].join('\n');

        await uploadText(details, `landing_contato_${uid()}.txt`);
        successBox.textContent = 'Mensagem enviada!';
        successBox.style.display = 'block';
        ['#ct-name', '#ct-mail', '#ct-whats', '#ct-msg', '#ct-stars'].forEach(selector => {
          const field = document.querySelector(selector);
          if (field) field.value = '';
        });
        if (starsView) starsView.textContent = '';
        reasonSelect.value = '';
        document.getElementById('ct-channel').value = '';
        prefSelect.value = '';
        updateVisibility();
      } catch (error) {
        errorBox.textContent = `Erro: ${error.message}`;
        errorBox.style.display = 'block';
      } finally {
        sendButton.disabled = false;
        sendButton.innerHTML = oldButton;
      }
    }, true);
  }

  function observeLanding() {
    const app = document.getElementById('app');
    if (!app) return;
    const observer = new MutationObserver(setupContactForm);
    observer.observe(app, { childList: true, subtree: true });
    setupContactForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeLanding, { once: true });
  } else {
    observeLanding();
  }
})();
